import { supabase } from "../supabase.js";
import { confirmAction, actionMsg } from "../utils/modals.js";
import { sanitizeHTML } from "../utils.js";
/*
--------------------------------
GLOBAL STATE
--------------------------------
*/
let quill = null;
let currentNoteId = null;
let savednoteDetails = [];
let isLoading = false;

// -------------------------------
// Loading State
// -------------------------------
function setLoading(state) {
  isLoading = state;

  const notesContainer = document.querySelector(".notesContainer");

  notesContainer?.classList.toggle("isLoading", state);
}

/*
--------------------------------
INITIALIZE NOTES UI
--------------------------------
*/
function initNotes() {
  setLoading(true);

  const editorContainer = document.getElementById("editorContainer");

  // Safety check in case the container doesn't exist
  if (!editorContainer) return;

  editorContainer.innerHTML = `
  <div class="editorTop">
  <input id="noteTitle" name="noteTitle" placeholder="Note title" class="noteTitle inputField" />
  <div class="actionBtnsContainer">
  <button id="saveNoteBtn" class="btn-sm btn notesActionBtn">Save</button>
  
  <select id="exportNotesBtn" class="btn-sm btn btn-secondary notesActionBtn">
  <option value="">Export As</option>
  <option value="pdf">PDF</option>
  <option value="txt">TXT</option>
  <option value="docx">DOCX</option>
  <option value="md">Markdown</option>
  <option value="html">HTML</option>
  </select>
  </div>
  </div>
    <div id="editor"></div>

  `;

  /*
  Create Quill AFTER editor exists in DOM
  */
  const Font = Quill.import("formats/font");
  Font.whitelist = [
    "sans serif",
    "serif",
  ];
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

    if (!range || range.length === 0) {
      const url = prompt("Enter URL:");
      if (url) {
        quill.insertText(range.index, url, "link", url);
      }
      return;
    }

    const value = prompt("Enter URL:");
    if (value) {
      quill.format("link", value);
    }
  });

  loadNotes();
  loadScanhueNote();
  deleteNote();
  /*
  Attach save handler
  */
  const saveBtn = document.getElementById("saveNoteBtn");
  saveBtn.addEventListener("click", saveNote);

  const exportSelect = document.getElementById("exportNotesBtn");
  exportSelect.addEventListener("change", (e) => {
    const type = e.target.value;
    if (!type) return;

    exportCurrentNote(type);
    e.target.value = ""; // reset dropdown
  });

  setLoading(false);
}

initNotes();

async function loadScanhueNote() {
  const savedText = localStorage.getItem("scanhueNote");

  if (savedText) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("personal_notes")
      .insert({
        user_id: user.id,
        title: "Untitled",
        content: savedText,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }
    actionMsg("Imported from ScanHue", "success");

    await loadNotes();
    openNote(data);

    localStorage.removeItem("scanhueNote");
  }
}
/*
--------------------------------
LOAD USER NOTES
--------------------------------
*/
async function loadNotes() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("User not authenticated");
    return;
  }

  const { data: notes, error } = await supabase
    .from("personal_notes")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  savednoteDetails = notes || [];

  renderNotesList(notes);

  // Automatically open the most recent note
  if (notes.length > 0) {
    openNote(notes[0]);
  } else {
    // No notes left — reset editor
    currentNoteId = null;

    const titleInput = document.getElementById("noteTitle");
    const editor = quill;

    if (titleInput) titleInput.value = "";
    if (editor) editor.root.innerHTML = "";

    // Optional: show placeholder
    editor.root.setAttribute("data-placeholder", "Create your first note...");
  }
}

/*
--------------------------------
RENDER NOTES LIST
--------------------------------
*/
function renderNotesList(notes) {
  const notesList = document.getElementById("notesList");
  if (!notesList) return;

  notesList.innerHTML = "";

  notes.forEach((note) => {
    const item = document.createElement("div");
    item.classList.add("noteItem");
    item.dataset.id = note.id;

    const noteTitle = document.createElement("p");
    noteTitle.textContent = note.title || "Untitled";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.classList.add("deleteBtn", "btn", "btn-sm");
    deleteBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6" />
  <path d="M19 6l-1 14H6L5 6" />
  <path d="M10 11v6" />
  <path d="M14 11v6" />
  <path d="M9 6V4h6v2" />
</svg>
`;

    item.append(noteTitle, deleteBtn);
    item.onclick = () => openNote(note);

    notesList.appendChild(item);
  });
}

/*
--------------------------------
OPEN NOTE IN EDITOR
--------------------------------
*/
function openNote(note) {
  currentNoteId = note.id;

  document.getElementById("noteTitle").value = note.title || "Untitled";

  quill.root.innerHTML = sanitizeHTML(note.content || "");
}

/*
--------------------------------
CREATE NOTE
--------------------------------
*/
async function createNote() {
  setLoading(true);

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
    return;
  }

  await loadNotes();
  openNote(data);

  setLoading(false);

  actionMsg("Note created. Start typing!", "success");
}

document.getElementById("createNote").addEventListener("click", () => {
  createNote();
});

/*
--------------------------------
SAVE NOTE
--------------------------------
*/
async function saveNote() {
  setLoading(true);

  const title = document.getElementById("noteTitle").value;
  const content = quill.root.innerHTML;

  if (!currentNoteId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("personal_notes")
      .insert({
        user_id: user.id,
        title: "Untitled",
        content: content,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }

    await loadNotes();

    openNote(data);
  }

  const { error } = await supabase
    .from("personal_notes")
    .update({
      title,
      content,
      updated_at: new Date(),
    })
    .eq("id", currentNoteId);

  if (error) {
    console.error(error);
    return;
  }

  actionMsg("Note saved successfully!", "success");

  await loadNotes();
  setLoading(false);
}

async function deleteNote() {
  const notelist = document.getElementById("notesList");
  if (!notelist) return setLoading(false);

  notelist.addEventListener("click", async (e) => {
    const btn = e.target.closest(".deleteBtn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const noteToDelete = btn.closest(".noteItem");
    const id = noteToDelete.dataset.id;

    confirmAction("Delete this note?", [
      { label: "Cancel", type: "cancel" },
      {
        label: "Delete",
        type: "confirm",
        onClick: () => attachDeletenoteEvent(noteToDelete, id),
      },
    ]);
  });

  await loadNotes();
}

//FILE EXPORT HELPER
function exportFile(filename, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function exportCurrentNote(type) {
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

  let didExport = false;

  switch (type) {
    case "html":
      const fullHTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>${title}</title>

    <!-- Quill Snow Theme -->
    <link href="https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css" rel="stylesheet">

    <style>
      body {
        font-family: Arial, sans-serif;
        padding: 40px;
      }

      .ql-editor {
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <div class="ql-editor">
      ${htmlContent}
    </div>
  </body>
  </html>
  `;

      exportFile(`${safeTitle}.html`, fullHTML, "text/html");
      didExport = true;
      break;

    case "txt":
      exportFile(`${safeTitle}.txt`, plainText, "text/plain");
      didExport = true;
      break;

    case "md":
      const markdown = htmlContent
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ");
      exportFile(`${safeTitle}.md`, markdown, "text/markdown");
      didExport = true;
      break;

    case "docx":
      const { Document, Packer, Paragraph } = window.docx;

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: plainText,
              }),
            ],
          },
        ],
      });

      Packer.toBlob(doc).then((blob) => {
        saveAs(blob, `${safeTitle}.docx`);
      });

      break;

    case "pdf":
      const element = document.createElement("div");

      element.innerHTML = `
    <h1>${title}</h1>
    <div class="ql-editor">
      ${htmlContent}
    </div>
  `;

      html2pdf()
        .set({
          margin: 10,
          filename: `${safeTitle}.pdf`,
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(element)
        .save();

      didExport = true;
      break;

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

//For Delete Button
async function attachDeletenoteEvent(noteToDelete, id) {
  const { error } = await supabase.from("personal_notes").delete().eq("id", id);

  if (error) {
    setLoading(false);

    console.error(error);
    alert(error.message);
    return;
  }

  const index = savednoteDetails.findIndex(
    (note) => String(note.id) === String(id),
  );
  if (index !== -1) savednoteDetails.splice(index, 1);

  // Add animation class
  noteToDelete.classList.add("removing");

  await loadNotes();
  // Remove after animation ends
  setTimeout(() => {
    noteToDelete.remove();
  }, 550); // matches CSS transition time
  actionMsg("Note deleted successfully!", "success");
}
