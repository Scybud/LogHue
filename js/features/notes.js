import { supabase } from "../supabase.js";

/*
--------------------------------
GLOBAL STATE
--------------------------------
*/
let quill = null;
let currentNoteId = null;

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

  loadNotes();
  
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

    item.textContent = note.title || "Untitled";

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
    alert("Create or select a note first");
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
