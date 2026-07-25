import { supabase } from "../../supabase.js";
import { confirmAction, actionMsg } from "../../utils/modals.js";
import { showUploadStatus } from "../../shared/workspace/utils.js";
import { getCurrentWorkspace } from "./state.js";

let docEventListenersAttached = false;

// -------------------------------------------------------------------
// DOCUMENTS (shared, with upload for all, delete for uploader)
// -------------------------------------------------------------------
export async function loadDocuments(documents, container, workspace) {
  container.innerHTML = "";

  const { data } = await supabase.auth.getUser();
  const currentUser = data.user;

  const title = document.createElement("h2");
  title.className = "sectionTitle";
  title.textContent = "📂 Documents";

  const uploadBtn = document.createElement("button");
  uploadBtn.classList.add("actionBtn", "btn-sm", "btn");

  const iconWrap = document.createElement("span");
  iconWrap.className = "navIcon";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  const p1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p1.setAttribute("d", "M12 16V4");
  p1.setAttribute("stroke", "currentColor");
  p1.setAttribute("stroke-width", "2");
  p1.setAttribute("stroke-linecap", "round");
  const p2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p2.setAttribute("d", "M6 10L12 4L18 10");
  p2.setAttribute("stroke", "currentColor");
  p2.setAttribute("stroke-width", "2");
  p2.setAttribute("stroke-linecap", "round");
  p2.setAttribute("stroke-linejoin", "round");
  const p3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p3.setAttribute("d", "M4 16V20H20V16");
  p3.setAttribute("stroke", "currentColor");
  p3.setAttribute("stroke-width", "2");
  p3.setAttribute("stroke-linecap", "round");
  p3.setAttribute("stroke-linejoin", "round");
  svg.appendChild(p1);
  svg.appendChild(p2);
  svg.appendChild(p3);
  iconWrap.appendChild(svg);

  const text = document.createElement("span");
  text.className = "navText";
  text.textContent = "Upload";
  uploadBtn.appendChild(iconWrap);
  uploadBtn.appendChild(text);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.classList.add("hide");

  const sectionHeader = document.createElement("div");
  sectionHeader.classList.add("sectionHeader");
  sectionHeader.append(title, uploadBtn);

  container.appendChild(sectionHeader);
  container.appendChild(fileInput);

  const list = document.createElement("div");
  list.className = "documentsList";
  container.appendChild(list);

  if (!documents.length) {
    const empty = document.createElement("p");
    empty.className = "placeholderText";
    empty.textContent = "No documents uploaded yet.";
    list.appendChild(empty);
  } else {
    documents.forEach((doc) => {
      const item = document.createElement("div");
      item.className = "documentItem";

      const left = document.createElement("div");
      left.className = "docLeft";
      const svg2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      svg2.setAttribute("width", "20");
      svg2.setAttribute("height", "20");
      svg2.setAttribute("viewBox", "0 0 24 24");
      svg2.setAttribute("fill", "none");
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute(
        "d",
        "M3 7C3 5.89543 3.89543 5 5 5H9L11 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z",
      );
      p.setAttribute("stroke", "currentColor");
      p.setAttribute("stroke-width", "2");
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      svg2.appendChild(p);
      const info = document.createElement("div");
      info.className = "docInfo";
      const titleEl = document.createElement("div");
      titleEl.className = "docTitle";
      titleEl.textContent = doc.title;
      const meta = document.createElement("div");
      meta.className = "docMeta";
      meta.textContent = `${(doc.size_bytes / 1024).toFixed(1)} KB • ${doc.mime_type}`;
      info.appendChild(titleEl);
      info.appendChild(meta);
      left.appendChild(svg2);
      left.appendChild(info);

      const downloadBtn = document.createElement("button");
      downloadBtn.classList.add("docDownloadBtn", "docAction");
      downloadBtn.textContent = "Download";
      downloadBtn.dataset.path = doc.storage_path;

      const viewBtn = document.createElement("button");
      viewBtn.classList.add("docViewBtn", "docAction");
      viewBtn.textContent = "View";
      viewBtn.dataset.path = doc.storage_path;

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.classList.add("danger", "docDeleteBtn", "docAction");
      deleteBtn.dataset.path = doc.storage_path;

      item.appendChild(left);
      if (doc.uploaded_by === currentUser.id) {
        item.append(viewBtn, downloadBtn, deleteBtn);
      } else {
        item.append(viewBtn, downloadBtn);
      }
      list.appendChild(item);
    });
  }

  await handleDocUpload(uploadBtn, fileInput, container);
  deleteWorkspaceDoc();

  // Attach global document download/view listeners only once
  if (!docEventListenersAttached) {
    handleFileDownload(container);
    docEventListenersAttached = true;
  }
}

// Re fetches the document list for the current workspace and re renders
// this section. Kept local to this module instead of calling the top
// level renderSection dispatcher, since render.js imports loadDocuments
// from here already and importing renderSection back into this file
// would create a circular import between documents.js and render.js.
async function refreshDocuments(container) {
  const workspace = getCurrentWorkspace();
  const { data: docs } = await supabase
    .from("workspace_documents")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  await loadDocuments(docs || [], container, workspace);
}

function deleteWorkspaceDoc() {
  document.querySelectorAll(".docDeleteBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const path = btn.dataset.path;
      if (!path) return;
      confirmAction("Are you sure you want to delete this document?", [
        { label: "Cancel", type: "cancel" },
        {
          label: "Delete",
          type: "confirm",
          onClick: () => handleDocDelete(path, btn),
        },
      ]);
    });
  });
}

async function handleDocDelete(path, btn) {
  try {
    const { error: storageErr } = await supabase.storage
      .from("workspace-documents")
      .remove([path]);
    if (storageErr) {
      console.error("Storage delete error:", storageErr);
      actionMsg("Failed to delete file from storage.", "error");
      return;
    }
    const { error: dbErr } = await supabase
      .from("workspace_documents")
      .delete()
      .eq("storage_path", path);
    if (dbErr) {
      console.error("DB delete error:", dbErr);
      actionMsg("File removed from storage but DB row failed.", "warning");
      return;
    }
    btn.closest(".documentItem").remove();
    actionMsg("Document deleted successfully.", "success");
  } catch (err) {
    console.error("Delete handler error:", err);
    actionMsg("Unexpected error deleting document.", "error");
  }
}

async function handleDocUpload(uploadBtn, fileInput, container) {
  uploadBtn.addEventListener("click", () => fileInput.click());

  const {
    data: { session },
  } = await supabase.auth.getSession();

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    showUploadStatus("Uploading...", false, container);
    uploadBtn.disabled = true;
    uploadBtn.classList.add("disabled");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("workspace_id", getCurrentWorkspace().id);

      const res = await fetch(
        "https://qqactsebaxdottiiyrng.supabase.co/functions/v1/upload-document",
        {
          method: "POST",
          body: form,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );
      const data = await res.json();
      if (!res.ok) {
        showUploadStatus(data.error || "Upload failed", true, container);
      } else {
        showUploadStatus("Upload successful", false, container);
        await refreshDocuments(container);
      }
    } catch (err) {
      console.error(err);
      showUploadStatus(`Unexpected error: ${err}`, true, container);
    } finally {
      fileInput.value = "";
      uploadBtn.disabled = false;
      uploadBtn.classList.remove("disabled");
    }
  });
}

function handleFileDownload(container) {
  document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("docViewBtn")) {
      const path = e.target.dataset.path;
      if (!path) return;
      try {
        const { data, error } = await supabase.storage
          .from("workspace-documents")
          .createSignedUrl(path, 60);
        if (error) {
          showUploadStatus("Download failed", true, container);
          return;
        }
        window.open(data.signedUrl, "_blank");
      } catch (err) {
        showUploadStatus("Unexpected download error", true, container);
      }
    }

    if (e.target.classList.contains("docDownloadBtn")) {
      const path = e.target.dataset.path;
      if (!path) return;
      showUploadStatus("Downloading...", false, container);
      try {
        const { data, error } = await supabase.storage
          .from("workspace-documents")
          .createSignedUrl(path, 60);
        if (error || !data?.signedUrl) {
          showUploadStatus("Download failed", true, container);
          return;
        }
        const response = await fetch(data.signedUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = path.split("/").pop();
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showUploadStatus("Download successful", false, container);
      } catch (err) {
        showUploadStatus("Unexpected download error", true, container);
      }
    }
  });
}
