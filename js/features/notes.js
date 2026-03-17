import { supabase } from "../supabase.js";
import {confirmAction} from "../utils/modals.js"
/*
--------------------------------
GLOBAL STATE
--------------------------------
*/
let quill = null;
let currentNoteId = null;
let savednoteDetails = [];
/*
--------------------------------
INITIALIZE NOTES UI
--------------------------------
*/
function initNotes() {
  const editorContainer = document.getElementById("editorContainer");

  // Safety check in case the container doesn't exist
  if (!editorContainer) return;

  editorContainer.innerHTML = `
    <input id="noteTitle" value="Untitled" placeholder="Note title" class="noteTitle inputField" />
    <div id="editor"></div>
    <button id="saveNoteBtn" class="btn-sm btn">Save</button>
  `;

  /*
  Create Quill AFTER editor exists in DOM
  */
   quill = new Quill("#editor", {
    modules: {
      toolbar: [
        [{ header: [1, 2, false] }],
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["code-block"],
      ],
    },
    placeholder: "Write your note...",
    theme: "snow",
  });

  // ⬇️ Add this RIGHT AFTER the Quill initialization
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
  attachDeletenoteEvent();
  /*
  Attach save handler
  */
  const saveBtn = document.getElementById("saveNoteBtn");
  saveBtn.addEventListener("click", saveNote);
}

initNotes();


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

    const noteTitle = note.title || "Untitled";

    const deleteBtn = document.createElement("button")
    deleteBtn.type = "button"
    deleteBtn.classList.add("deleteBtn", "btn", "btn-sm")
    deleteBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6" />
  <path d="M19 6l-1 14H6L5 6" />
  <path d="M10 11v6" />
  <path d="M14 11v6" />
  <path d="M9 6V4h6v2" />
</svg>
`;
    // truncate safely
    const shortenedTitle =
      noteTitle.length > 25 ? noteTitle.slice(0, 25) + "..." : noteTitle;

    item.textContent = shortenedTitle;
item.append(deleteBtn)
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

  quill.root.innerHTML = note.content || "";
}


/*
--------------------------------
CREATE NOTE
--------------------------------
*/
async function createNote() {

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
}

document.getElementById("createNote").addEventListener("click", () => {
   createNote();
})

/*
--------------------------------
SAVE NOTE
--------------------------------
*/
async function saveNote() {

  if (!currentNoteId) {
    confirmAction("Create or select a note first", {
      label: "Okay",
      type: "cancel",
    });
    return;
  }

  const title = document.getElementById("noteTitle").value;
  const content = quill.root.innerHTML;

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

  await loadNotes();
}


//For Delete Button
function attachDeletenoteEvent() {
  const notelist = document.getElementById("notesList")
  if (!notelist) return;
  notelist.addEventListener("click", async (e) => {
    const btn = e.target.closest(".deleteBtn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Delete this task note?")) return;

    const noteToDelete = btn.closest(".noteItem");
    const id = noteToDelete.dataset.id;

    const { error } = await supabase
      .from("personal_notes")
      .delete()
      .eq("id", id);

    if (error) {
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

    // Remove after animation ends
    setTimeout(() => {
      noteToDelete.remove();

      //update count
      updateTaskCount();
      //check if task note conatiner is empty
      checkIfEmpty();
    }, 550); // matches CSS transition time
  });
}
