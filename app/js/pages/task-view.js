// task-view.js
import { supabase } from "../supabase.js";
import { actionMsg } from "../utils/modals.js";
import { notifyUser } from "../utils/notifications.js";
import {
  setButtonLoading,
  loadComponent,
  closeModal,
} from "https://ui.scybud.com/js/ui.js";
import { loadActivities } from "./workspace/activities.js";
import { formatDateTime, formatDateTimeRelatively } from "../utils/time.js";
import { populateAssignDropdown } from "../utils/modalEvents.js";
import { loadWorkspaceMembersForTaskView } from "../data/tasksDb.js";
import { openFocusTimerModal } from "../components/focus-timer.js";
import { makeCollapsible } from "../utils/toggle.js";
import {
  renderFormattedText,
  renderFormattedTextWithLink,
} from "../utils/formatText.js";

let currentTask = null;
let currentWorkspace = null;
let userRole = null;
let userId = null;
let isAdmin = false;
let isCreator = false;

// Auth / Role
async function getUserRole(workspaceId) {
  const { data: userData } = await supabase.auth.getUser();
  userId = userData?.user?.id ?? null;

  if (!userId || !workspaceId) return null;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return { userId, role: data.role };
}

// Init
document.addEventListener("DOMContentLoaded", initTaskView);

async function initTaskView() {
  const params = new URLSearchParams(window.location.search);
  const taskId = params.get("task");

  if (!taskId) {
    actionMsg(
      "Task does not exist or you do not have access to it.",
      "warning",
    );
    setTimeout(() => (window.location.href = "dashboard"), 5000);
    return;
  }

  await loadTask(taskId);
  await loadWorkspaceMembersForTaskView(currentWorkspace?.id);
  userRole = await getUserRole(currentWorkspace?.id);

  loadSidebar();
  renderTaskHeader();
  renderLogs();
  loadWorkspaceActivities();
  attachLogSubmitHandler();
}

// Data loading

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
    .maybeSingle();

  if (error) {
    console.error(error);
    document.getElementById("taskViewContent").innerHTML =
      `<p class="placeholderText">Invalid task link. <a href="index">Go Home</a></p>`;
    loadSidebar();
    actionMsg("Failed to load task.", "error");
    return;
  }

  currentTask = data;
  currentWorkspace = data?.workspace;
}

async function loadWorkspaceActivities() {
  if (!currentWorkspace?.id) return;

  const { data: logs } = await supabase
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

  const { data: discussions } = await supabase
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

  const normalizedDiscussions = (discussions || []).map((d) => ({
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

  const container = document.getElementById("workspaceActivities");
  if (container) loadActivities(activities, container);
}

// Sidebar
function loadSidebar() {
  const taskSidebar = document.getElementById("taskSidebar");
  if (!taskSidebar) return;

  if (!userRole) {
    taskSidebar.innerHTML = `
      <nav>
        <a href="dashboard" class="navBtn" data-section="index" id="dashboardLink">
          <span class="navIcon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M11.75 4.25L6 10L11.75 15.75" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="navText">Dashboard</span>
        </a>
      </nav>`;
    return;
  }

  taskSidebar.innerHTML = `
    <button type="button" class="menuBtn" id="closeSidebar">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3.5" y="3.5" width="17" height="17" rx="6" ry="6" fill="currentColor" opacity="0.06"/>
        <path d="M9 9l6 6M15 9l-6 6"/>
      </svg>
    </button>

    <nav class="sidebarNav">
      <a href="workspace?ws=${currentWorkspace.id}" class="navBtn">
        <span class="navIcon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M11.75 4.25L6 10L11.75 15.75" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="navText">Workspace</span>
      </a>

      <a href="dashboard" class="navBtn">
        <span class="navIcon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M11.75 4.25L6 10L11.75 15.75" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="navText">Dashboard</span>
      </a>
    </nav>`;

  document.getElementById("closeSidebar")?.addEventListener("click", () => {
    taskSidebar.classList.toggle("slideShow");
  });
}

// Task header

function renderTaskHeader() {
  const container = document.querySelector(".taskHeader");
  if (!container) return;

  isAdmin = userRole?.role === "admin" || userRole?.role === "owner";
  isCreator = currentTask?.created_by === userId;

  const canManage = isAdmin || isCreator;

  container.innerHTML = `
    <div class="taskHeaderTop">
      <h2>${currentTask.title || "Untitled"}</h2>
      <div class="taskActions">
        ${
          canManage
            ? `
          <button id="markTaskDoneBtn" class="iconBtn tooltip btn-sm"
            data-title="${currentTask.status === "completed" ? "Reopen task" : "Mark task as completed"}"
            type="button"
            aria-label="${currentTask.status === "completed" ? "Reopen task" : "Mark task as completed"}">
            ${
              currentTask.status === "completed"
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>`
            }
          </button>

          <button id="editTaskBtn" class="iconBtn tooltip btn-sm" data-title="Edit task" type="button" aria-label="Edit task">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
          </button>`
            : ""
        }

        <button id="focusTimerBtn" class="iconBtn tooltip btn-sm" data-title="Open focus timer" type="button" aria-label="Open focus timer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="13" r="8"/>
            <path d="M12 9v4l2 2"/>
            <path d="M9 2h6"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="taskMeta">
      <div class="metaItem">
        <span class="metaLabel">Assigned To:</span>
        <div class="avatarGroup">
          <img src="${currentTask.profiles?.avatar_url || "../../assets/images/default_profile.png"}" class="profileImg" />
          <span>${currentTask.profiles?.full_name || "Unassigned"}</span>
        </div>
      </div>

      <div class="metaItem">
        <span class="metaLabel">Status:</span>
        <span class="statusBadge ${currentTask.status.replace(" ", "-")}">${currentTask.status}</span>
      </div>

      <div class="metaItem">
        <span class="metaLabel">Created:</span>
        <span>${formatDateTimeRelatively(currentTask.created_at)}</span>
      </div>

      <div class="metaItem">
        <span class="metaLabel">Due Date:</span>
        <span id="taskDueDate">${currentTask.task_deadline ? formatDateTime(currentTask.task_deadline) : "No deadline"}</span>
      </div>
    </div>
  `;

  const description = document.createElement("div");
  description.className = "taskDescription";

  if (currentTask.description?.trim()) {
    renderFormattedTextWithLink(currentTask.description, description);
    makeCollapsible(description);
  } else {
    description.textContent = "No description provided.";
  }

  container.appendChild(description);
  attachTaskHeaderEvents();
}

/** Single source of truth for all interactive buttons in the header */
function attachTaskHeaderEvents() {
  // Mark done / reopen
  const markBtn = document.getElementById("markTaskDoneBtn");
  if (markBtn) {
    markBtn.onclick = async () => {
      if (markBtn.disabled) return;
      setButtonLoading(markBtn, true);

      try {
        const newStatus =
          currentTask.status === "completed" ? "in progress" : "completed";

        const { error } = await supabase
          .from("workspace_tasks")
          .update({
            status: newStatus,
            completed_at:
              newStatus === "completed" ? new Date().toISOString() : null,
          })
          .eq("id", currentTask.id);

        if (error) {
          actionMsg(error.message, "error");
          return;
        }

        await loadTask(currentTask.id);
        renderTaskHeader();
        renderLogs();
      } finally {
        setButtonLoading(markBtn, false);
      }
    };
  }

  // Focus timer
  const focusBtn = document.getElementById("focusTimerBtn");
  if (focusBtn) {
    focusBtn.onclick = async () => {
      if (focusBtn.disabled) return;
      focusBtn.disabled = true;
      try {
        await openFocusTimerModal(currentTask);
      } finally {
        focusBtn.disabled = false;
      }
    };
  }

  // Edit
  const editBtn = document.getElementById("editTaskBtn");
  if (editBtn) {
    editBtn.onclick = async () => {
      if (editBtn.disabled) return;
      editBtn.disabled = true;
      try {
        await openEditTaskModal(currentTask.id);
      } finally {
        editBtn.disabled = false;
      }
    };
  }
}

// Edit task modal
async function openEditTaskModal(taskId) {
  await loadComponent("../components/modals/create-task", "modalContainer");

  const modalContainer = document.getElementById("modalContainer");
  const titleEl = modalContainer.querySelector("h2");
  const titleInput = document.getElementById("taskTitle");
  const deadlineInput = document.getElementById("taskDueDate");
  const descriptionInput = document.getElementById("taskDescription");
  const assignDropdown = document.getElementById("assignToDropdown");
  const saveBtn = document.getElementById("createTaskBtn");

  populateAssignDropdown(assignDropdown);

  const { data: task, error } = await supabase
    .from("workspace_tasks")
    .select("id, title, task_deadline, description, assigned_to")
    .eq("id", taskId)
    .maybeSingle();

  if (error || !task) {
    console.error(error);
    actionMsg("Failed to load task for editing.", "error");
    return;
  }

  titleEl.textContent = "Edit Task";
  titleInput.value = task.title;
  deadlineInput.value = task.task_deadline
    ? new Date(task.task_deadline).toISOString().slice(0, 16)
    : "";
  descriptionInput.value = task.description || "";
  assignDropdown.value = task.assigned_to || "";
  saveBtn.textContent = "Update Task";

  // Replace button to clear any previous listeners
  const freshBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(freshBtn, saveBtn);

  freshBtn.addEventListener("click", async () => {
    if (freshBtn.disabled) return;
    setButtonLoading(freshBtn, true);

    try {
      const { error } = await supabase
        .from("workspace_tasks")
        .update({
          title: titleInput.value.trim(),
          task_deadline: deadlineInput.value
            ? new Date(deadlineInput.value).toISOString()
            : null,
          description: descriptionInput.value.trim(),
          assigned_to: assignDropdown.value || null,
        })
        .eq("id", taskId);

      if (error) {
        console.error(error);
        actionMsg("Failed to update task", "error");
        return;
      }

      actionMsg("Task updated!", "success");
      closeModal();
      setTimeout(() => window.location.reload(), 1500);
    } finally {
      setButtonLoading(freshBtn, false);
    }
  });
}

// Logs
function renderLogs() {
  const feed = document.getElementById("logsFeed");
  if (!feed) return;

  feed.innerHTML = "";
  isAdmin = userRole?.role === "admin" || userRole?.role === "owner";

  if (!currentTask.logs?.length) {
    feed.innerHTML = `<p class="placeholderText">No logs yet.</p>`;
    return;
  }

  currentTask.logs.forEach((log) => {
    const card = document.createElement("div");
    card.className = "logCard";
    if (log.id) card.id = log.id;

    // Header
    const header = document.createElement("div");
    header.className = "logHeader";

    const avatar = document.createElement("img");
    avatar.src = log.profiles?.avatar_url || "/assets/default-avatar.png";
    avatar.className = "profileImg";

    const info = document.createElement("div");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = log.profiles?.full_name || "Unknown User";

    const time = document.createElement("div");
    time.className = "timestamp";
    time.textContent = formatDateTimeRelatively(log.created_at);

    info.append(name, time);
    header.append(avatar, info);

    // Content
    const content = document.createElement("div");
    content.className = "logContent";
    renderFormattedText(log.log_note, content);
    makeCollapsible(content);

    // Status
    const statusClass = ["in progress", "in_progress"].includes(log.task_status)
      ? "in-progress"
      : "completed";

    const meta = document.createElement("div");
    meta.className = "logMeta";
    const badge = document.createElement("span");
    badge.className = `statusBadge ${statusClass}`;
    badge.textContent = log.task_status;
    meta.appendChild(badge);

    // Comments thread
    const thread = document.createElement("div");
    thread.className = "commentsThread";
    appendLogComments(log.comments, thread);

    card.append(header, content, meta, thread);

    // Reply button (admins / creator only)
    if (isAdmin || isCreator) {
      const replyBtn = document.createElement("button");
      replyBtn.className = "iconBtn addCommentBtn";
      replyBtn.dataset.log = log.id;
      replyBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>
        </svg>
        Comment`;
      card.append(replyBtn);
    }

    feed.prepend(card);
  });

  attachCommentHandlers();
}

function appendLogComments(comments, container) {
  if (!comments?.length) return;

  comments.forEach((c) => {
    const el = document.createElement("div");
    el.className = "comment";

    const avatar = document.createElement("img");
    avatar.src = c.profiles?.avatar_url || "/assets/default-avatar.png";
    avatar.className = "profileImg";

    const body = document.createElement("div");
    body.className = "commentBody";

    const text = document.createElement("div");
    text.className = "commentText";
    renderFormattedText(c.comment, text);
    makeCollapsible(text);

    const time = document.createElement("div");
    time.className = "timestamp";
    time.textContent = formatDateTimeRelatively(c.created_at);

    body.append(text, time);
    el.append(avatar, body);
    container.appendChild(el);
  });
}

// Add log
function attachLogSubmitHandler() {
  const btn = document.getElementById("submitLogBtn");
  const input = document.getElementById("logInput");
  if (!btn || !input) return;

  const isAssignee = userId === currentTask.assigned_to;
  const canLog = isAdmin || isAssignee || isCreator;

  if (!canLog || currentTask.status === "completed") {
    btn.remove();
    input.remove();
    return;
  }

  btn.addEventListener("click", async () => {
    const note = input.value.trim();
    if (!note) {
      actionMsg("Write something before submitting.", "error");
      return;
    }

    setButtonLoading(btn, true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("workspace_task_logs")
        .insert({
          workspace_id: currentWorkspace.id,
          task_id: currentTask.id,
          created_by: userData.user.id,
          log_note: note,
          task_status: currentTask.status,
        })
        .select()
        .single();

      if (error) {
        actionMsg("Failed to add log entry.", "error");
        return;
      }

      // Notify task creator if someone else logged
      if (
        currentTask.created_by &&
        currentTask.created_by !== userData.user.id
      ) {
        await notifyUser({
          workspaceId: currentWorkspace.id,
          receiverUserId: currentTask.created_by,
          actorId: userData.user.id,
          type: "task_logged",
          entityId: data.id,
          entityType: "log",
        });
      }

      input.value = "";
      await loadTask(currentTask.id);
      renderLogs();
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// Inline comments
function attachCommentHandlers() {
  document.querySelectorAll(".addCommentBtn").forEach((btn) => {
    btn.addEventListener("click", () => openInlineCommentBox(btn.dataset.log));
  });
}

function openInlineCommentBox(logId) {
  // Close any open boxes first
  document.querySelectorAll(".inlineCommentBox").forEach((el) => el.remove());

  const logCard = document
    .querySelector(`.addCommentBtn[data-log="${logId}"]`)
    ?.closest(".logCard");
  if (!logCard) return;

  if (currentTask.status === "completed") {
    const err = document.createElement("p");
    err.className = "error";
    err.textContent = "You cannot comment on tasks marked as completed.";
    logCard.appendChild(err);
    return;
  }

  const box = document.createElement("div");
  box.className = "inlineCommentBox";
  box.innerHTML = `
    <textarea class="inputField commentInput" placeholder="Write a comment..."></textarea>
    <div class="commentActions">
      <button class="secondaryBtn cancelCommentBtn">Cancel</button>
      <button class="primaryBtn submitInlineCommentBtn" data-log="${logId}">Submit</button>
    </div>
  `;

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
    actionMsg("Failed to add comment.", "error");
    return;
  }

  box.remove();
  await loadTask(currentTask.id);
  renderLogs();
}

// Misc
const reloadBtn = document.querySelector(".reloadBtn");
reloadBtn?.addEventListener("click", () => window.location.reload());
