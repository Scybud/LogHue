import { supabase } from "../supabase.js";
import { confirmAction, actionMsg, openUpgradeModal } from "../utils/modals.js";
import { sanitizeHTML } from "../utils.js";
import { setButtonLoading } from "https://scybud.github.io/scybud-ui/js/ui.js";
import { fetchNoteById } from "../data/notesDb.js";
import { formatDateTimeRelatively } from "../utils/time.js";
import { sessionState } from "../session.js";

/*
--------------------------------
GLOBAL STATE
--------------------------------
*/
let quill = null;
let currentNoteId = null;
let savedNoteDetails = [];
let isLoading = false;
let isSaving = false;
let lastSavedSnapshot = "";
let autosaveTimer = null;

const AUTOSAVE_DELAY = 1500;

// -------------------------------
// Loading State
// -------------------------------
function setLoading(state) {
  isLoading = state;
  const notesContainer = document.querySelector(".notesContainer");
  notesContainer?.classList.toggle("isLoading", state);
}

function setSaveStatus(text) {
  const el = document.getElementById("saveStatus");
  if (el) el.textContent = text;
}

/*
--------------------------------
AUTOSAVE
--------------------------------
*/
function scheduleAutosave() {
  clearAutosaveTimer();
  autosaveTimer = setTimeout(runAutosave, AUTOSAVE_DELAY);
}

function clearAutosaveTimer() {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
}

async function runAutosave() {
  if (isSaving || !quill) return;

  const titleInput = document.getElementById("noteTitle");
  if (!titleInput) return;

  const title = titleInput.value;
  const content = sanitizeHTML(quill.root.innerHTML);
  const snapshot = title + content;

  if (snapshot === lastSavedSnapshot) return;

  isSaving = true;
  setSaveStatus("Saving…");

  try {
    const { error, created } = await persistNote(title, content);

    if (error) {
      console.error(error);
      setSaveStatus("Autosave failed");
      return;
    }

    lastSavedSnapshot = snapshot;
    setSaveStatus("Saved");

    if (created) {
      await refreshSidebarOnly();
    } else {
      updateSidebarEntry(currentNoteId, title, content);
    }
  } finally {
    isSaving = false;
  }
}

/*
--------------------------------
INITIALIZE NOTES UI
--------------------------------
*/
async function initNotes() {
  setLoading(true);

  const params = new URLSearchParams(window.location.search);
  const noteId = params.get("note");
  const forceNew = params.get("new") === "1";

  const editorContainer = document.getElementById("editorContainer");

  if (!editorContainer) {
    setLoading(false);
    return;
  }

  editorContainer.innerHTML = `
    <div class="editorTop">
      <input id="noteTitle" name="noteTitle" placeholder="Note title" class="noteTitle inputField" />
      <div class="actionBtnsContainer">
        <span id="saveStatus" class="saveStatus"></span>
        <button id="saveNoteBtn" class="btn-sm btn notesActionBtn">Save</button>
        <select id="exportNotesBtn" class="btn-sm btn btn-secondary notesActionBtn">
          <option value="">Export As</option>
          <option value="pdf">PDF</option>
          <option value="docx">DOCX</option>
          <option value="html">HTML</option>
          <option value="txt">TXT</option>
          <option value="md">Markdown</option>
        </select>
      </div>
    </div>
    <div id="editor"></div>
  `;

  const Font = Quill.import("formats/font");
  Font.whitelist = ["sans serif", "serif"];
  Quill.register(Font, true);

  quill = new Quill("#editor", {
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        [{ font: Font.whitelist }],
        ["bold", "italic", "underline", "link"],
        [
          { list: "ordered" },
          { list: "bullet" },
          { list: "check" },
          { align: [] },
        ],
        ["image"],
        ["code-block"],
      ],
    },
    placeholder: "Create your first note...",
    theme: "snow",
  });

  const toolbar = quill.getModule("toolbar");

  toolbar.addHandler("link", function () {
    const range = quill.getSelection();
    if (!range) return;

    if (range.length === 0) {
      const url = prompt("Enter URL:");
      if (url) {
        quill.insertText(range.index, url, "link", url);
        quill.setSelection(range.index + url.length, 0);
      }
      return;
    }

    const value = prompt("Enter URL:");
    if (value) {
      quill.format("link", value);
    }
  });

  attachDeleteNoteListener();

  const saveBtn = document.getElementById("saveNoteBtn");
  saveBtn.addEventListener("click", saveNote);

  const exportSelect = document.getElementById("exportNotesBtn");
  exportSelect.addEventListener("change", (e) => {
    const type = e.target.value;
    if (!type) return;
    exportCurrentNote(type);
    e.target.value = "";
  });

  quill.on("text-change", (delta, oldDelta, source) => {
    if (source !== "user") return;
    scheduleAutosave();
  });

  document
    .getElementById("noteTitle")
    .addEventListener("input", scheduleAutosave);

  try {
    const createdFromDraft = await loadCreateNote();
    if (!createdFromDraft) {
      if (forceNew) {
        await createNote();
      } else {
        await loadNotes(noteId);
      }
    }
  } finally {
    setLoading(false);
  }
}

initNotes();

async function loadCreateNote() {
  const savedText = localStorage.getItem("createNote");
  if (!savedText) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data, error } = await supabase
    .from("personal_notes")
    .insert({
      user_id: user.id,
      title: "Untitled",
      content: sanitizeHTML(savedText),
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return false;
  }

  actionMsg("Note created", "success");
  document.dispatchEvent(new CustomEvent("onboarding:note_created", {
    detail: { noteId: data.id },
  }));
  localStorage.removeItem("createNote");

  await loadNotes();
  openNote(data);

  return true;
}

/*
--------------------------------
LOAD USER NOTES
--------------------------------
*/
async function fetchUserNotes() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("User not authenticated");
    return null;
  }

  const { data: notes, error } = await supabase
    .from("personal_notes")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error);
    return null;
  }

  return notes || [];
}

async function loadNotes(noteId) {
  const notes = await fetchUserNotes();
  if (notes === null) return;

  savedNoteDetails = notes;
  renderNotesList(notes);

  if (noteId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await openNoteById(noteId, user.id);
  } else if (notes.length > 0) {
    openNote(notes[0]);
  } else {
    currentNoteId = null;
    clearAutosaveTimer();
    lastSavedSnapshot = "";
    setSaveStatus("");

    const titleInput = document.getElementById("noteTitle");
    if (titleInput) titleInput.value = "";
    if (quill) {
      quill.root.innerHTML = "";
      quill.root.setAttribute("data-placeholder", "Create your first note...");
    }
  }
}

async function refreshSidebarOnly() {
  const notes = await fetchUserNotes();
  if (notes === null) return;

  savedNoteDetails = notes;
  renderNotesList(notes);
}

/*
--------------------------------
HELPERS
--------------------------------
*/
function getPlainPreview(html, maxLength = 60) {
  if (!html) return "";
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
}

/*
--------------------------------
RENDER NOTES LIST
--------------------------------
*/
function renderNotesList(notes) {
  const notesList = document.getElementById("notesList");
  const notesCount = document.getElementById("notesCount");

  if (!notesList) return;

  notesList.innerHTML = "";

  if (notesCount) {
    notesCount.textContent = notes.length;
  }

  if (notes.length === 0) {
    notesList.innerHTML = `<p class="placeholderText">No notes created yet.</p>`;
    return;
  }

  notes.forEach((note) => {
    const item = document.createElement("div");
    item.classList.add("noteItem");
    item.dataset.id = note.id;

    const content = document.createElement("div");
    content.classList.add("noteItemContent");

    const titleEl = document.createElement("p");
    titleEl.classList.add("noteTitle");
    titleEl.textContent = note.title || "Untitled";

    const previewEl = document.createElement("span");
    previewEl.classList.add("notePreview");
    previewEl.textContent = getPlainPreview(note.content);

    const metaEl = document.createElement("span");
    metaEl.classList.add("noteMeta");
    metaEl.textContent = formatDateTimeRelatively(note.updated_at);

    content.append(titleEl, previewEl, metaEl);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.classList.add("deleteBtn", "tooltip");
    deleteBtn.setAttribute("data-title", "Delete note");
    deleteBtn.setAttribute("aria-label", "Delete note");
    deleteBtn.title = "Delete note";
    deleteBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4h6v2" />
      </svg>
    `;

    item.append(content, deleteBtn);
    item.onclick = () => openNote(note);

    notesList.appendChild(item);
  });

  highlightActiveNote(currentNoteId);
}

function highlightActiveNote(id) {
  document.querySelectorAll(".noteItem").forEach((el) => {
    el.classList.toggle("active", String(el.dataset.id) === String(id));
  });
}

/*
--------------------------------
OPEN NOTE IN EDITOR
--------------------------------
*/
async function openNoteById(noteId, userId) {
  const noteData = await fetchNoteById(noteId, userId);

  clearAutosaveTimer();
  currentNoteId = noteData.id;

  const title = noteData.title || "Untitled";
  const content = sanitizeHTML(noteData.content || "");

  document.getElementById("noteTitle").value = title;
  quill.root.innerHTML = content;

  lastSavedSnapshot = title + content;
  setSaveStatus("");
  highlightActiveNote(noteData.id);
}

function openNote(note) {
  clearAutosaveTimer();
  currentNoteId = note.id;

  const title = note.title || "Untitled";
  const content = sanitizeHTML(note.content || "");

  document.getElementById("noteTitle").value = title;
  quill.root.innerHTML = content;

  lastSavedSnapshot = title + content;
  setSaveStatus("");
  highlightActiveNote(note.id);
}

/*
--------------------------------
CREATE NOTE
--------------------------------
*/
async function createNote() {
  setLoading(true);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("personal_notes")
      .insert({
        user_id: user.id,
        title: "Untitled",
        content: "",
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      actionMsg("Failed to create note.", "error");
      return;
    }

    await loadNotes();
    openNote(data);

    document.dispatchEvent(new CustomEvent("onboarding:note_created", {
      detail: { noteId: data.id },
    }));

    actionMsg("Note created. Start typing!", "success");
  } finally {
    setLoading(false);
  }
}

document.getElementById("createNote").addEventListener("click", () => {
  createNote();
});

/*
--------------------------------
SAVE NOTE
--------------------------------
*/
async function persistNote(title, content) {
  if (!currentNoteId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error("Not authenticated") };
    }

    const { data, error } = await supabase
      .from("personal_notes")
      .insert({
        user_id: user.id,
        title: title || "Untitled",
        content,
      })
      .select()
      .single();

    if (error) return { error };

    currentNoteId = data.id;

    // Covers both the explicit Save button and the very first
    // autosave — this is the single point where a note first
    // actually exists in the database.
    document.dispatchEvent(new CustomEvent("onboarding:note_created", {
      detail: { noteId: data.id },
    }));

    return { data, created: true };
  }

  const { error } = await supabase
    .from("personal_notes")
    .update({
      title,
      content,
      updated_at: new Date(),
    })
    .eq("id", currentNoteId);

  if (error) return { error };
  return { created: false };
}

function updateSidebarEntry(id, title, content = null) {
  if (!id) return;

  const item = document.querySelector(`.noteItem[data-id="${id}"]`);
  if (!item) return;

  const titleEl = item.querySelector(".noteTitle");
  if (titleEl) titleEl.textContent = title || "Untitled";

  if (content !== null) {
    const previewEl = item.querySelector(".notePreview");
    if (previewEl) previewEl.textContent = getPlainPreview(content);

    const metaEl = item.querySelector(".noteMeta");
    if (metaEl) metaEl.textContent = "Just now";
  }

  const cached = savedNoteDetails.find(
    (note) => String(note.id) === String(id),
  );
  if (cached) {
    cached.title = title;
    if (content !== null) cached.content = content;
    cached.updated_at = new Date().toISOString();
  }
}

async function saveNote() {
  if (isSaving) return;

  const saveBtn = document.getElementById("saveNoteBtn");
  isSaving = true;
  setButtonLoading(saveBtn, true);
  clearAutosaveTimer();

  const title = document.getElementById("noteTitle").value;
  const content = sanitizeHTML(quill.root.innerHTML);

  try {
    const { error } = await persistNote(title, content);

    if (error) {
      console.error(error);
      actionMsg("Failed to save note.", "error");
      return;
    }

    lastSavedSnapshot = title + content;
    setSaveStatus("Saved");

    await loadNotes();
    actionMsg("Note saved successfully!", "success");
  } finally {
    isSaving = false;
    setButtonLoading(saveBtn, false);
  }
}

function attachDeleteNoteListener() {
  const notesList = document.getElementById("notesList");
  if (!notesList) return;

  notesList.addEventListener("click", (e) => {
    const btn = e.target.closest(".deleteBtn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const noteToDelete = btn.closest(".noteItem");
    const id = noteToDelete.dataset.id;

    confirmAction("Delete Note", "Delete this note?", [
      { label: "Cancel", type: "cancel" },
      {
        label: "Delete",
        type: "confirm",
        onClick: () => attachDeleteNoteEvent(noteToDelete, id),
      },
    ]);
  });
}

/*
--------------------------------
EXPORT
--------------------------------
*/
/*
--------------------------------
HTML TO MARKDOWN
--------------------------------
*/
function htmlToMarkdown(html) {
  const container = document.createElement("div");
  container.innerHTML = html;

  function walk(node) {
    let out = "";

    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent;
        return;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) return;

      const tag = child.tagName.toLowerCase();
      const inner = walk(child);

      switch (tag) {
        case "h1":
          out += `\n# ${inner.trim()}\n\n`;
          break;
        case "h2":
          out += `\n## ${inner.trim()}\n\n`;
          break;
        case "h3":
          out += `\n### ${inner.trim()}\n\n`;
          break;
        case "h4":
          out += `\n#### ${inner.trim()}\n\n`;
          break;
        case "h5":
          out += `\n##### ${inner.trim()}\n\n`;
          break;
        case "h6":
          out += `\n###### ${inner.trim()}\n\n`;
          break;
        case "strong":
        case "b":
          out += `**${inner}**`;
          break;
        case "em":
        case "i":
          out += `*${inner}*`;
          break;
        case "u":
          out += `_${inner}_`;
          break;
        case "s":
        case "strike":
          out += `~~${inner}~~`;
          break;
        case "a":
          out += `[${inner}](${child.getAttribute("href") || ""})`;
          break;
        case "code":
          out += `\`${inner}\``;
          break;
        case "pre":
          out += `\n\`\`\`\n${inner.trim()}\n\`\`\`\n\n`;
          break;
        case "blockquote":
          out += `\n> ${inner.trim()}\n\n`;
          break;
        case "li": {
          const isChecklist = child.classList.contains("ql-indent-0") && child.dataset.list;
          const parent = child.parentElement;
          const isOrdered = parent && parent.tagName.toLowerCase() === "ol";

          if (child.dataset.list === "checked") {
            out += `- [x] ${inner.trim()}\n`;
          } else if (child.dataset.list === "unchecked") {
            out += `- [ ] ${inner.trim()}\n`;
          } else if (isOrdered) {
            out += `1. ${inner.trim()}\n`;
          } else {
            out += `- ${inner.trim()}\n`;
          }
          break;
        }
        case "ol":
        case "ul":
          out += `\n${inner}\n`;
          break;
        case "p":
          out += `${inner.trim()}\n\n`;
          break;
        case "br":
          out += `\n`;
          break;
        case "img":
          out += `![](${child.getAttribute("src") || ""})`;
          break;
        default:
          out += inner;
      }
    });

    return out;
  }

  return walk(container)
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


function exportFile(filename, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

async function exportCurrentNote(type) {
  setLoading(true);

  if (!currentNoteId) {
    setLoading(false);
    actionMsg("Save the note before exporting.", "error");
    return;
  }

  const title = document.getElementById("noteTitle").value || "Untitled";
  const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const htmlContent = quill.root.innerHTML;
  const plainText = quill.getText();

 const planName = (sessionState?.plan?.name || "").toLowerCase();

 let didExport = false;

  switch (type) {
    case "html": {
      if (planName === "free") {
        await openUpgradeModal("exportHtml");
        setLoading(false);
        return;
      }

      const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link href="https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css" rel="stylesheet">
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    .ql-editor { line-height: 1.6; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="ql-editor">${htmlContent}</div>
</body>
</html>`;
      exportFile(`${safeTitle}.html`, fullHTML, "text/html");
      didExport = true;
      break;
    }

    case "txt":
      exportFile(`${safeTitle}.txt`, plainText, "text/plain");
      didExport = true;
      break;

    case "md": {
      const markdown = htmlToMarkdown(htmlContent);
      exportFile(`${safeTitle}.md`, markdown, "text/markdown");
      didExport = true;
      break;
    }

    case "docx": {
      if (planName === "free") {
        await openUpgradeModal("exportDocx");
        setLoading(false);
        return;
      }
      const { Document, Packer, Paragraph } = window.docx;
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [new Paragraph({ text: plainText })],
          },
        ],
      });
      Packer.toBlob(doc).then((blob) => {
        saveAs(blob, `${safeTitle}.docx`);
      });
      didExport = true;
      break;
    }

    case "pdf": {
      if (planName === "free") {
        await openUpgradeModal("exportPdf");
        setLoading(false);
        return;
      }

      const cleanHTML = htmlContent.replace(/&nbsp;/g, " ");
      const wrapper = document.createElement("div");
      wrapper.style.width = "210mm";
      wrapper.style.padding = "20mm";
      wrapper.style.background = "#fff";
      wrapper.style.fontFamily = "Arial, sans-serif";
      wrapper.style.fontSize = "12px";
      wrapper.style.lineHeight = "1.6";

      wrapper.innerHTML = `
        <style>
          .pdf-container, .pdf-container *, .pdf-container p, .pdf-container span {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
          }
          .pdf-container h1 {
            text-align: center;
            margin-bottom: 20px;
            color: #000000 !important;
          }
        </style>
        <div class="pdf-container">
          <h1>${title}</h1>
          <div>${cleanHTML}</div>
        </div>
      `;

      document.body.appendChild(wrapper);

      setTimeout(() => {
        html2pdf()
          .set({
            margin: 0,
            filename: `${safeTitle}.pdf`,
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            pagebreak: { mode: ["css", "legacy"] },
          })
          .from(wrapper)
          .save()
          .catch((err) => {
            console.error(err);
            actionMsg("Failed to export PDF.", "error");
          })
          .finally(() => {
            if (wrapper.parentNode) document.body.removeChild(wrapper);
          });
      }, 300);

      didExport = true;
      break;
    }

    default:
      setLoading(false);
      actionMsg("Invalid export type.", "error");
      return;
  }

  if (didExport) {
    setLoading(false);
    actionMsg("Note exported!", "success");
  }
}

/*
--------------------------------
DELETE
--------------------------------
*/
async function attachDeleteNoteEvent(noteToDelete, id) {
  setLoading(true);

  if (String(id) === String(currentNoteId)) {
    clearAutosaveTimer();
  }

  const { error } = await supabase.from("personal_notes").delete().eq("id", id);

  if (error) {
    setLoading(false);
    console.error(error);
    actionMsg(error.message, "error");
    return;
  }

  const index = savedNoteDetails.findIndex(
    (note) => String(note.id) === String(id),
  );
  if (index !== -1) savedNoteDetails.splice(index, 1);

  noteToDelete.classList.add("removing");

  await loadNotes();

  setTimeout(() => {
    noteToDelete.remove();
  }, 400);

  setLoading(false);
  actionMsg("Note deleted successfully!", "success");
}