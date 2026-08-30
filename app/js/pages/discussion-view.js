import { supabase } from "../supabase.js";
import { setButtonLoading } from "https://scybud.github.io/scybud-ui/js/ui.js";
import { loadActivities } from "./workspace/activities.js";
import { formatDateTime, formatDateTimeRelatively } from "../utils/time.js";
import { actionMsg } from "../utils/modals.js";
import {
  subscribeWorkspaceChannel,
  unsubscribeChannel,
} from "../shared/realtime.js";

let currentDiscussion = null;
let currentWorkspace = null;
let userRole = null;
export let currentUser = null;

// user_id -> { id, full_name, avatar_url }, built once from workspace_members
let memberProfiles = new Map();

let realtimeChannel = null;

// True once a realtime event has changed ordering (new comment, or a
// reply that bumps its parent). Applied on next full render, not live,
// so nothing shifts under an active reader.
let pendingResort = false;

let idleTimer = null;
const IDLE_RESORT_MS = 15000;

/* ---------------------------------------------
GET USER ROLE
--------------------------------------------- */
async function getUserRole(workspaceId) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;

  currentUser = userData;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userData.user.id)
    .single();

  if (error) return null;
  return { userId: userData.user.id, role: data.role };
}

async function loadMemberProfiles(workspaceId) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, profiles:user_id (id, full_name, avatar_url)")
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error(error);
    return;
  }

  memberProfiles = new Map((data || []).map((m) => [m.user_id, m.profiles]));
}

function resolveProfile(userId) {
  return (
    memberProfiles.get(userId) || {
      id: userId,
      full_name: "Unknown User",
      avatar_url: null,
    }
  );
}

const workspaceActivities = document.getElementById("workspaceActivities");

async function loadWorkspaceActivities() {
  const { data: logs, error } = await supabase
    .from("workspace_task_logs")
    .select(
      `
    *,
    profiles:created_by (full_name, avatar_url),
    workspace_tasks:task_id (title)
  `,
    )
    .eq("workspace_id", currentWorkspace.id)
    .order("created_at", { ascending: false });

  const { data: actDcns, actDcnsError } = await supabase
    .from("discussions")
    .select(
      `
    *,
    profiles:created_by (full_name, avatar_url)
  `,
    )
    .eq("workspace_id", currentWorkspace.id)
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

  loadActivities(activities, workspaceActivities);
}

const reloadBtn = document.querySelector(".reloadBtn");
reloadBtn.addEventListener("click", () => {
  window.location.reload();
});

/* ---------------------------------------------
   INIT
--------------------------------------------- */
document.addEventListener("DOMContentLoaded", initDiscussionView);
window.addEventListener("beforeunload", () => {
  unsubscribeChannel(realtimeChannel);
});

async function initDiscussionView() {
  const params = new URLSearchParams(window.location.search);
  const discussionId = params.get("dcn");
  const discussionViewContent = document.getElementById(
    "discussionViewContent",
  );
  if (!discussionId && discussionViewContent) {
    discussionViewContent.innerHTML = `<p class="placeholderText">Invalid discussion link.</p>`;
    return;
  }

  await loadDiscussion(discussionId);
  userRole = await getUserRole(currentWorkspace.id);
  await loadMemberProfiles(currentWorkspace.id);

  loadSidebar();
  renderDiscussionHeader();
  renderComments();
  loadWorkspaceActivities();
  attachCommentSubmitHandler();
  attachIdleResortTracking();

  // renderComments() already scrolls to bottom, but avatar images load
  // asynchronously and grow the feed's height after that snapshot, so
  // the initial scroll can land short. Re-run once layout has settled
  // and once more after images finish loading.
  requestAnimationFrame(() => requestAnimationFrame(scrollFeedToBottom));
  window.addEventListener("load", scrollFeedToBottom, { once: true });

  realtimeChannel = subscribeWorkspaceChannel(currentWorkspace.id, {
    onDiscussionUpdate: handleDiscussionUpdate,
    onCommentInsert: handleCommentInsert,
    onCommentUpdate: handleCommentUpdate,
    onCommentDelete: handleCommentDelete,
    onReplyInsert: handleReplyInsert,
    onReplyUpdate: handleReplyUpdate,
    onReplyDelete: handleReplyDelete,
  });
}

function loadSidebar() {
  const discussionSidebar = document.getElementById("discussionsSidebar");

  discussionSidebar.innerHTML = `<!--CLOSE BUTTON -->
  <button type="button" class="menuBtn" id="closeSidebar">

    <svg 
    xmlns="http://www.w3.org/2000/svg"
    width="25"
    height="25"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <rect
    x="3.5"
    y="3.5"
    width="17"
    height="17"
    rx="6"
    ry="6"
    fill="currentColor"
    opacity="0.06"
  />
  <path d="M9 9l6 6M15 9l-6 6" />
</svg>
</button>

 <nav class="sidebarNav">
 <!-- WORKSPACE -->
 <a href="workspace?ws=${currentWorkspace.id}" class="navBtn" data-section="index" id="dashboardLink">
      <span class="navIcon">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M11.75 4.25L6 10L11.75 15.75"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="navText">Workspace</span>
    </a>

    <!-- DASHBOARD -->
    <a href="dashboard" class="navBtn" data-section="index" id="dashboardLink">
      <span class="navIcon">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M11.75 4.25L6 10L11.75 15.75"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="navText">Dashboard</span>
    </a>
</nav>
`;

  document.getElementById("closeSidebar").addEventListener("click", () => {
    discussionSidebar.classList.toggle("slideShow");
  });
}

/* ---------------------------------------------
   LOAD DISCUSSION + COMMENTS
--------------------------------------------- */
async function loadDiscussion(discussionId) {
  if (!discussionId) {
    console.warn("No discussion ID provided — skipping Supabase fetch.");
    return null;
  }

  const { data, error } = await supabase
    .from("discussions")
    .select(
      `
      *,
      profiles:created_by (id, full_name, avatar_url),
      workspace:workspace_id (id, name),
      comments:discussion_comments (
        id,
        comment,
        created_at,
        updated_at,
        last_activity_at,
        created_by,
        replies:discussion_comment_comments (
          id,
          comment,
          created_at,
          updated_at,
          created_by
        )
      )
    `,
    )
    .eq("id", discussionId)
    .order("last_activity_at", { ascending: true, foreignTable: "comments" })
    .order("created_at", { ascending: true, foreignTable: "comments.replies" })
    .single();

  if (error) {
    console.error(error);
    alert("Failed to load discussion.");
    return;
  }
  currentDiscussion = data;
  currentDiscussion.comments = currentDiscussion.comments || [];
  currentWorkspace = data.workspace;
  pendingResort = false;
}

/* ---------------------------------------------
   RENDER HEADER
--------------------------------------------- */
function renderDiscussionHeader() {
  const container = document.querySelector(".dcnHeader");
  if (!container) return;

  const isAdmin = ["admin", "owner"].includes(userRole.role);
  const isClosed = currentDiscussion.status === "closed";

  container.innerHTML = `
    <div class="discussionHeaderTop">
      <h2>${currentDiscussion.title}</h2>
      <div class="discussionActions">
        ${
          isAdmin || currentDiscussion.created_by === currentUser.user.id
            ? `<button id="markDiscussionClosedBtn" class="primaryBtn btn btn-sm">
                ${isClosed ? "Reopen" : "Close"}
              </button>`
            : ""
        }
      </div>
    </div>

    <details class="discussionMetaDetails">
      <summary>Thread details</summary>
      <div class="discussionMeta">
        <div class="metaItem">
          <span class="metaLabel">Started by:</span>
          <div class="avatarGroup">
            <img src="${currentDiscussion.profiles?.avatar_url || "/assets/default-avatar.png"}" class="profileImg" />
            <span>${currentDiscussion.profiles?.full_name || "Unknown"}</span>
          </div>
        </div>

        <div class="metaItem">
          <span class="metaLabel">Status:</span>
          <span class="statusBadge" data-status="${currentDiscussion.status}">
            ${currentDiscussion.status}
          </span>
        </div>

        <div class="metaItem">
          <span class="metaLabel">Started:</span>
          <span>${formatDateTime(currentDiscussion.created_at)}</span>
        </div>

        <p class="discussionDescription">${currentDiscussion.content || "No content provided."}</p>
      </div>
    </details>

    ${isClosed ? `<p class="placeholderText closedNotice">This thread is closed. No new messages can be sent.</p>` : ""}
  `;

  document
    .getElementById("markDiscussionClosedBtn")
    ?.addEventListener("click", handleToggleClosed);

  toggleCommentInputForClosedState();
}

/* ---------------------------------------------
   SCROLL
--------------------------------------------- */
function scrollFeedToBottom() {
  const feed = document.getElementById("commentsFeed");
  if (feed) feed.scrollTop = feed.scrollHeight;
}

/* ---------------------------------------------
   RENDER COMMENTS (full, sorted render)
--------------------------------------------- */
function renderComments() {
  const feed = document.getElementById("commentsFeed");
  feed.innerHTML = "";

  if (!currentDiscussion.comments?.length) {
    feed.innerHTML = `<p class="placeholderText">No comments yet. Be the first to comment!</p>`;
    return;
  }

  const myId = currentUser?.user?.id;

  currentDiscussion.comments.forEach((comment) => {
    feed.appendChild(buildCommentCard(comment, myId));
  });

  attachInlineReplyHandlers();
  pendingResort = false;

  scrollFeedToBottom();
}

function buildCommentCard(comment, myId) {
  const isOwn = comment.created_by === myId;
  const isAdmin = ["admin", "owner"].includes(userRole.role);
  const profile = resolveProfile(comment.created_by);

  const card = document.createElement("div");
  card.classList.add("commentCard");
  card.dataset.id = comment.id;
  if (isOwn) card.classList.add("is-own");

  const header = document.createElement("div");
  header.classList.add("commentHeader");

  const avatar = document.createElement("img");
  avatar.src = profile.avatar_url || "/assets/default-avatar.png";
  avatar.className = "profileImg";

  const headerInfo = document.createElement("div");
  const name = document.createElement("span");
  name.classList.add("name");
  name.textContent = profile.full_name || "Unknown User";

  const timestamp = document.createElement("div");
  timestamp.className = "timestamp";
  timestamp.textContent = formatDateTimeRelatively(comment.created_at);
  if (comment.updated_at) {
    timestamp.textContent += " (edited)";
  }

  headerInfo.appendChild(name);
  headerInfo.appendChild(timestamp);
  header.append(avatar, headerInfo);

  const content = document.createElement("div");
  content.classList.add("commentContent");
  content.textContent = comment.comment;

  const actions = document.createElement("div");
  actions.classList.add("commentActionsRow");

  if (isOwn) {
    const editBtn = document.createElement("button");
    editBtn.className = "iconBtn editCommentBtn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openEditCommentBox(card, comment));
    actions.appendChild(editBtn);
  }

  if (isOwn || isAdmin) {
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "iconBtn deleteCommentBtn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => handleDeleteComment(comment.id));
    actions.appendChild(deleteBtn);
  }

  const thread = document.createElement("div");
  thread.classList.add("commentsThread");
  (comment.replies || []).forEach((reply) => {
    thread.appendChild(buildReplyElement(reply, myId));
  });

  const replyButton = document.createElement("button");
  replyButton.className = "iconBtn addCommentBtn";
  replyButton.dataset.comment = comment.id;
  replyButton.textContent = "Reply";

  card.append(header, content, actions, thread, replyButton);
  return card;
}

function buildReplyElement(reply, myId) {
  const isOwnReply = reply.created_by === myId;
  const isAdmin = ["admin", "owner"].includes(userRole.role);
  const profile = resolveProfile(reply.created_by);

  const replyElement = document.createElement("div");
  replyElement.classList.add("comment", "reply");
  replyElement.dataset.replyId = reply.id;
  if (isOwnReply) replyElement.classList.add("is-own");

  const avatar = document.createElement("img");
  avatar.src = profile.avatar_url || "/assets/default-avatar.png";
  avatar.className = "profileImg";

  const body = document.createElement("div");
  body.classList.add("commentBody");

  const nameEl = document.createElement("span");
  nameEl.className = "name";
  nameEl.textContent = profile.full_name || "Unknown User";

  const text = document.createElement("div");
  text.className = "replyText";
  text.textContent = reply.comment;

  const timestamp = document.createElement("div");
  timestamp.className = "timestamp";
  timestamp.textContent = formatDateTimeRelatively(reply.created_at);
  if (reply.updated_at) {
    timestamp.textContent += " (edited)";
  }

  const actions = document.createElement("div");
  actions.classList.add("commentActionsRow");

  if (isOwnReply) {
    const editBtn = document.createElement("button");
    editBtn.className = "iconBtn editReplyBtn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () =>
      openEditReplyBox(replyElement, reply),
    );
    actions.appendChild(editBtn);
  }

  if (isOwnReply || isAdmin) {
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "iconBtn deleteReplyBtn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => handleDeleteReply(reply.id));
    actions.appendChild(deleteBtn);
  }

  body.append(nameEl, text, timestamp, actions);
  replyElement.append(avatar, body);
  return replyElement;
}

/* ---------------------------------------------
   ADD TOP-LEVEL COMMENT
--------------------------------------------- */
function attachCommentSubmitHandler() {
  const btn = document.getElementById("submitCommentBtn");
  const input = document.getElementById("commentInput");
  if (!btn || !input) return;

  btn.addEventListener("click", async () => {
    const note = input.value.trim();

    if (!note) {
      actionMsg("Write something before submitting.", "error");
      return;
    }

    if (currentDiscussion.status === "closed") {
      actionMsg("This thread is closed.", "error");
      return;
    }

    setButtonLoading(btn, true);

    try {
      const { error } = await supabase.from("discussion_comments").insert({
        workspace_id: currentWorkspace.id,
        discussion_id: currentDiscussion.id,
        created_by: currentUser.user.id,
        comment: note,
      });

      if (error) {
        actionMsg("Failed to add comment.", "error");
        return;
      }

      input.value = "";
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

function toggleCommentInputForClosedState() {
  const btn = document.getElementById("submitCommentBtn");
  const input = document.getElementById("commentInput");
  const container = document.getElementById("addCommentContainer");
  if (!btn || !input || !container) return;

  const isClosed = currentDiscussion.status === "closed";
  btn.disabled = isClosed;
  input.disabled = isClosed;
  container.classList.toggle("is-disabled", isClosed);
}

/* ---------------------------------------------
   CLOSE / REOPEN
--------------------------------------------- */
function handleToggleClosed() {
  const btn = document.getElementById("markDiscussionClosedBtn");
  if (!btn) return;

  setButtonLoading(btn, true);

  const newStatus = currentDiscussion.status === "closed" ? "open" : "closed";

  supabase
    .from("discussions")
    .update({ status: newStatus, closed_at: new Date().toISOString() })
    .eq("id", currentDiscussion.id)
    .then(({ error }) => {
      setButtonLoading(btn, false);
      if (error) alert(error.message);
      // UI updates via realtime onDiscussionUpdate
    });
}

/* ---------------------------------------------
   INLINE REPLY
--------------------------------------------- */
function attachInlineReplyHandlers() {
  document.querySelectorAll(".addCommentBtn").forEach((btn) => {
    btn.addEventListener("click", () =>
      openInlineReplyBox(btn.dataset.comment),
    );
  });
}

function openInlineReplyBox(commentId) {
  document.querySelectorAll(".inlineCommentBox").forEach((el) => el.remove());

  const card = document.querySelector(`.commentCard[data-id="${commentId}"]`);
  if (!card) return;

  if (currentDiscussion.status === "closed") {
    const err = document.createElement("p");
    err.classList.add("error");
    err.textContent = "You cannot comment on closed discussions.";
    card.appendChild(err);
    return;
  }

  const box = document.createElement("div");
  box.classList.add("inlineCommentBox");
  box.innerHTML = `
    <textarea class="inputField commentInput" placeholder="Write a reply..."></textarea>
    <div class="commentActions">
      <button class="secondaryBtn cancelCommentBtn">Cancel</button>
      <button class="primaryBtn submitInlineCommentBtn" data-comment="${commentId}">Submit</button>
    </div>
  `;

  card.appendChild(box);

  box
    .querySelector(".cancelCommentBtn")
    .addEventListener("click", () => box.remove());
  box
    .querySelector(".submitInlineCommentBtn")
    .addEventListener("click", submitInlineReply);
}

async function submitInlineReply(e) {
  const commentId = e.target.dataset.comment;
  const box = e.target.closest(".inlineCommentBox");
  const text = box.querySelector(".commentInput").value.trim();

  if (!text) return;

  const { error } = await supabase.from("discussion_comment_comments").insert({
    comment_id: commentId,
    workspace_id: currentWorkspace.id,
    created_by: currentUser.user.id,
    comment: text,
  });

  if (error) {
    alert("Failed to add reply.");
    return;
  }

  box.remove();
}

/* ---------------------------------------------
   EDIT / DELETE — COMMENTS
--------------------------------------------- */
function openEditCommentBox(card, comment) {
  const contentEl = card.querySelector(".commentContent");
  if (!contentEl) return;

  const original = comment.comment;

  const textarea = document.createElement("textarea");
  textarea.className = "inputField editCommentInput";
  textarea.value = original;

  const actions = document.createElement("div");
  actions.classList.add("commentActions");

  const saveBtn = document.createElement("button");
  saveBtn.className = "primaryBtn";
  saveBtn.textContent = "Save";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "secondaryBtn";
  cancelBtn.textContent = "Cancel";

  actions.append(cancelBtn, saveBtn);

  contentEl.replaceWith(textarea);
  textarea.insertAdjacentElement("afterend", actions);

  cancelBtn.addEventListener("click", () => {
    actions.remove();
    textarea.replaceWith(contentEl);
  });

  saveBtn.addEventListener("click", async () => {
    const newText = textarea.value.trim();
    if (!newText) return;

    setButtonLoading(saveBtn, true);

    const { error } = await supabase
      .from("discussion_comments")
      .update({ comment: newText, updated_at: new Date().toISOString() })
      .eq("id", comment.id);

    setButtonLoading(saveBtn, false);

    if (error) {
      alert("Failed to edit comment.");
      return;
    }

    comment.comment = newText;
    comment.updated_at = new Date().toISOString();

    contentEl.textContent = newText;
    actions.remove();
    textarea.replaceWith(contentEl);

    const timestampEl = card.querySelector(".commentHeader .timestamp");
    if (timestampEl) {
      timestampEl.textContent =
        formatDateTime(comment.created_at) + " (edited)";
    }
  });
}

async function handleDeleteComment(commentId) {
  if (!confirm("Delete this message? Replies to it will also be deleted."))
    return;

  const { error } = await supabase
    .from("discussion_comments")
    .delete()
    .eq("id", commentId);

  if (error) alert("Failed to delete comment.");
  // UI updates via realtime onCommentDelete
}

/* ---------------------------------------------
   EDIT / DELETE — REPLIES
--------------------------------------------- */
function openEditReplyBox(replyElement, reply) {
  const textEl = replyElement.querySelector(".replyText");
  if (!textEl) return;

  const original = reply.comment;

  const textarea = document.createElement("textarea");
  textarea.className = "inputField editCommentInput";
  textarea.value = original;

  const actions = document.createElement("div");
  actions.classList.add("commentActions");

  const saveBtn = document.createElement("button");
  saveBtn.className = "primaryBtn";
  saveBtn.textContent = "Save";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "secondaryBtn";
  cancelBtn.textContent = "Cancel";

  actions.append(cancelBtn, saveBtn);

  textEl.replaceWith(textarea);
  textarea.insertAdjacentElement("afterend", actions);

  cancelBtn.addEventListener("click", () => {
    actions.remove();
    textarea.replaceWith(textEl);
  });

  saveBtn.addEventListener("click", async () => {
    const newText = textarea.value.trim();
    if (!newText) return;

    setButtonLoading(saveBtn, true);

    const { error } = await supabase
      .from("discussion_comment_comments")
      .update({ comment: newText, updated_at: new Date().toISOString() })
      .eq("id", reply.id);

    setButtonLoading(saveBtn, false);

    if (error) {
      alert("Failed to edit reply.");
      return;
    }

    reply.comment = newText;
    reply.updated_at = new Date().toISOString();

    textEl.textContent = newText;
    actions.remove();
    textarea.replaceWith(textEl);

    const timestampEl = replyElement.querySelector(".timestamp");
    if (timestampEl) {
      timestampEl.textContent = formatDateTime(reply.created_at) + " (edited)";
    }
  });
}

async function handleDeleteReply(replyId) {
  if (!confirm("Delete this reply?")) return;

  const { error } = await supabase
    .from("discussion_comment_comments")
    .delete()
    .eq("id", replyId);

  if (error) alert("Failed to delete reply.");
  // UI updates via realtime onReplyDelete
}

/* ---------------------------------------------
   REALTIME HANDLERS
--------------------------------------------- */
function handleDiscussionUpdate(row) {
  if (row.id !== currentDiscussion.id) return;
  currentDiscussion.status = row.status;
  currentDiscussion.closed_at = row.closed_at;
  renderDiscussionHeader();
}

function handleCommentInsert(row) {
  if (row.discussion_id !== currentDiscussion.id) return;
  if (currentDiscussion.comments.some((c) => c.id === row.id)) return;

  const comment = { ...row, replies: [] };
  currentDiscussion.comments.push(comment);

  const feed = document.getElementById("commentsFeed");
  const placeholder = feed.querySelector(".placeholderText");
  if (placeholder) placeholder.remove();

  feed.appendChild(buildCommentCard(comment, currentUser?.user?.id));
  attachInlineReplyHandlers();
  scrollFeedToBottom();
}

function handleCommentUpdate(row) {
  const comment = currentDiscussion.comments.find((c) => c.id === row.id);
  if (!comment) return;

  comment.comment = row.comment;
  comment.updated_at = row.updated_at;

  const card = document.querySelector(`.commentCard[data-id="${row.id}"]`);
  if (!card) return;

  // Skip the DOM patch entirely if this comment's edit box is open
  // locally, so an incoming update can't clobber in-progress typing.
  if (card.querySelector(".editCommentInput")) return;

  const contentEl = card.querySelector(".commentContent");
  if (contentEl) contentEl.textContent = row.comment;

  const timestampEl = card.querySelector(".commentHeader .timestamp");
  if (timestampEl) {
    timestampEl.textContent =
      formatDateTime(comment.created_at) + (row.updated_at ? " (edited)" : "");
  }
}

function handleCommentDelete(row) {
  currentDiscussion.comments = currentDiscussion.comments.filter(
    (c) => c.id !== row.id,
  );

  const card = document.querySelector(`.commentCard[data-id="${row.id}"]`);
  card?.remove();

  const feed = document.getElementById("commentsFeed");
  if (feed && !feed.children.length) {
    feed.innerHTML = `<p class="placeholderText">No comments yet. Be the first to comment!</p>`;
  }
}

function handleReplyInsert(row) {
  const comment = currentDiscussion.comments.find(
    (c) => c.id === row.comment_id,
  );
  if (!comment) return;
  if (comment.replies.some((r) => r.id === row.id)) return;

  comment.replies.push(row);
  comment.last_activity_at = row.created_at;
  pendingResort = true;

  const card = document.querySelector(
    `.commentCard[data-id="${row.comment_id}"]`,
  );
  const thread = card?.querySelector(".commentsThread");
  if (thread) {
    thread.appendChild(buildReplyElement(row, currentUser?.user?.id));
  }
}

function handleReplyUpdate(row) {
  const comment = currentDiscussion.comments.find((c) =>
    c.replies.some((r) => r.id === row.id),
  );
  const reply = comment?.replies.find((r) => r.id === row.id);
  if (!reply) return;

  reply.comment = row.comment;
  reply.updated_at = row.updated_at;

  const replyEl = document.querySelector(`[data-reply-id="${row.id}"]`);
  if (!replyEl) return;

  if (replyEl.querySelector(".editCommentInput")) return;

  const textEl = replyEl.querySelector(".replyText");
  if (textEl) textEl.textContent = row.comment;

  const timestampEl = replyEl.querySelector(".timestamp");
  if (timestampEl) {
    timestampEl.textContent =
      formatDateTime(reply.created_at) + (row.updated_at ? " (edited)" : "");
  }
}

function handleReplyDelete(row) {
  for (const comment of currentDiscussion.comments) {
    const idx = comment.replies.findIndex((r) => r.id === row.id);
    if (idx !== -1) comment.replies.splice(idx, 1);
  }

  document.querySelector(`[data-reply-id="${row.id}"]`)?.remove();
}

/* ---------------------------------------------
   DEFERRED RESORT (idle / next open)
--------------------------------------------- */
function attachIdleResortTracking() {
  const feed = document.getElementById("commentsFeed");
  if (!feed) return;

  const reset = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(applyDeferredResortIfNeeded, IDLE_RESORT_MS);
  };

  feed.addEventListener("scroll", reset);
  document.addEventListener("mousemove", reset, { passive: true });
  document.addEventListener("keydown", reset);

  reset();
}

function applyDeferredResortIfNeeded() {
  if (!pendingResort) return;

  currentDiscussion.comments.sort(
    (a, b) => new Date(a.last_activity_at) - new Date(b.last_activity_at),
  );
  currentDiscussion.comments.forEach((c) => {
    c.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  });

  renderComments();
}
