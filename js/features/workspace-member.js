import { attachSidebarEvents } from "./../components/sidebar.js";
import { supabase } from "../supabase.js";
import { closeModal } from "../ui.js";
import { openLogTaskModal } from "../utils/modals.js";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (container) {
    container.innerHTML = "";

    //LOAD ASSIGNED TASKS BY DEFAULT

    const myTasks = workspace.workspace_tasks.filter(
      (t) => String(t.assigned_to) === String(user.id),
    );
    loadAssignedTasks(myTasks || [], container);
  }

  
  attachSidebarEvents();
  
  loadedMembers = Array.isArray(workspace.workspace_members)
  ? workspace.workspace_members
  : [workspace.workspace_members];
  
  workspace.workspace_tasks = workspace.workspace_tasks || [];

  openLogTaskModal(supabase, workspaceId, user.id);
}

// -----------------------------
// SECTION RENDERER
// -----------------------------
async function renderSection(section, workspace, container) {
  if(!container) return;
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
        (t) => String(t.assigned_to) === String(user.id),
      );

      loadAssignedTasks(myTasks, container);
      break;

    case "allTasks":
      loadAllTasks(workspace.workspace_tasks || [], container);
      break;

    case "members":
      loadMembers(loadedMembers, container);
      break;

    case "activities":
     const { data: logs, error } = await supabase
       .from("workspace_task_logs")
       .select(
         `
    *,
    profiles:created_by (full_name, avatar_url),
    workspace_tasks:task_id (title)
  `,
       )
       .eq("workspace_id", workspace.id)
       .order("created_at", { ascending: false });


      loadActivities(logs || [], container);
      break;

    case "discussions":
      loadDiscussions();
      break;
  }
}


// -----------------------------
// MY TASKS LIST
// -----------------------------
export function loadAssignedTasks(tasks, container) {
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<p class="placeholderText">No tasks assigned yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "My Tasks";

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

    const viewBtn = document.createElement("button");
    viewBtn.classList.add("btn", "btn-sm", "btn-primary");
    viewBtn.textContent = "View Task";

    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `https://app.loghue.com/task-view?task=${tsk.id}`;
    });

    details.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    card.append(taskTitle, meta, details, viewBtn);
    grid.append(card);
  });

  section.append(title, grid);
  container.append(section);
}

// -----------------------------
// TASK LIST (READ‑ONLY)
// -----------------------------
export function loadAllTasks(tasks, container) {
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<p class="placeholderText">No tasks created yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "All Tasks";

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
function loadActivities(logs, container) {
  if (!logs || logs.length === 0) {
    container.innerHTML = `<p class="placeholderText">No activity in this workspace yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "Activities";

  const list = document.createElement("div");
  list.classList.add("activityList");

  logs.forEach((log) => {
    const item = document.createElement("div");
    item.classList.add("activityItem");

    item.innerHTML = `
      <div class="activityHeader">
        <img class="profileImg" src="${log.profiles?.avatar_url || "/assets/default-avatar.png"}" />
        <span class="actorName">${log.profiles?.full_name || "Unknown User"}
         gave an update on
        "${log.workspace_tasks?.title || "Unknown Task"}"</span>
      </div>

      <div class="activityBody">
        <p><strong>Note:</strong> ${log.log_note}</p>
        <p><strong>Status:</strong> ${log.task_status}</p>
      </div>

      <div class="activityTime">
        ${new Date(log.created_at).toLocaleString()}
      </div>
    `;

    list.appendChild(item);
  });

  section.append(title, list);
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


