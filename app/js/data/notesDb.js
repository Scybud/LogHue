import { supabase } from "../supabase.js";
import { actionMsg } from "../utils/modals.js";

export async function fetchNoteById(noteId, userId) {
    const {data: note, error} = await supabase
    .from("personal_notes")
    .select("id, title, content")
    .eq("user_id", userId)
    .eq("id", noteId)
    .single();

    if(error) {
        console.log(error)
        actionMsg("Error loading notes", "error")
        return;
    }

    return note;
}