import { supabase } from "../supabase.js";
import { formatDateTime } from "./workspace-admin.js";

let currentTask = null;
let currentWorkspace = null;
let userRole = null;

//GET USER ROLE
async function getUserRole(workspaceId) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user.id;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return { userId, role: data.role };
}

// INIT
document.addEventListener("DOMContentLoaded", initTaskView);

async function initTaskView() {
  const params = new URLSearchParams(window.location.search);
  const taskId = params.get("task");

  if (!taskId) {
    document.getElementById("taskViewContent").innerHTML =
      `<p class="placeholderText">Invalid task link.</p>`;
    return;
  }
  loadTask.remove;
  await loadTask(taskId);

  userRole = await getUserRole(currentWorkspace.id);

  renderTaskHeader();
  renderLogs();
  attachLogSubmitHandler();
  attachMarkDoneHandler(taskId);
}

/* ---------------------------------------------
   LOAD TASK + LOGS + COMMENTS
--------------------------------------------- */
async function loadTask(taskId) {
  const { data, error } = await supabase
    .from("workspace_tasks")
    .select(
      `
      *,
      profiles:assigned_to (id, full_name, avatar_url),
      workspace:workspace_id (id, name),
      logs:workspace_task_logs (
        id,
        log_note,
        task_status,
        created_at,
        profiles:created_by (full_name, avatar_url),
        comments:workspace_task_log_comments (
          id,
          comment,
          created_at,
          profiles:created_by (full_name, avatar_url)
        )
      )
    `,
    )
    .eq("id", taskId)
    .single();

  if (error) {
    console.error(error);
    alert("Failed to load task.");
    return;
  }

  currentTask = data;
  currentWorkspace = data.workspace;
}

/* ---------------------------------------------
   RENDER TASK HEADER
--------------------------------------------- */
function renderTaskHeader() {
  const container = document.querySelector(".taskHeader");
  if (!container) return;

  const isAdmin = userRole.role === "admin" || userRole.role === "owner";

  container.innerHTML = `
    <div class="taskHeaderTop">
      <h2>${currentTask.title}</h2>
      <div class="taskActions">
      ${
        isAdmin
          ? `
           <button id="markTaskDoneBtn" class="primaryBtn btn btn-sm">
          ${currentTask.status === "completed" ? "Reopen Task" : "Mark as completed"}
        </button>
         `
          : ""
      }
      </div>
    </div>

    <div class="taskMeta">
      <div class="metaItem">
        <span class="metaLabel">Assigned To:</span>
        <div class="avatarGroup">
          <img src="${currentTask.profiles?.avatar_url || "/assets/default-avatar.png"}" class="profileImg" />
          <span>${currentTask.profiles?.full_name || "Unassigned"}</span>
        </div>
      </div>

      <div class="metaItem">
        <span class="metaLabel">Status:</span>
        <span class="statusBadge">${currentTask.status}</span>
      </div>

      <div class="metaItem">
        <span class="metaLabel">Created:</span>
        <span>${formatDateTime(currentTask.created_at)}</span>
      </div>
    </div>

    <p class="taskDescription">${currentTask.description || "No description provided."}</p>
  `;
}

/* ---------------------------------------------
   RENDER LOGS + COMMENTS
--------------------------------------------- */
function renderLogs() {
  const feed = document.getElementById("logsFeed");
  feed.innerHTML = "";

  const isAdmin = userRole.role === "admin" || userRole.role === "owner";

  if (!currentTask.logs || currentTask.logs.length === 0) {
    feed.innerHTML = `<p class="placeholderText">No logs yet.</p>`;
    return;
  }

  currentTask.logs.forEach((log) => {
    const logCard = document.createElement("div");
    logCard.classList.add("logCard");

    logCard.innerHTML = `
      <div class="logHeader">
        <img src="${log.profiles?.avatar_url || "/assets/default-avatar.png"}" class="profileImg" />
        <div>
          <span class="name">${log.profiles?.full_name || "Unknown User"}</span>
          <div class="timestamp">${formatDateTime(log.created_at)}</div>
        </div>
      </div>

      <div class="logContent">${log.log_note}</div>

      <div class="logMeta">
        <span class="statusBadge">${log.task_status}</span>
      </div>

      <div class="commentsThread">
        ${renderCommentsHTML(log.comments)}
      </div>

      ${
        isAdmin
          ? `
        <button class="iconBtn addCommentBtn" data-log="${log.id}">
        <svg
  width="18"
  height="18"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path
    d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
  />
</svg>
 Comment
      </button>
      `
          : ""
      }

      
    `;

    feed.appendChild(logCard);
  });

  attachCommentHandlers();
}

function renderCommentsHTML(comments) {
  if (!comments || comments.length === 0) return "";

  return comments
    .map(
      (c) => `
    <div class="comment">
      <img src="${c.profiles?.avatar_url || "/assets/default-avatar.png"}" class="profileImg" />
      <div class="commentBody">
        <div>${c.comment}</div>
        <div class="timestamp">${formatDateTime(c.created_at)}</div>
      </div>
    </div>
  `,
    )
    .join("");
}

/* ---------------------------------------------
   ADD LOG
--------------------------------------------- */
function attachLogSubmitHandler() {
  const btn = document.getElementById("submitLogBtn");
  const input = document.getElementById("logInput");

  if (!btn || !input) return;

  // Only assigned member can write logs
  if (
    userRole.userId !== currentTask.assigned_to ||
    currentTask.status === "completed"
  ) {
    btn.remove();
    input.remove();

    return;
  }

  btn.addEventListener("click", async () => {
    const note = input.value.trim();
    if (!note) return;

    const { data: userData } = await supabase.auth.getUser();

    await supabase.from("workspace_task_logs").insert({
      workspace_id: currentWorkspace.id,
      task_id: currentTask.id,
      created_by: userData.user.id,
      log_note: note,
      task_status: currentTask.status,
    });

    input.value = "";
    await loadTask(currentTask.id);
    renderLogs();
  });
}

/* ---------------------------------------------
   MARK TASK DONE (DB + UI + LOGS)
--------------------------------------------- */
async function attachMarkDoneHandler(taskId) {
  const btn = document.getElementById("markTaskDoneBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const newStatus =
      currentTask.status === "completed" ? "in progress" : "completed";

    const { error } = await supabase
      .from("workspace_tasks")
      .update({ status: newStatus })
      .eq("id", taskId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadTask(currentTask.id);
    renderTaskHeader();
    renderLogs();
  });
}

/* ---------------------------------------------
   ADD COMMENT (INLINE INSIDE LOG)
--------------------------------------------- */
function attachCommentHandlers() {
  document.querySelectorAll(".addCommentBtn").forEach((btn) => {
    btn.addEventListener("click", () => openInlineCommentBox(btn.dataset.log));
  });
}

function openInlineCommentBox(logId) {
  // Close any existing comment boxes
  document.querySelectorAll(".inlineCommentBox").forEach((el) => el.remove());

  const logCard = document
    .querySelector(`.addCommentBtn[data-log="${logId}"]`)
    .closest(".logCard");

  const box = document.createElement("div");
  box.classList.add("inlineCommentBox");
  box.innerHTML = `
    <textarea class="inputField commentInput" placeholder="Write a comment..."></textarea>
    <div class="commentActions">
      <button class="secondaryBtn cancelCommentBtn">Cancel</button>
      <button class="primaryBtn submitInlineCommentBtn" data-log="${logId}">Submit</button>
    </div>
  `;

  const commentError = document.createElement("p");
  commentError.classList.add("error");
  commentError.textContent = "You cannot comment on tasks marked as completed.";

  if (currentTask.status === "completed") {
    logCard.appendChild(commentError);
    return;
  }

  logCard.appendChild(box);

  box
    .querySelector(".cancelCommentBtn")
    .addEventListener("click", () => box.remove());
  box
    .querySelector(".submitInlineCommentBtn")
    .addEventListener("click", submitInlineComment);
}

async function submitInlineComment(e) {
  const logId = e.target.dataset.log;
  const box = e.target.closest(".inlineCommentBox");
  const text = box.querySelector(".commentInput").value.trim();

  if (!text) return;

  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from("workspace_task_log_comments").insert({
    log_id: logId,
    created_by: userData.user.id,
    comment: text,
  });

  if (error) {
    alert("Failed to add comment.");
    return;
  }

  box.remove();

  await loadTask(currentTask.id);
  renderLogs();
}
