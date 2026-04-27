import { supabase } from "../supabase.js";
import { formatDateTime, loadActivities } from "./workspace-admin.js";

let currentDiscussion = null;
let currentWorkspace = null;
let userRole = null;
export let currentUser = null;

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

  loadSidebar();
  renderDiscussionHeader();
  renderComments();
  loadWorkspaceActivities();
  attachCommentSubmitHandler();
  attachMarkDoneHandler(discussionId);
}

function loadSidebar() {
  const workspacePageSidebar = document.getElementById("workspacePageSidebar");
  const isAdmin = userRole.role === "admin" || userRole.role === "owner";

  workspacePageSidebar.innerHTML = `<!--CLOSE BUTTON -->
  <button type="button" class="menuBtn" id="closeSidebar">

    <svg 
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
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
 ${
   isAdmin
     ? `<a href="workspace-dashboard-admin?ws=${currentWorkspace.id}" class="navBtn" data-section="index" id="dashboardLink">
      <span class="navIcon">
        <!-- Back  Icon -->
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
    </a>`
     : `<a href="workspace-dashboard-member?ws=${currentWorkspace.id}" class="navBtn" data-section="index" id="dashboardLink">
      <span class="navIcon">
        <!-- Back  Icon -->
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
    </a>`
 }

    <!-- DASHBOARD -->
    <a href="dashboard" class="navBtn" data-section="index" id="dashboardLink">
      <span class="navIcon">
        <!-- Back / Dashboard Icon -->
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
    workspacePageSidebar.classList.toggle("show");
  });
}
/* ---------------------------------------------
   LOAD DISCUSSION + COMMENTS
--------------------------------------------- */
async function loadDiscussion(discussionId) {
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
        discussion_status,
        profiles:created_by (full_name, avatar_url),
        replies:discussion_comment_comments (
          id,
          comment,
          created_at,
          profiles:created_by (full_name, avatar_url)
        )
      )
    `,
    )
    .eq("id", discussionId)
    .single();

  if (error) {
    console.error(error);
    alert("Failed to load discussion.");
    return;
  }
  currentDiscussion = data;
  currentWorkspace = data.workspace;
}

/* ---------------------------------------------
   REFRESH UI
--------------------------------------------- */
async function refreshDiscussion() {
  await loadDiscussion(currentDiscussion.id);
  renderDiscussionHeader();
  renderComments();
}

/* ---------------------------------------------
   RENDER HEADER
--------------------------------------------- */
function renderDiscussionHeader() {
  const container = document.querySelector(".dcnHeader");
  if (!container) return;

  const isAdmin = ["admin", "owner"].includes(userRole.role);

  container.innerHTML = `
    <div class="discussionHeaderTop">
      <h2>${currentDiscussion.title}</h2>
      <div class="discussionActions">
        ${
          isAdmin || currentDiscussion.created_by === currentUser.user.id
            ? `<button id="markDiscussionClosedBtn" class="primaryBtn btn btn-sm">
                ${currentDiscussion.status === "closed" ? "Reopen" : "Close"}
              </button>`
            : ""
        }
      </div>
    </div>

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
        <span class="statusBadge">${currentDiscussion.status}</span>
      </div>

      <div class="metaItem">
        <span class="metaLabel">Started:</span>
        <span>${formatDateTime(currentDiscussion.created_at)}</span>
      </div>
    </div>

    <p class="discussionDescription">${currentDiscussion.content || "No content provided."}</p>
  `;
}

/* ---------------------------------------------
   RENDER COMMENTS
--------------------------------------------- */
function renderComments() {
  const feed = document.getElementById("commentsFeed");
  feed.innerHTML = "";

  if (!currentDiscussion.comments?.length) {
    feed.innerHTML = `<p class="placeholderText">No comments yet. Be the first to comment!</p>`;
    return;
  }

  currentDiscussion.comments.forEach((comment) => {
    const card = document.createElement("div");
    card.classList.add("commentCard");

    const header = document.createElement("div");
    header.classList.add("commentHeader");

    const avatar = document.createElement("img");
    avatar.src = comment.profiles?.avatar_url || "/assets/default-avatar.png";
    avatar.className = "profileImg";

    const headerInfo = document.createElement("div");
    const name = document.createElement("span");
    name.classList.add("name");
    name.textContent = comment.profiles?.full_name || "Unknown User";

    const timestamp = document.createElement("div");
    timestamp.className = "timestamp";
    timestamp.textContent = formatDateTime(comment.created_at);

    headerInfo.appendChild(name);
    headerInfo.appendChild(timestamp);
    header.append(avatar, headerInfo);

    const content = document.createElement("div");
    content.classList.add("commentContent");
    content.textContent = comment.comment;

    const meta = document.createElement("div");
    meta.classList.add("commentMeta");
    const status = document.createElement("span");
    status.classList.add("statusBadge");
    status.textContent = comment.discussion_status;
    meta.appendChild(status);

    const thread = document.createElement("div");
    thread.classList.add("commentsThread");
    renderReplies(comment.replies, thread);

    const replyButton = document.createElement("button");
    replyButton.className = "iconBtn addCommentBtn";
    replyButton.dataset.comment = comment.id;
    replyButton.textContent = "Reply";

    card.append(header, content, meta, thread, replyButton);
    feed.appendChild(card);
  });

  attachInlineReplyHandlers();
}

function renderReplies(replies, container) {
  if (!replies?.length) return;

  replies.forEach((reply) => {
    const replyElement = document.createElement("div");
    replyElement.classList.add("comment", "reply");

    const avatar = document.createElement("img");
    avatar.src = reply.profiles?.avatar_url || "/assets/default-avatar.png";
    avatar.className = "profileImg";

    const body = document.createElement("div");
    body.classList.add("commentBody");

    const text = document.createElement("div");
    text.textContent = reply.comment;

    const timestamp = document.createElement("div");
    timestamp.className = "timestamp";
    timestamp.textContent = formatDateTime(reply.created_at);

    body.append(text, timestamp);
    replyElement.append(avatar, body);
    container.appendChild(replyElement);
  });
}

/* ---------------------------------------------
   ADD TOP‑LEVEL COMMENT
--------------------------------------------- */
function attachCommentSubmitHandler() {
  const btn = document.getElementById("submitCommentBtn");
  const input = document.getElementById("commentInput");

  if (!btn || !input) return;

  const isClosed = currentDiscussion.status === "closed";

  if (isClosed) {
    btn.remove();
    input.remove();
    return;
  }

  btn.addEventListener("click", async () => {
    const note = input.value.trim();
    if (!note) return;

    const { data: userData } = await supabase.auth.getUser();

    await supabase.from("discussion_comments").insert({
      workspace_id: currentWorkspace.id,
      discussion_id: currentDiscussion.id,
      created_by: userData.user.id,
      comment: note,
      discussion_status: currentDiscussion.status,
    });

    input.value = "";
    await refreshDiscussion();
  });
}

/* ---------------------------------------------
   MARK DISCUSSION DONE
--------------------------------------------- */
function attachMarkDoneHandler(discussionId) {
  const btn = document.getElementById("markDiscussionClosedBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const newStatus = currentDiscussion.status === "closed" ? "open" : "closed";

    const { error } = await supabase
      .from("discussions")
      .update({ status: newStatus, closed_at: new Date().toISOString() })
      .eq("id", discussionId);

    if (error) {
      alert(error.message);
      return;
    }

    await refreshDiscussion();
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

const err = document.createElement("p");
err.classList.add("error");
function openInlineReplyBox(commentId) {
  document.querySelectorAll(".inlineCommentBox").forEach((el) => el.remove());

  const card = document
    .querySelector(`.addCommentBtn[data-comment="${commentId}"]`)
    .closest(".commentCard");

  if (currentDiscussion.status === "closed") {
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

  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from("discussion_comment_comments").insert({
    comment_id: commentId,
    created_by: userData.user.id,
    comment: text,
  });

  if (error) {
    alert("Failed to add reply.");
    return;
  }

  box.remove();
  await refreshDiscussion();
}
