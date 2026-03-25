import { supabase } from "../supabase.js";
import {closeModal} from "../ui.js"

export async function attachStartDiscussionEvent(ws, user) {
   const startDiscussionBtn = document.getElementById("startDiscussion")


  if (startDiscussionBtn.__listenerAttached) return;
  startDiscussionBtn.__listenerAttached = true;

  const discussionTitleEl = document.getElementById("discussionTitle")
  const discussionContentEl = document.getElementById("discussionContent");

  //When log task button is clicked to create new log
  startDiscussionBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const discussionTitleValue = discussionTitleEl.value.trim();
    const discussionContentValue = discussionContentEl.value.trim();

    if (!user) return alert("You must be logged in.");

    //DEFINE DATA CONTENT
    const discussionData = {
      title: discussionTitleValue,
      content: discussionContentValue,
      created_by: user.id,
      workspace_id: ws.id,
    };

    //INSERT INTO SUPABASE
    const { data, error } = await supabase
      .from("discussions")
      .insert(discussionData)
      .select();

    if (error) {
      console.error(error);
      alert("Failed to create discussion.");
      return;
    }

    closeModal();
   });
}