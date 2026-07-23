import { attachSidebarEvents } from "../components/sidebar.js";
import { supabase } from "../supabase.js";
import { closeModal } from "../ui.js";
import {
  actionMsg,
  confirmAction,
  openLogTaskModal,
  openStartDiscussionModal,
} from "../utils/modals.js";
import { sessionState } from "../session.js";
import { navDropdowns } from "../components/sidebar.js";
import { showUploadStatus } from "../shared/workspace/utils.js";
import { formatDateTime } from "../utils/time.js";
import { loadApiKeys } from "../shared/workspace/api.js";

export let currentWorkspace = null;
export let loadedMembers = [];
let currentUser = null;
let isLoading = false;

function setLoading(state, container) {
  isLoading = state;

  container?.classList.toggle("isLoading", state);
}
// -----------------------------
// NAVIGATION
// -----------------------------
// Loading State

const container = document.getElementById("memberWorkspaceDashboardContent");
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".navBtn");
  if (!btn) return;
  const section = btn.dataset.section;

  setLoading(true, container);

  try {
    await new Promise(requestAnimationFrame);
    await renderSection(section, currentWorkspace, container);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false, container);
  }
});

// -----------------------------
// MEMBER ACCESS CHECK
// -----------------------------
async function checkMemberAccess(workspaceId) {
  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", (await supabase.auth.getUser()).data.user.id)
    .single();

  if (error || membership.role !== "member") {
    actionMsg("Access Denied: You cannot access this workspace.", "error");
    window.location.href = "dashboard";
  }
}

// -----------------------------
// INITIALIZATION
// -----------------------------
export async function initMemberWorkspaceData() {
  const params = new URLSearchParams(window.location.search);
  const workspaceId = params.get("ws");

  if (!workspaceId) {
    window.location.href = "dashboard";
    return;
  }

  await checkMemberAccess(workspaceId);

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      `*, 
       workspace_tasks(*, profiles:assigned_to (id, full_name, avatar_url)), 
       workspace_members(role, profiles (id, full_name, avatar_url, plan:plan_id (name)))`,
    )
    .eq("id", workspaceId)
    .single();

  if (error) {
    console.error(error);
    actionMsg(error.message);
    return;
  }

  if (!workspace || workspaceId.length < 10 || workspace.status === "closed") {
    window.location.href = "all-workspaces";
    return;
  }

  currentWorkspace = workspace;

  const container = document.getElementById("memberWorkspaceDashboardContent");
  const workspaceName = document.getElementById("workspaceName");

  if (workspaceName) {
    workspaceName.textContent = workspace.name;
  }
  document.title = `${workspace.name} | LogHue`;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (container) {
    container.innerHTML = "";

    //LOAD ASSIGNED TASKS BY DEFAULT
    const allMyTasks = workspace.workspace_tasks.filter(
      (t) => String(t.assigned_to) === String(user.id),
    );
    const myTasks = allMyTasks.filter((mt) => mt.status === "in progress");
    loadAssignedTasks("My Tasks", myTasks || [], container);
  }

  attachSidebarEvents();
  navDropdowns();

  loadedMembers = Array.isArray(workspace.workspace_members)
    ? workspace.workspace_members
    : [workspace.workspace_members];

  workspace.workspace_tasks = workspace.workspace_tasks || [];

  openStartDiscussionModal(currentWorkspace, user);
  openLogTaskModal(supabase, workspaceId, user.id);
}

// -----------------------------
// SECTION RENDERER
// -----------------------------
async function renderSection(section, workspace, container) {
  if (!container) return;
  container.innerHTML = "";

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;

  currentUser = userData.user;

  const allMyTasks = workspace.workspace_tasks.filter(
    (t) => String(t.assigned_to) === String(currentUser.id),
  );
  const myTasks = allMyTasks.filter((mt) => mt.status === "in progress");

  switch (section) {
    case "myTasks":
      loadAssignedTasks("My Tasks", myTasks, container);
      break;

    case "allTasks":
      loadAllTasks(workspace.workspace_tasks || [], container);
      break;

    case "members":
      loadMembers(loadedMembers, container);
      break;

    case "documents":
      const { data: docs, docsError } = await supabase
        .from("workspace_documents")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      await loadDocuments(docs || [], container);
      break;

    case "activities":
      const { data: logs, error } = await supabase
        .from("workspace_task_logs")
        .select(
          `
    *,
    profiles:created_by (full_name, avatar_url),
    workspace_tasks:task_id (title)
  `,
        )
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      const { data: actDcns, actDcnsError } = await supabase
        .from("discussions")
        .select(
          `
    *,
    profiles:created_by (full_name, avatar_url)
  `,
        )
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      const normalizedLogs = (logs || []).map((log) => ({
        id: log.id,
        type: "task_log",
        actor: log.profiles,
        title: log.workspace_tasks?.title,
        note: log.log_note,
        status: log.task_status,
        created_at: log.created_at,
      }));

      const normalizedDiscussions = (actDcns || []).map((d) => ({
        id: d.id,
        type: "discussion",
        actor: d.profiles,
        title: d.title,
        note: d.content,
        status: null,
        created_at: d.created_at,
      }));

      const activities = [...normalizedLogs, ...normalizedDiscussions].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );

      loadActivities(activities || [], container);
      break;

    case "discussions":
      //GET ALL DISCUSSIONS
      const { data: discussions, dcnError } = await supabase
        .from("discussions")
        .select(`*, profiles:created_by (full_name, avatar_url)`)
        .eq("workspace_id", workspace.id);
      if (dcnError) return actionMsg("Error loading discussions.", "error");

      const openDiscussions = discussions.filter((od) => od.status === "open");
      loadDiscussions(
        "Discussions",
        openDiscussions || [],
        container,
        "No discussion started yet.",
      );
      break;

    case "taskHistory":
      //Load data
      const taskHistory = allMyTasks.filter((ts) => ts.status === "completed");

      loadAssignedTasks("Tasks History", taskHistory || [], container);
      break;

    case "discussionHistory":
      {
        const { data: discussions, dcnError } = await supabase
          .from("discussions")
          .select(`*, profiles:created_by (full_name, avatar_url)`)
          .eq("workspace_id", workspace.id);

        if (dcnError) return actionMsg("Error loading discussions.", "error");

        const discussionHistory = discussions.filter(
          (dcns) => dcns.status === "closed",
        );

        loadDiscussions(
          "Discussions History",
          discussionHistory || [],
          container,
          "No discussion histories yet.",
        );
      }
      break;

    case "settings":
      loadSettings(container, workspace, currentUser.id);
      break;
  }
}

async function loadDocuments(documents, container, workspace) {
  container.innerHTML = "";

  const { data, userError } = await supabase.auth.getUser();
  const currentUser = data.user;

  // Title
  const title = document.createElement("h2");
  title.className = "sectionTitle";
  title.textContent = "Documents";

  // Upload button
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

  // Hidden file input
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.classList.add("hide");

  // Section header
  const sectionHeader = document.createElement("div");
  sectionHeader.classList.add("sectionHeader");
  sectionHeader.append(title, uploadBtn);

  container.appendChild(sectionHeader);
  container.appendChild(fileInput);

  // List wrapper
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

  // Attach upload logic
  await handleDocUpload(uploadBtn, fileInput, currentWorkspace, container);
  handleFileDownload();
  deleteWorkspaceDoc();
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
    // 1. Delete from storage
    const { error: storageErr } = await supabase.storage
      .from("workspace-documents")
      .remove([path]);

    if (storageErr) {
      console.error("Storage delete error:", storageErr);
      actionMsg("Failed to delete file from storage.", "error");
      return;
    }

    // 2. Delete metadata row
    const { error: dbErr } = await supabase
      .from("workspace_documents")
      .delete()
      .eq("storage_path", path);

    if (dbErr) {
      console.error("DB delete error:", dbErr);
      actionMsg("File removed from storage but DB row failed.", "warning");
      return;
    }

    // 3. Remove from UI
    btn.closest(".documentItem").remove();
    actionMsg("Document deleted successfully.", "success");
  } catch (err) {
    console.error("Delete handler error:", err);
    actionMsg("Unexpected error deleting document.", "error");
  }
}

async function handleDocUpload(uploadBtn, fileInput, workspace, container) {
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
      form.append("workspace_id", currentWorkspace.id);

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
        uploadBtn.disabled = false;
        uploadBtn.classList.remove("disabled");
        return;
      }

      showUploadStatus("Upload successful", false, container);
      uploadBtn.disabled = false;
      uploadBtn.classList.remove("disabled");

      // Refresh section
      renderSection("documents", workspace, container);
    } catch (err) {
      console.error(err);
      showUploadStatus(`Unexpected error: ${err}`, true, container);
      uploadBtn.disabled = false;
      uploadBtn.classList.remove("disabled");
    } finally {
      fileInput.value = "";
      uploadBtn.disabled = false;
      uploadBtn.classList.remove("disabled");
    }
  });
}

function handleFileDownload() {
  document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("docViewBtn")) return;

    const path = e.target.dataset.path;
    if (!path) return;

    try {
      const { data, error } = await supabase.storage
        .from("workspace-documents")
        .createSignedUrl(path, 60); // 60 seconds

      if (error) {
        showUploadStatus("Download failed", true);
        return;
      }

      // Open file in new tab
      window.open(data.signedUrl, "_blank");
    } catch (err) {
      showUploadStatus("Unexpected download error", true);
    }
  });

  document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("docDownloadBtn")) return;

    showUploadStatus("Downloading...", false, container);

    const path = e.target.dataset.path;
    if (!path) return;

    try {
      const { data, error } = await supabase.storage
        .from("workspace-documents")
        .createSignedUrl(path, 60);

      if (error || !data?.signedUrl) {
        showUploadStatus("Download failed", true);
        return;
      }

      // Fetch file as blob
      const response = await fetch(data.signedUrl);
      const blob = await response.blob();

      // Create a forced download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = path.split("/").pop(); // filename
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showUploadStatus("Download successful", false);
    } catch (err) {
      showUploadStatus("Unexpected download error", true);
    }
  });
}

async function loadSettings(container, workspace, currentUserId) {
  container.innerHTML = "";

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "Workspace Settings";

  // -------------------------
  // WORKSPACE INFO CARD
  // -------------------------
  const infoCard = document.createElement("div");
  infoCard.classList.add("card", "workspaceInfoCard");

  const owner = workspace.workspace_members.find((m) => m.role === "owner");

  infoCard.innerHTML = `
    <h3>Workspace Info</h3>
    <p><strong>Name:</strong> ${workspace.name}</p>
    <p><strong>Description:</strong> ${workspace.description}</p>
    <div><strong>Workspace ID:</strong> <div class=workspaceIdContainer><input class="inputField workspaceId" readonly value="${workspace.id}"> <button class="copyBtn" title="Copy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="10" height="10" rx="2"
              stroke="currentColor" stroke-width="2"/>
            <rect x="5" y="5" width="10" height="10" rx="2"
              stroke="currentColor" stroke-width="2"/>
          </svg>
        </button></div></div>
    <p><strong>Owner:</strong> ${owner?.profiles.full_name || "Unknown"}</p>
  `;

  infoCard.querySelector(".copyBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const target = document.querySelector(".workspaceId").value;
    navigator.clipboard.writeText(target);
    actionMsg("Copied to clipboard!", "success");
  });

  // -------------------------
  // API KEYS CARD
  // -------------------------
  const apiCard = document.createElement("div");
  apiCard.classList.add("card");

  apiCard.innerHTML = `
    <h3>API Keys</h3>
<p class="mutedText">Only admins and owner can create API Keys.</p>

    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Prefix</th>
          <th>Created</th>
          <th>Last Used</th>
          <th>Status</th>
          <th>Permissions</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="apiKeysTable"></tbody>
    </table>
  `;

  loadApiKeys(apiCard.querySelector("#apiKeysTable"), workspace.id);

  section.append(title, infoCard, apiCard);

  container.append(section);
}

export function loadDiscussions(
  sectionTitle,
  discussions,
  container,
  emptyStateText,
) {
  if (!discussions || discussions.length === 0) {
    container.innerHTML = `<p class="placeholderText">${emptyStateText}</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = sectionTitle;

  const divGrid = document.createElement("div");
  divGrid.classList.add("container");

  discussions.forEach((dcn) => {
    const discussionCard = document.createElement("div");
    discussionCard.classList.add("card", "discussionCard");
    discussionCard.dataset.id = dcn.id; // IMPORTANT

    // Make card clickable
    discussionCard.addEventListener("click", () => {
      window.location.href = `discussion-view?dcn=${dcn.id}`;
    });

    const dcnHeader = document.createElement("div");
    dcnHeader.classList.add("discussionHeader");

    const img = document.createElement("img");
    img.classList.add("profileImg");
    img.src =
      dcn.profiles?.avatar_url ||
      "https://loghue.com/assets/images/default_profile.png";

    const span = document.createElement("span");
    span.classList.add("actorName");
    span.textContent = dcn.profiles?.full_name || "Unknown User";

    dcnHeader.append(img, span);

    const dcnTitle = document.createElement("h3");
    dcnTitle.classList.add("taskTitle");
    dcnTitle.textContent = dcn.title;

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Content";

    const descriptionText = document.createElement("p");
    descriptionText.textContent = dcn.content;

    details.append(summary, descriptionText);

    const creator = document.createElement("p");
    creator.classList.add("meta");
    creator.textContent = dcn.profiles?.full_name || "Unknown User";

    const createdOn = document.createElement("p");
    createdOn.classList.add("meta");
    createdOn.textContent = formatDateTime(dcn.created_at);

    const dcnMeta = document.createElement("div");
    dcnMeta.classList.add("dcnMeta");
    dcnMeta.append(createdOn);

    const viewBtn = document.createElement("button");
    viewBtn.classList.add("btn", "btn-sm", "btn-primary");
    viewBtn.textContent = "Open";

    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `discussion-view?dcn=${dcn.id}`;
    });

    details.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    discussionCard.append(dcnHeader, dcnMeta, dcnTitle, details, viewBtn);
    divGrid.append(discussionCard);
  });

  section.append(title, divGrid);
  container.append(section);
}

// -----------------------------
// MY TASKS LIST
// -----------------------------
export function loadAssignedTasks(sectionTitle, tasks, container) {
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<p class="placeholderText">No tasks assigned yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = sectionTitle;

  const grid = document.createElement("div");
  grid.classList.add("container");

  tasks.forEach((tsk) => {
    const card = document.createElement("div");
    card.classList.add("taskCard");

    const taskTitle = document.createElement("h3");
    taskTitle.textContent = tsk.title;

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Description";

    const desc = document.createElement("p");
    desc.textContent = tsk.description;

    details.append(summary, desc);

    const meta = document.createElement("div");
    meta.classList.add("taskMeta");

    const assignee = document.createElement("p");
    assignee.classList.add("meta");
    assignee.textContent = tsk.assigned_to ? `Assigned to: Me` : "Unassigned";

    const assignedOn = document.createElement("p");
    assignedOn.classList.add("meta");
    assignedOn.textContent = `Assigned on: ${formatDateTime(tsk.created_at)}`;

    meta.append(assignee, assignedOn);

    const viewBtn = document.createElement("button");
    viewBtn.classList.add("btn", "btn-sm", "btn-primary");
    viewBtn.textContent = "View Task";

    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `task-view?task=${tsk.id}`;
    });

    details.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    card.append(taskTitle, meta, details, viewBtn);
    grid.append(card);
  });

  section.append(title, grid);
  container.append(section);
}

// -----------------------------
// TASK LIST (READ‑ONLY)
// -----------------------------
export function loadAllTasks(tasks, container) {
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<p class="placeholderText">No tasks created yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "All Tasks";

  const grid = document.createElement("div");
  grid.classList.add("container");

  tasks.forEach((tsk) => {
    const card = document.createElement("div");
    card.classList.add("taskCard");

    const taskTitle = document.createElement("h3");
    taskTitle.textContent = tsk.title;

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Description";

    const desc = document.createElement("p");
    desc.textContent = tsk.description;

    details.append(summary, desc);

    const meta = document.createElement("div");
    meta.classList.add("taskMeta");

    const assignee = document.createElement("p");
    assignee.classList.add("meta");
    assignee.textContent = tsk.assigned_to
      ? `Assigned to: ${tsk.profiles.full_name}`
      : "Unassigned";

    const assignedOn = document.createElement("p");
    assignedOn.classList.add("meta");
    assignedOn.textContent = `Assigned on: ${formatDateTime(tsk.created_at)}`;

    meta.append(assignee, assignedOn);

    card.append(taskTitle, meta, details);
    grid.append(card);
  });

  section.append(title, grid);
  container.append(section);
}

// -----------------------------
// MEMBERS LIST (READ‑ONLY)
// -----------------------------
function loadMembers(members, container) {
  if (!members || members.length === 0) {
    container.innerHTML = `<p class="placeholderText">No members found.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "Workspace Members";

  const grid = document.createElement("div");
  grid.classList.add("grid");

  members.forEach((mbr) => {
    const card = document.createElement("div");
    card.classList.add("card", "memberCard");

    const name = document.createElement("h3");
    name.classList.add("memberName");
    name.textContent = mbr.profiles.full_name;

    const tag = document.createElement("span");
    tag.classList.add("tag");
    tag.textContent = mbr.role;

    const avatar = document.createElement("img");
    avatar.classList.add("profileImg");
    avatar.src = mbr.profiles.avatar_url;

    const profileAvatarContainer = document.createElement("div");
    profileAvatarContainer.classList.add(
      "profileAvatarContainer",
      `${mbr.profiles.plan.name}`,
    );
    profileAvatarContainer.append(avatar);

    const header = document.createElement("div");
    header.classList.add("cardHeader");
    header.append(tag, profileAvatarContainer, name);
    header.title = `${mbr.profiles.plan.name} plan member`;

    card.append(header);
    grid.append(card);
  });

  section.append(title, grid);
  container.append(section);
}

// -----------------------------
// ACTIVITIES (READ‑ONLY)
// -----------------------------
export function loadActivities(activities, container) {
  if (sessionState.plan.name === "free" || sessionState.plan.name === "Free") {
    container.innerHTML = `<p class="placeholderText">Workspace activities overview is not available on your current plan. <a href="https://loghue.com/pricing" target="_blank" rel="noopener">Upgrade</a> to see what is happening in your workspace at a glance.</p>`;
    return;
  }

  if (!activities || activities.length === 0) {
    container.innerHTML = `<p class="placeholderText">No activity in this workspace yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "Activities";

  const list = document.createElement("div");
  list.classList.add("activityList");

  activities.forEach((item) => {
    const actor = item.actor;
    const avatar =
      actor?.avatar_url || "https://loghue.com/assets/default-avatar.png";
    const name = actor?.full_name || "Unknown User";

    const label =
      item.type === "task_log"
        ? `gave an update on "${item.title || "Unknown Task"}"`
        : `started a discussion "${item.title || "Untitled"}"`;

    const body =
      item.type === "task_log"
        ? `
        <p><strong>Note:</strong> ${item.note}</p>
        <p><strong>Status:</strong> ${item.status}</p>
      `
        : `
        <p><strong>Message:</strong> ${item.note}</p>
      `;

    const openBtn =
      item.type === "discussion"
        ? `
        <a class="btn pageOpenLink btn-sm btn-secondary"
           href="https://app.loghue.com/discussion-view?dcn=${item.id}">
           Open
        </a>
      `
        : `<a class="btn pageOpenLink btn-sm btn-secondary"
           href="https://app.loghue.com/task-view?dcn=${item.id}">
           Open
        </a>`;

    const div = document.createElement("div");
    div.classList.add("activityItem");

    div.innerHTML = `
    <div class="activityHeader">
      <img class="profileImg" src="${avatar}" />
      <span class="actorName">${name} ${label}</span>
    </div>

    <div class="activityBody">${body}</div>

    <div class="activityTime">
      ${new Date(item.created_at).toLocaleString()}
      ${openBtn}
    </div>
  `;

    list.appendChild(div);
  });

  section.append(title, list);
  container.append(section);
}

