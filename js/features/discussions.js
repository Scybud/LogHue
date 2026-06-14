import { supabase } from "../supabase.js";
import { closeModal } from "../ui.js";
import { actionMsg } from "../utils/modals.js";
import { notifyWorkspace } from "../utils/notifications.js";
import { setButtonLoading } from "https://scybud.github.io/scybud-ui/js/ui.js";
import { setButtonLoading } from "https://scybud.github.io/scybud-ui/js/ui.js";

export async function attachStartDiscussionEvent(ws, user) {
  const startDiscussionBtn = document.getElementById("startDiscussion");

  if (startDiscussionBtn.__listenerAttached) return;
  startDiscussionBtn.__listenerAttached = true;

  const discussionTitleEl = document.getElementById("discussionTitle");
  const discussionContentEl = document.getElementById("discussionContent");

  //When log task button is clicked to create new log
  startDiscussionBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    setButtonLoading(startDiscussionBtn, true);

    const discussionTitleValue = discussionTitleEl.value.trim();
    const discussionContentValue = discussionContentEl.value.trim();

    if (!user) {
      setButtonLoading(startDiscussionBtn, false);
      return actionMsg("You must be logged in.");
    }

    if (!discussionContentValue) {
      actionMsg("Write something to start a discussion");
      setButtonLoading(startDiscussionBtn, false);
      return;
    }
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
      .select()
      .single();

    if (error) {
      console.error(error);
      actionMsg("Failed to create discussion.");
      setButtonLoading(startDiscussionBtn, false);
      return;
    }

    const createdDiscussion = data[0];

    notifyWorkspace({
      workspaceId: ws.id,
      actorId: user.id,
      type: "discussion_started",
      entityId: createdDiscussion.id,
      entityType: "discussion",
    });

    closeModal();
  });
}
