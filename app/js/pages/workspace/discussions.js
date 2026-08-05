import { formatDateTime } from "../../utils/time.js";
import { supabase } from "../../supabase.js";
import { actionMsg } from "../../utils/modals.js";
import { notifyWorkspace } from "../../utils/notifications.js";
import {
  setButtonLoading,
  closeModal,
} from "https://scybud.github.io/scybud-ui/js/ui.js";

/**
 * Shared discussions list (works for admin, owner and member).
 * @param {string} title
 * @param {Array} discussions
 * @param {HTMLElement} container
 * @param {string} [emptyStateText="No discussions started yet."]
 */
export function loadDiscussions(
  title,
  discussions,
  container,
  emptyStateText = "No discussions started yet.",
) {
  if (!discussions || discussions.length === 0) {
    const section = document.createElement("div");
    section.classList.add("section");
    const p = document.createElement("p");
    p.classList.add("placeholderText");
    p.textContent = emptyStateText;
    section.append(p);
    container.append(section);
    return;
  }

  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = title;

  const sectionHeader = document.createElement("div");
  sectionHeader.classList.add("sectionHeader");
  sectionHeader.appendChild(sectionTitle);

  const section = document.createElement("div");
  section.classList.add("section");
  section.appendChild(sectionHeader);

  const divGrid = document.createElement("div");
  divGrid.classList.add("container");

  discussions.forEach((dcn) => {
    const discussionCard = document.createElement("div");
    discussionCard.classList.add("card", "discussionCard");
    discussionCard.dataset.id = dcn.id;

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

    const createdOn = document.createElement("p");
    createdOn.classList.add("meta");
    createdOn.textContent = formatDateTime(dcn.created_at);

    const dcnMeta = document.createElement("div");
    dcnMeta.classList.add("dcnMeta");
    dcnMeta.append(createdOn);

    const viewBtn = document.createElement("button");
    viewBtn.classList.add("btn", "btn-primary", "btn-sm");
    viewBtn.textContent = "Open";
    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `discussion-view?dcn=${dcn.id}`;
    });

    details.addEventListener("click", (e) => e.stopPropagation());

    discussionCard.append(dcnHeader, dcnMeta, dcnTitle, details, viewBtn);
    divGrid.append(discussionCard);
  });

  section.append(divGrid);
  container.append(section);
}

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

    const createdDiscussion = data;

    await notifyWorkspace({
      workspaceId: ws.id,
      actorId: user.id,
      type: "discussion_started",
      entityId: createdDiscussion?.id,
      entityType: "discussion",
    });

    closeModal();
  });
}
