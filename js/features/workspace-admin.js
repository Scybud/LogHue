import { attachSidebarEvents } from "./../components/sidebar.js";
import { openCreateTaskModal } from "./../utils/modals.js";
import { supabase } from "../supabase.js";

let currentWorkspace = null;
export let loadedMembers = [];

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".navBtn");
  if (!btn) return;

  const container = document.getElementById("adminWorkspaceDashboardContent");

  const section = btn.dataset.section;

  renderSection(section, currentWorkspace, container);
});

export async function initWorkspaceData() {
  
  //Get workspace url
  const params = new URLSearchParams(window.location.search);
  const workspaceId = params.get("ws");

  if (!workspaceId) {
    window.location.href = "index.html";
    return;
  }

  //Load data
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      `*, workspace_tasks(*), workspace_members(role, profiles (id, full_name, avatar_url))`,
    )
    .eq("id", workspaceId)
    .single();

    currentWorkspace = workspace;

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  const adminWorkspaceDashboardContent = document.getElementById(
    "adminWorkspaceDashboardContent",
  );

  if (!workspace || workspaceId.length < 10) {
    window.location.href = "index.html";
    return;
  }

  const workspaceName = document.getElementById("workspaceName");

  if (workspace) {
    document.title = workspace.name;
  }

  if (workspace && workspaceName) {
    workspaceName.innerHTML = `${workspace.name} <span class="tag">Admin</span>`;
  }

  if (adminWorkspaceDashboardContent) {
    adminWorkspaceDashboardContent.innerHTML = "";
  }

  if (workspace && adminWorkspaceDashboardContent) {
    loadCreatedTasks(
      workspace.workspace_tasks || [],
      adminWorkspaceDashboardContent,
    );
  }

  attachSidebarEvents();

const members = Array.isArray(workspace.workspace_members)
    ? workspace.workspace_members
    : [workspace.workspace_members];

loadedMembers = members;

  workspace.workspace_tasks = workspace.workspace_tasks || [];

  openCreateTaskModal(currentWorkspace.id);
}

function renderSection(section, workspace, container) {
  container.innerHTML = "";
  const allLogs = workspace.workspace_tasks.flatMap((task) => {
    return (task.logs || []).map((log) => ({
      ...log,
      task_title: task.title,
      task_id: task.id,
    }));
  });

  switch (section) {
    case "createdTasks":
      const tasks = Array.isArray(workspace.workspace_tasks)
    ? workspace.workspace_tasks
    : [workspace.workspace_tasks];

      loadCreatedTasks(tasks|| [], container);
      break;

    case "members":
  const members = Array.isArray(workspace.workspace_members)
    ? workspace.workspace_members
    : [workspace.workspace_members];

loadedMembers = members;

  loadMembers(members, container);
  break;

    case "activities":
      loadActivities(allLogs || [], container);
      break;
  }
}

export function loadCreatedTasks(tasks, container) {
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<p class="placeholderText">No tasks created yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = "Created Tasks";

  const divGrid = document.createElement("div");
  divGrid.classList.add("container");

  tasks.forEach((tsk) => {
    const taskCard = document.createElement("div");
    taskCard.classList.add("card", "taskCard");

    const taskTitle = document.createElement("h3");
    taskTitle.classList.add("taskTitle");
    taskTitle.textContent = tsk.title;

    const taskMeta = document.createElement("p");
    taskMeta.classList.add("taskMeta", "meta");

    const assignToMemberBtn = document.createElement("button");
    assignToMemberBtn.classList.add(
      "btn",
      "btn-primary",
      "btn-sm",
      "assignToMemberBtn",
    );
    assignToMemberBtn.textContent = "Assign to Member";

    if (tsk.assigned_to === "") {
      taskMeta.textContent = `Unassigned`;
      taskCard.append(taskTitle, taskMeta, assignToMemberBtn);
    } else {
      taskMeta.textContent = `Assigned to: ${tsk.profiles.full_name}`;
      taskCard.append(taskTitle, taskMeta);
    }

    divGrid.append(taskCard);
  });

  section.append(sectionTitle, divGrid);
  container.append(section);
}

function loadMembers(members, container) {
  if (!members || members.length === 0) {
    container.innerHTML = `<p class="placeholderText">No members found.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = "Workspace Members";

  const divGrid = document.createElement("div");
  divGrid.classList.add("grid");

  members.forEach((mbr) => {
    const memberCard = document.createElement("div");
    memberCard.classList.add("card", "memberCard");

    const memberName = document.createElement("h3");
    memberName.classList.add("memberName");
    memberName.textContent = mbr.profiles.full_name;

    const tag = document.createElement("span");
    tag.classList.add("tag");
    tag.textContent = mbr.role;
    memberName.append(tag);

    const avatar = document.createElement("img")
    avatar.classList.add("profileImg")
    avatar.src = mbr.profiles.avatar_url;

    const cardHeader = document.createElement("div")
    cardHeader.classList.add("cardHeader");
    cardHeader.append(avatar, memberName);

    const assignTaskBtn = document.createElement("button");
    assignTaskBtn.id = "assignTaskBtn";
    assignTaskBtn.classList.add("btn", "btn-sm", "btn-primary")
    assignTaskBtn.textContent = "Assign Task"

    const adminActions = document.createElement("div")
    adminActions.classList.add("adminActions")
adminActions.append(assignTaskBtn)

    memberCard.append(cardHeader, adminActions);
    divGrid.append(memberCard);
  });

  section.append(sectionTitle, divGrid);
  container.append(section);
}

export function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "long", // February
    day: "numeric", // 11
    year: "numeric", // 2026
    hour: "2-digit", // 12
    minute: "2-digit", // 27
  });
}

function createLogElement(log) {
  const taskDetails = document.createElement("details");
  taskDetails.classList.add("loggedActivityContainer");
  taskDetails.dataset.id = log.id;

  const taskSummary = document.createElement("summary");
  taskSummary.title = "click to see details";
  taskSummary.innerHTML = `<span class="personalTaskName">${log.note}</span> 
 <div class="actionConatiner">
 <button data-title="Comment" type="button" class="commentBtn tooltip">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>
</svg>
</button>
 <button data-title="Mark as reviewed" type="button" class="markAsReviwedBtn tooltip">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="20 6 9 17 4 12" />
</svg>
 </button>
 </div>
 `;

  const taskTime = document.createElement("span");
  taskTime.classList.add("meta", "taskTime");
  taskTime.textContent = formatDateTime(log.date);

  const taskName = document.createElement("span");
  taskName.classList.add("meta", "taskName");
  taskName.textContent = `Task: ${log.task_title}`;

  const taskProgress = document.createElement("span");
  taskProgress.classList.add("meta", "taskProgress");
  taskProgress.textContent = log.progress;

  const meta = document.createElement("div");
  meta.classList.add("metaRow");
  meta.append(taskName, taskTime, taskProgress);

  taskDetails.append(taskSummary, meta);
  return taskDetails;
}

function loadActivities(allLogs, container) {
  if (!allLogs || allLogs.length === 0) {
    container.innerHTML = `<p class="placeholderText">No activity in this workspace yet.</p>`;
    return;
  }
  const section = document.createElement("section");
  section.classList.add("section");

  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = "Activities";

  const divGrid = document.createElement("div");
  divGrid.classList.add("container");

  allLogs.forEach((act) => {
    const taskDetails = createLogElement(act);

    divGrid.append(taskDetails);
  });

  section.append(sectionTitle, divGrid);
  container.append(section);
}
