import { supabase } from "../supabase.js";
import { formatDateTime } from "./workspace-admin.js";

let currentDiscussion = null;
let currentWorkspace = null;
let userRole = null;

/* ---------------------------------------------
   GET USER ROLE
--------------------------------------------- */
async function getUserRole(workspaceId) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userData.user.id)
    .single();

  if (error) return null;
  return { userId: userData.user.id, role: data.role };
}

/* ---------------------------------------------
   INIT
--------------------------------------------- */
document.addEventListener("DOMContentLoaded", initDiscussionView);

async function initDiscussionView() {
  const params = new URLSearchParams(window.location.search);
  const discussionId = params.get("dcn");

  if (!discussionId) {
    document.getElementById("discussionViewContent").innerHTML =
      `<p class="placeholderText">Invalid discussion link.</p>`;
    return;
  }

  await loadDiscussion(discussionId);
  userRole = await getUserRole(currentWorkspace.id);

  renderDiscussionHeader();
  renderComments();
  attachCommentSubmitHandler();
  attachMarkDoneHandler(discussionId);
}

/* ---------------------------------------------
   LOAD DISCUSSION + COMMENTS
--------------------------------------------- */
async function loadDiscussion(discussionId) {
  const { data, error } = await supabase
    .from("discussions")
    .select(`
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
    `)
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
          isAdmin
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
    feed.innerHTML = `<p class="placeholderText">No comments yet.</p>`;
    return;
  }

  currentDiscussion.comments.forEach((comment) => {
    const card = document.createElement("div");
    card.classList.add("commentCard");

    card.innerHTML = `
      <div class="commentHeader">
        <img src="${comment.profiles?.avatar_url || "/assets/default-avatar.png"}" class="profileImg" />
        <div>
          <span class="name">${comment.profiles?.full_name || "Unknown User"}</span>
          <div class="timestamp">${formatDateTime(comment.created_at)}</div>
        </div>
      </div>

      <div class="commentContent">${comment.comment}</div>

      <div class="commentMeta">
        <span class="statusBadge">${comment.discussion_status}</span>
      </div>

      <div class="commentsThread">
        ${renderRepliesHTML(comment.replies)}
      </div>

      <button class="iconBtn addCommentBtn" data-comment="${comment.id}">
        Reply
      </button>
    `;

    feed.appendChild(card);
  });

  attachInlineReplyHandlers();
}

function renderRepliesHTML(replies) {
  if (!replies?.length) return "";

  return replies
    .map(
      (r) => `
      <div class="comment reply">
        <img src="${r.profiles?.avatar_url || "/assets/default-avatar.png"}" class="profileImg" />
        <div class="commentBody">
          <div>${r.comment}</div>
          <div class="timestamp">${formatDateTime(r.created_at)}</div>
        </div>
      </div>
    `
    )
    .join("");
}

/* ---------------------------------------------
   ADD TOP‑LEVEL COMMENT
--------------------------------------------- */
function attachCommentSubmitHandler() {
  const btn = document.getElementById("submitCommentBtn");
  const input = document.getElementById("commentInput");
  
  if (!btn || !input) return;

  const isClosed = currentDiscussion.status === "closed";

  if ( isClosed) {
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
      .update({ status: newStatus })
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
    btn.addEventListener("click", () => openInlineReplyBox(btn.dataset.comment));
  });
}

function openInlineReplyBox(commentId) {
  document.querySelectorAll(".inlineCommentBox").forEach((el) => el.remove());

  const card = document
    .querySelector(`.addCommentBtn[data-comment="${commentId}"]`)
    .closest(".commentCard");

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

  box.querySelector(".cancelCommentBtn").addEventListener("click", () => box.remove());
  box.querySelector(".submitInlineCommentBtn").addEventListener("click", submitInlineReply);
}

async function submitInlineReply(e) {
  const commentId = e.target.dataset.comment;
  const box = e.target.closest(".inlineCommentBox");
  const text = box.querySelector(".commentInput").value.trim();

  if (!text) return;

  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("discussion_comment_comments")
    .insert({
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
