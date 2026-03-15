import { supabase } from "../supabase.js"; // if using Supabase
import { currentWorkspace } from "./workspace-admin.js";

const editorContainer = document.getElementById("editorContainer");

// Create editor structure
editorContainer.innerHTML = `
  <input id="noteTitle" value="Untitled" placeholder="Note title" class="noteTitle inputField" />
  <div id="editor"></div>
  <button id="saveNoteBtn" class="btn-sm btn">Save</button>
`;

const quill = new Quill("#editor", {
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

async function loadNotes() {
  const { data: notes, error } = await supabase
    .from("workspace_notes")
    .select("*")
    .eq("workspace_id", currentWorkspace.id)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return console.error(error);

  renderNotesList(data);
}
