import { attachSidebarEvents } from "./../components/sidebar.js";
import { supabase } from "../supabase.js";
import { closeModal } from "../ui.js";

export let currentWorkspace = null;
export let loadedMembers = [];

// -----------------------------
// NAVIGATION
// -----------------------------
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".navBtn");
  if (!btn) return;

  const container = document.getElementById("memberWorkspaceDashboardContent");
  const section = btn.dataset.section;

  renderSection(section, currentWorkspace, container);
});

// -----------------------------
// MEMBER ACCESS CHECK
// -----------------------------
async function checkMemberAccess(workspaceId) {
  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", (await supabase.auth.getUser()).data.user.id)
    .single();

  if (error || membership.role !== "member") {
    alert("Access Denied: You cannot access this workspace.");
    window.location.href = "/index";
  }
}

// -----------------------------
// INITIALIZATION
// -----------------------------
export async function initMemberWorkspaceData() {
  const params = new URLSearchParams(window.location.search);
  const workspaceId = params.get("ws");

  if (!workspaceId) {
    window.location.href = "/index";
    return;
  }

  await checkMemberAccess(workspaceId);

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      `*, 
       workspace_tasks(*, profiles:assigned_to (id, full_name, avatar_url)), 
       workspace_members(role, profiles (id, full_name, avatar_url))`,
    )
    .eq("id", workspaceId)
    .single();

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  currentWorkspace = workspace;

  const container = document.getElementById("memberWorkspaceDashboardContent");
  const workspaceName = document.getElementById("workspaceName");

  if (workspaceName) {
    workspaceName.innerHTML = `${workspace.name} <span class="tag">Member</span>`;
  }

  if (container) {
    container.innerHTML = "";
    loadCreatedTasks(workspace.workspace_tasks || [], container);
  }

  attachSidebarEvents();

  loadedMembers = Array.isArray(workspace.workspace_members)
    ? workspace.workspace_members
    : [workspace.workspace_members];

  workspace.workspace_tasks = workspace.workspace_tasks || [];
}

// -----------------------------
// SECTION RENDERER
// -----------------------------
async function renderSection(section, workspace, container) {
  container.innerHTML = "";

  const allLogs = workspace.workspace_tasks.flatMap((task) =>
    (task.logs || []).map((log) => ({
      ...log,
      task_title: task.title,
      task_id: task.id,
    })),
  );

  switch (section) {
    case "myTasks":
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const myTasks = workspace.workspace_tasks.filter(
    (t) => String(t.assigned_to) === String(user.id)
  );

  loadCreatedTasks(myTasks, container);
  break;


    case "allTasks":
      loadCreatedTasks(workspace.workspace_tasks || [], container);
      break;

    case "members":
      loadMembers(loadedMembers, container);
      break;

    case "activities":
      loadActivities(allLogs || [], container);
      break;

    case "discussions":
      loadDiscussions();
      break;
  }
}

// -----------------------------
// TASK LIST (READ‑ONLY)
// -----------------------------
export function loadCreatedTasks(tasks, container) {
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<p class="placeholderText">No tasks created yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "Tasks";

  const grid = document.createElement("div");
  grid.classList.add("container");

  tasks.forEach((tsk) => {
    const card = document.createElement("div");
    card.classList.add("card", "taskCard");

    const taskTitle = document.createElement("h3");
    taskTitle.textContent = tsk.title;

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Description";

    const desc = document.createElement("p");
    desc.textContent = tsk.description;

    details.append(summary, desc);

    const meta = document.createElement("div");
    meta.classList.add("taskMeta");

    const assignee = document.createElement("p");
    assignee.classList.add("meta");
    assignee.textContent = tsk.assigned_to
      ? `Assigned to: ${tsk.profiles.full_name}`
      : "Unassigned";

    const assignedOn = document.createElement("p");
    assignedOn.classList.add("meta");
    assignedOn.textContent = `Assigned on: ${formatDateTime(tsk.created_at)}`;

    meta.append(assignee, assignedOn);

    card.append(taskTitle, meta, details);
    grid.append(card);
  });

  section.append(title, grid);
  container.append(section);
}

// -----------------------------
// MEMBERS LIST (READ‑ONLY)
// -----------------------------
function loadMembers(members, container) {
  if (!members || members.length === 0) {
    container.innerHTML = `<p class="placeholderText">No members found.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "Workspace Members";

  const grid = document.createElement("div");
  grid.classList.add("grid");

  members.forEach((mbr) => {
    const card = document.createElement("div");
    card.classList.add("card", "memberCard");

    const name = document.createElement("h3");
    name.classList.add("memberName");
    name.textContent = mbr.profiles.full_name;

    const tag = document.createElement("span");
    tag.classList.add("tag");
    tag.textContent = mbr.role;

    const avatar = document.createElement("img");
    avatar.classList.add("profileImg");
    avatar.src = mbr.profiles.avatar_url;

    const header = document.createElement("div");
    header.classList.add("cardHeader");
    header.append(tag, avatar, name);

    card.append(header);
    grid.append(card);
  });

  section.append(title, grid);
  container.append(section);
}

// -----------------------------
// ACTIVITIES (READ‑ONLY)
// -----------------------------
function loadActivities(allLogs, container) {
  if (!allLogs || allLogs.length === 0) {
    container.innerHTML = `<p class="placeholderText">No activity in this workspace yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "Activities";

  const grid = document.createElement("div");
  grid.classList.add("container");

  allLogs.forEach((log) => {
    const details = document.createElement("details");
    details.classList.add("loggedActivityContainer");

    const summary = document.createElement("summary");
    summary.innerHTML = `<span class="personalTaskName">${log.note}</span>`;

    const meta = document.createElement("div");
    meta.classList.add("metaRow");

    const taskName = document.createElement("span");
    taskName.classList.add("meta");
    taskName.textContent = `Task: ${log.task_title}`;

    const time = document.createElement("span");
    time.classList.add("meta");
    time.textContent = formatDateTime(log.date);

    const progress = document.createElement("span");
    progress.classList.add("meta");
    progress.textContent = log.progress;

    meta.append(taskName, time, progress);
    details.append(summary, meta);

    grid.append(details);
  });

  section.append(title, grid);
  container.append(section);
}

// -----------------------------
// UTIL
// -----------------------------
export function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
