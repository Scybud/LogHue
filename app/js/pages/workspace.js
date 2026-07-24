import { attachSidebarEvents } from "../components/sidebar.js";
import {
  openCreateTaskModal,
  openAddMemeberModal,
  confirmAction,
  actionMsg,
  openTransferOwnershipModal,
  openApiKeyModal,
} from "../utils/modals.js";
import { supabase } from "../supabase.js";
import { loadComponent, closeModal } from "../ui.js";
import { openStartDiscussionModal, openLogTaskModal } from "../utils/modals.js";
import { sessionState } from "../session.js";
import { setButtonLoading } from "https://scybud.github.io/scybud-ui/js/ui.js";
import { navDropdowns } from "../components/sidebar.js";
import {
  archiveWorkspace,
  deleteWorkspace,
  editWorkspace,
} from "../features/workspaceData.js";
import { notifyUser } from "../utils/notifications.js";
import { showUploadStatus } from "../shared/workspace/utils.js";
import { formatDateTime } from "../utils/time.js";
import { loadApiKeys } from "../shared/workspace/api.js";
import {
  checkWorkspaceAccess,
  canRemoveMember as canRemoveMemberPermission,
  PERMISSIONS,
  applySidebarRole,
} from "../shared/workspace/permissions.js";

// -------------------------------------------------------------------
// Global state
// -------------------------------------------------------------------
export let currentWorkspace = null;
export let loadedMembers = [];
let user = null;
let isLoading = false;
let container;
let currentUserRole = null; // "owner", "admin", "member"

// For task assignment flow
let selectedAssigneeId = null;
let taskIdToAssign = null;

// Prevent duplicate global listeners
let tasksOutsideClickListener = null;
let docEventListenersAttached = false;

// -------------------------------------------------------------------
// Loading helper
// -------------------------------------------------------------------
function setLoading(state, container) {
  isLoading = state;
  container?.classList.toggle("isLoading", state);
}

// -------------------------------------------------------------------
// Role‑based access – checks membership, sets currentUserRole
// -------------------------------------------------------------------
async function ensureWorkspaceAccess(workspaceId, user) {
  const role = await checkWorkspaceAccess(workspaceId, user, [
    "owner",
    "admin",
    "member",
  ]);
  if (!role) {
    actionMsg("You are not a member of this workspace.", "error");
    window.location.href = "all-workspaces";
    return null;
  }
  return role;
}

// -------------------------------------------------------------------
// INITIALISATION – single entry point for all roles
// -------------------------------------------------------------------
export async function initWorkspaceData() {
  const params = new URLSearchParams(window.location.search);
  const workspaceId = params.get("ws");

  const { data, userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    console.error(userError);
    return;
  }
  user = data.user;

  if (!workspaceId) {
    window.location.href = "dashboard";
    return;
  }

  // 1. Determine role and stop if not a member
  currentUserRole = await ensureWorkspaceAccess(workspaceId, user);
  if (!currentUserRole) return; // already redirected

  container = document.getElementById("workspaceDashboardContent");
  setLoading(true, container);


  // 2. Now that sidebar DOM is present, apply role‑based visibility
  applySidebarRole(currentUserRole);

  // 3. Attach sidebar events (dropdowns, etc.)
  attachSidebarEvents();
  navDropdowns();

  // 4. Fetch workspace data
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      `*, workspace_tasks(*, profiles:assigned_to (id, full_name, avatar_url)), workspace_members(role, profiles (id, full_name, avatar_url, plan:plan_id (name)))`,
    )
    .eq("id", workspaceId)
    .single();

  if (error || !workspace) {
    console.error(error);
    actionMsg(workspace ? error.message : "Workspace not found.", "error");
    setLoading(false, container);
    return;
  }

  if (workspace.status === "closed") {
    actionMsg("This workspace has been archived.", "warning");
    setTimeout(() => (window.location.href = "archive"), 1500);
    return;
  }

  currentWorkspace = workspace;
  workspace.workspace_tasks = workspace.workspace_tasks || [];
  workspace.workspace_members = workspace.workspace_members || [];
  loadedMembers = Array.isArray(workspace.workspace_members)
    ? workspace.workspace_members
    : [workspace.workspace_members];

  // Page title & name
  document.title = workspace.name + " | LogHue";
  const workspaceNameEl = document.getElementById("workspaceName");
  if (workspaceNameEl) workspaceNameEl.textContent = workspace.name;

  // 5. Initial section content
  if (container) container.innerHTML = "";
  const myPermissions = PERMISSIONS[currentUserRole] || {};
  if (currentUserRole === "member") {
    const myTasks = workspace.workspace_tasks
      .filter((t) => String(t.assigned_to) === String(user.id))
      .filter((t) => t.status === "in progress");
    loadAssignedTasks("My Tasks", myTasks, container);
  } else {
    const tasks = workspace.workspace_tasks.filter(
      (t) => t.status === "in progress",
    );
    loadTasks("Created Tasks", tasks, container);
  }

  setLoading(false, container);

  // 6. Open modals based on permissions
  openStartDiscussionModal(currentWorkspace, user);

  if (myPermissions.createTask) {
    openCreateTaskModal(currentWorkspace.id);
  }
  if (myPermissions.inviteMembers || myPermissions.manageMembers) {
    openAddMemeberModal(currentWorkspace.id);
  }
  if (currentUserRole === "member") {
    openLogTaskModal(supabase, workspaceId, user.id);
  }
}

// -------------------------------------------------------------------
// Navigation handler – renderSection covers all roles
// -------------------------------------------------------------------
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".navBtn");
  if (!btn) return;

  container = document.getElementById("workspaceDashboardContent");
  const section = btn.dataset.section;
  setLoading(true, container);
  try {
    await new Promise(requestAnimationFrame);
    await renderSection(section, currentWorkspace, container);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false, container);
  }
});

// -------------------------------------------------------------------
// renderSection – handles every section, gated by permissions
// -------------------------------------------------------------------
async function renderSection(section, workspace, container) {
  if (!workspace || !container) return;
  container.innerHTML = "";

  // Safely get tasks array – never null
  const allTasks = Array.isArray(workspace.workspace_tasks)
    ? workspace.workspace_tasks
    : [];

  // Fetch discussions (shared by many sections)
  const { data: allDiscussions } = await supabase
    .from("discussions")
    .select(`*, profiles:created_by (full_name, avatar_url)`)
    .eq("workspace_id", workspace.id);

  const myPermissions = PERMISSIONS[currentUserRole] || {};

  switch (section) {
    // ----- Admin / owner sections -----
    case "createdTasks":
      loadTasks(
        "Created Tasks",
        allTasks.filter((t) => t.status === "in progress"),
        container,
      );
      break;

    case "members":
      loadedMembers = Array.isArray(workspace.workspace_members)
        ? workspace.workspace_members
        : [workspace.workspace_members];
      loadMembers(loadedMembers, container);
      break;

    case "documents":
      const { data: docs } = await supabase
        .from("workspace_documents")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });
      await loadDocuments(docs || [], container, workspace);
      break;

    case "activities":
      const { data: logs } = await supabase
        .from("workspace_task_logs")
        .select(
          `*, profiles:created_by (full_name, avatar_url), workspace_tasks:task_id (title)`,
        )
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });
      const { data: actDcns } = await supabase
        .from("discussions")
        .select(`*, profiles:created_by (full_name, avatar_url)`)
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      const normalizedLogs = (logs || []).map((log) => ({
        id: log.id,
        task_id: log.task_id,
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
      loadActivities(activities, container);
      break;

    case "discussions":
      await loadDiscussions(
        "Discussions",
        allDiscussions?.filter((d) => d.status === "open") || [],
        container,
      );
      break;

    case "inviteHistory":
      if (myPermissions.inviteMembers) {
        const { data: inviteHistory } = await supabase
          .from("workspace_invites")
          .select("*")
          .eq("workspace_id", workspace.id);
        loadInviteHistory(inviteHistory || [], container);
      } else {
        container.innerHTML = `<p class="placeholderText">You don't have permission to view invite history.</p>`;
      }
      break;

    case "taskHistory":
      loadTasks(
        "Tasks History",
        allTasks.filter((t) => t.status === "completed"),
        container,
      );
      break;

    case "discussionHistory":
      await loadDiscussions(
        "Discussions History",
        allDiscussions?.filter((d) => d.status === "closed") || [],
        container,
      );
      break;

    case "settings":
      await loadSettings(container, workspace, user.id);
      break;

    // ----- Member‑specific sections -----
    case "myTasks":
      const myTasks = allTasks
        .filter((t) => String(t.assigned_to) === String(user.id))
        .filter((t) => t.status === "in progress");
      loadAssignedTasks("My Tasks", myTasks, container);
      break;

    case "allTasks":
      loadAllTasks(allTasks, container);
      break;

    default:
      container.innerHTML = `<p class="placeholderText">Section not found.</p>`;
  }
}

// -------------------------------------------------------------------
// TASK RENDERING FUNCTIONS (admin & member)
// -------------------------------------------------------------------

// Full task cards with assign / ping actions (admin/owner)
export function loadTasks(title, tasks, container) {
  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = "📝" + title;

  const docLink = document.createElement("a");
  docLink.classList.add("docLink");
  docLink.href = "https://docs.loghue.com/tasks";
  docLink.target = "_blank";
  docLink.rel = "noopener";
  docLink.textContent = "Docs";

  const sectionHeader = document.createElement("div");
  sectionHeader.classList.add("sectionHeader");
  sectionHeader.append(sectionTitle, docLink);

  const section = document.createElement("div");
  section.classList.add("section");
  section.appendChild(sectionHeader);

  if (!tasks || tasks.length === 0) {
    const placeholderText = document.createElement("p");
    placeholderText.classList.add("placeholderText");
    placeholderText.textContent = "No tasks yet.";
    section.appendChild(placeholderText);
    container.append(section);
    return;
  }

  const divGrid = document.createElement("div");
  divGrid.classList.add("container", "double-grid");
  section.appendChild(divGrid);

  tasks.forEach((tsk) => {
    const taskCard = document.createElement("div");
    taskCard.classList.add("taskCard");
    taskCard.dataset.id = tsk.id;

    const taskTitle = document.createElement("h3");
    taskTitle.classList.add("taskTitle");
    taskTitle.textContent = tsk.title;

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Description";
    const descText = document.createElement("p");
    descText.textContent = tsk.description;
    details.append(summary, descText);

    const assignee = document.createElement("p");
    assignee.classList.add("meta");
    assignee.textContent = tsk.profiles
      ? `Assigned to: ${tsk.profiles.full_name}`
      : "Unassigned";

    const assignedOn = document.createElement("p");
    assignedOn.classList.add("meta");
    assignedOn.textContent = `Assigned on: ${formatDateTime(tsk.created_at)}`;

    const taskMeta = document.createElement("div");
    taskMeta.classList.add("taskMeta");
    taskMeta.append(assignee, assignedOn);

    const menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.classList.add("actionBtn", "taskMenuBtn");
    menuBtn.title = "Task actions";
    menuBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>`;

    const actionsMenu = document.createElement("div");
    actionsMenu.classList.add("taskActionsMenu");
    actionsMenu.hidden = true;

    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      divGrid
        .querySelectorAll(".taskActionsMenu:not([hidden])")
        .forEach((el) => {
          if (el !== actionsMenu) el.hidden = true;
        });
      actionsMenu.hidden = !actionsMenu.hidden;
    });

    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.classList.add("btn", "btn-primary", "btn-sm");
    viewBtn.textContent = "View Task";
    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `task-view?task=${tsk.id}`;
    });
    actionsMenu.append(viewBtn);

    details.addEventListener("click", (e) => e.stopPropagation());

    // Admin/owner‑only actions (assign / ping)
    const myPermissions = PERMISSIONS[currentUserRole] || {};
    if (myPermissions.assignTasks) {
      if (!tsk.assigned_to || !tsk.profiles) {
        const assignBtn = document.createElement("button");
        assignBtn.type = "button";
        assignBtn.classList.add("btn", "btn-secondary", "assignBtn", "btn-sm");
        assignBtn.textContent = "Assign";
        actionsMenu.append(assignBtn);
      } else {
        const pingBtn = document.createElement("button");
        pingBtn.type = "button";
        pingBtn.classList.add("btn", "btn-secondary", "btn-sm");
        pingBtn.textContent = "Ping Assignee";
        pingBtn.title = "Send a notification asking for an update.";
        pingBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await notifyUser({
            workspaceId: currentWorkspace.id,
            receiverUserId: tsk.profiles.id,
            actorId: user.id,
            type: "task_ping",
            entityId: tsk.id,
            entityType: "task",
          });
          actionMsg("Assignee pinged!", "success");
        });
        actionsMenu.append(pingBtn);
      }
    }

    taskCard.append(taskTitle, taskMeta, menuBtn, details, actionsMenu);
    divGrid.prepend(taskCard);
  });

  // Remove previous outside‑click listener to prevent leaks
  if (tasksOutsideClickListener) {
    document.removeEventListener("click", tasksOutsideClickListener);
  }
  tasksOutsideClickListener = (e) => {
    if (
      !e.target.closest(".taskMenuBtn") &&
      !e.target.closest(".taskActionsMenu")
    ) {
      divGrid
        .querySelectorAll(".taskActionsMenu:not([hidden])")
        .forEach((el) => (el.hidden = true));
    }
  };
  document.addEventListener("click", tasksOutsideClickListener);

  container.append(section);
  attachAssignTaskEvent(divGrid);
}

// Member‑specific: "My Tasks" (read‑only with View button)
export function loadAssignedTasks(sectionTitle, tasks, container) {
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<p class="placeholderText">No tasks assigned yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = sectionTitle;

  const grid = document.createElement("div");
  grid.classList.add("container");

  tasks.forEach((tsk) => {
    const card = document.createElement("div");
    card.classList.add("taskCard");

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
    assignee.textContent = tsk.assigned_to ? `Assigned to: Me` : "Unassigned";
    const assignedOn = document.createElement("p");
    assignedOn.classList.add("meta");
    assignedOn.textContent = `Assigned on: ${formatDateTime(tsk.created_at)}`;
    meta.append(assignee, assignedOn);

    const viewBtn = document.createElement("button");
    viewBtn.classList.add("btn", "btn-sm", "btn-primary");
    viewBtn.textContent = "View Task";
    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `task-view?task=${tsk.id}`;
    });

    details.addEventListener("click", (e) => e.stopPropagation());

    card.append(taskTitle, meta, details, viewBtn);
    grid.append(card);
  });

  section.append(title, grid);
  container.append(section);
}

// Member‑specific: read‑only list of all tasks
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
    card.classList.add("taskCard");

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
    assignee.textContent = tsk.profiles
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
      window.location.href = `task-view?task=${tsk.id}`;
    });

    details.addEventListener("click", (e) => e.stopPropagation());

    card.append(taskTitle, meta, details, viewBtn);
    grid.append(card);
  });

  section.append(title, grid);
  container.append(section);
}

// -------------------------------------------------------------------
// MEMBER ASSIGNMENT & REMOVAL (admin/owner only)
// -------------------------------------------------------------------
function assignMemberTask() {
  const btns = document.querySelectorAll(".assignTaskBtn");
  btns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      await loadComponent("../components/modals/create-task", "modalContainer");
      await new Promise(requestAnimationFrame);

      const assignedTo = document.getElementById("assignToDropdown");
      const createTaskBtn = document.getElementById("createTaskBtn");
      if (!assignedTo || !createTaskBtn) return;

      const memberId = btn.id;
      const member = loadedMembers.find(
        (m) => String(m.profiles.id) === String(memberId),
      );
      assignedTo.innerHTML = "";
      if (member) {
        const option = document.createElement("option");
        option.value = member.profiles.id;
        option.textContent = member.profiles.full_name;
        assignedTo.append(option);
      }

      createTaskBtn.replaceWith(createTaskBtn.cloneNode(true));
      const newCreateTaskBtn = document.getElementById("createTaskBtn");

      newCreateTaskBtn.addEventListener("click", async () => {
        setButtonLoading(newCreateTaskBtn, true);
        const taskTitle = document.getElementById("taskTitle").value.trim();
        const taskDescription = document
          .getElementById("taskDescription")
          .value.trim();
        const assignedToValue = assignedTo.value;

        if (!taskTitle || !taskDescription) {
          alert("Input fields must not be empty");
          setButtonLoading(newCreateTaskBtn, false);
          return;
        }

        const taskData = {
          workspace_id: currentWorkspace.id,
          created_by: user.id,
          title: taskTitle,
          status: "in progress",
          assigned_to: assignedToValue,
          description: taskDescription,
        };

        const { data, error } = await supabase
          .from("workspace_tasks")
          .insert(taskData)
          .select();

        if (error) {
          console.error(error);
          alert("Failed to create task.");
          setButtonLoading(newCreateTaskBtn, false);
          return;
        }

        const newTask = data[0];
        notifyUser({
          workspaceId: currentWorkspace.id,
          receiverUserId: assignedToValue,
          actorId: user.id,
          type: "task_assigned",
          entityId: newTask.id,
          entityType: "task",
        });

        const taskContainer = document.querySelector(".grid");
        if (taskContainer) {
          const taskCard = document.createElement("div");
          taskCard.classList.add("card", "taskCard");
          taskCard.innerHTML = `<h3>${newTask.title}</h3><p>Assigned to: ${member.profiles.full_name}</p>`;
          taskContainer.prepend(taskCard);
        }

        closeModal();
        setButtonLoading(newCreateTaskBtn, false);
      });
    });
  });
}

function removeMember() {
  const btns = document.querySelectorAll(".removeMemberBtn");
  btns.forEach((btn) => {
    if (!btn) return;
    const id = btn.id;
    btn.addEventListener("click", () => {
      confirmAction("Are you sure? Removing this member cannot be undone.", [
        { label: "Cancel", type: "cancel" },
        {
          label: "Remove",
          type: "confirm",
          onClick: () => performMemberRemoval(id, currentWorkspace.id, user),
        },
      ]);
    });
  });
}

async function performMemberRemoval(id, workspaceId, user) {
  if (!PERMISSIONS[currentUserRole]?.manageMembers) {
    actionMsg("You do not have permission to remove members.", "error");
    return;
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("user_id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error(error);
    actionMsg("Failed to remove member.", "error");
    return;
  }

  actionMsg("Member removed!", "success");
  setTimeout(() => window.location.reload(), 2000);
}

// -------------------------------------------------------------------
// ASSIGN UNASSIGNED TASK (admin/owner)
// -------------------------------------------------------------------
function attachAssignTaskEvent(container) {
  if (!container) return;
  container.addEventListener("click", async (e) => {
    const btn = e.target.closest(".assignBtn");
    if (!btn) return;

    taskIdToAssign = btn.closest(".taskCard").dataset.id;
    await loadComponent("../components/modals/assign-task", "modalContainer");

    const memberListContainer = document.getElementById(
      "assignMemberListContainer",
    );
    populateMemberList(memberListContainer);

    const confirmBtn = document.getElementById("confirmAssignBtn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async (evt) => {
        evt.preventDefault();
        await performTaskAssign(confirmBtn);
      });
    }
  });
}

function populateMemberList(container) {
  if (!container) return;
  container.innerHTML = "";
  selectedAssigneeId = null;

  loadedMembers.forEach((m) => {
    if (!m.profiles) return;
    const item = document.createElement("div");
    item.classList.add("workspaceOption");
    item.dataset.memberId = m.profiles.id;
    item.textContent = m.profiles.full_name;
    item.addEventListener("click", () => {
      container
        .querySelectorAll(".workspaceOption.selected")
        .forEach((el) => el.classList.remove("selected"));
      item.classList.add("selected");
      selectedAssigneeId = m.profiles.id;
    });
    container.append(item);
  });
}

async function performTaskAssign(btn) {
  if (!selectedAssigneeId) {
    actionMsg("Please select a member.", "error");
    return;
  }
  btn.disabled = true;

  const { error } = await supabase
    .from("workspace_tasks")
    .update({ assigned_to: selectedAssigneeId })
    .eq("id", taskIdToAssign);

  btn.disabled = false;

  if (error) {
    console.error(error);
    actionMsg("Failed to assign task.", "error");
    return;
  }

  notifyUser({
    workspaceId: currentWorkspace.id,
    receiverUserId: selectedAssigneeId,
    actorId: user.id,
    type: "task_assigned",
    entityId: taskIdToAssign,
    entityType: "task",
  });

  const taskRecord = currentWorkspace.workspace_tasks.find(
    (t) => String(t.id) === String(taskIdToAssign),
  );
  if (taskRecord) {
    const assignee = loadedMembers.find(
      (m) => String(m.profiles.id) === String(selectedAssigneeId),
    );
    taskRecord.assigned_to = selectedAssigneeId;
    taskRecord.profiles = assignee?.profiles || null;
  }

  actionMsg("Task assigned!", "success");
  closeModal();
  taskIdToAssign = null;
  selectedAssigneeId = null;

  // Re‑render current section to update the UI
  const activeContainer = document.getElementById("workspaceDashboardContent");
  if (activeContainer) {
    activeContainer.innerHTML = "";
    const inProgress = currentWorkspace.workspace_tasks.filter(
      (ts) => ts.status === "in progress",
    );
    loadTasks("Created Tasks", inProgress, activeContainer);
  }
}

// -------------------------------------------------------------------
// DOCUMENTS (shared, with upload for all, delete for uploader)
// -------------------------------------------------------------------
async function loadDocuments(documents, container, workspace) {
  container.innerHTML = "";

  const { data } = await supabase.auth.getUser();
  const currentUser = data.user;

  const title = document.createElement("h2");
  title.className = "sectionTitle";
  title.textContent = "📂 Documents";

  const uploadBtn = document.createElement("button");
  uploadBtn.classList.add("actionBtn", "btn-sm", "btn");

  const iconWrap = document.createElement("span");
  iconWrap.className = "navIcon";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  const p1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p1.setAttribute("d", "M12 16V4");
  p1.setAttribute("stroke", "currentColor");
  p1.setAttribute("stroke-width", "2");
  p1.setAttribute("stroke-linecap", "round");
  const p2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p2.setAttribute("d", "M6 10L12 4L18 10");
  p2.setAttribute("stroke", "currentColor");
  p2.setAttribute("stroke-width", "2");
  p2.setAttribute("stroke-linecap", "round");
  p2.setAttribute("stroke-linejoin", "round");
  const p3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p3.setAttribute("d", "M4 16V20H20V16");
  p3.setAttribute("stroke", "currentColor");
  p3.setAttribute("stroke-width", "2");
  p3.setAttribute("stroke-linecap", "round");
  p3.setAttribute("stroke-linejoin", "round");
  svg.appendChild(p1);
  svg.appendChild(p2);
  svg.appendChild(p3);
  iconWrap.appendChild(svg);

  const text = document.createElement("span");
  text.className = "navText";
  text.textContent = "Upload";
  uploadBtn.appendChild(iconWrap);
  uploadBtn.appendChild(text);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.classList.add("hide");

  const sectionHeader = document.createElement("div");
  sectionHeader.classList.add("sectionHeader");
  sectionHeader.append(title, uploadBtn);

  container.appendChild(sectionHeader);
  container.appendChild(fileInput);

  const list = document.createElement("div");
  list.className = "documentsList";
  container.appendChild(list);

  if (!documents.length) {
    const empty = document.createElement("p");
    empty.className = "placeholderText";
    empty.textContent = "No documents uploaded yet.";
    list.appendChild(empty);
  } else {
    documents.forEach((doc) => {
      const item = document.createElement("div");
      item.className = "documentItem";

      const left = document.createElement("div");
      left.className = "docLeft";
      const svg2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      svg2.setAttribute("width", "20");
      svg2.setAttribute("height", "20");
      svg2.setAttribute("viewBox", "0 0 24 24");
      svg2.setAttribute("fill", "none");
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute(
        "d",
        "M3 7C3 5.89543 3.89543 5 5 5H9L11 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z",
      );
      p.setAttribute("stroke", "currentColor");
      p.setAttribute("stroke-width", "2");
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      svg2.appendChild(p);
      const info = document.createElement("div");
      info.className = "docInfo";
      const titleEl = document.createElement("div");
      titleEl.className = "docTitle";
      titleEl.textContent = doc.title;
      const meta = document.createElement("div");
      meta.className = "docMeta";
      meta.textContent = `${(doc.size_bytes / 1024).toFixed(1)} KB • ${doc.mime_type}`;
      info.appendChild(titleEl);
      info.appendChild(meta);
      left.appendChild(svg2);
      left.appendChild(info);

      const downloadBtn = document.createElement("button");
      downloadBtn.classList.add("docDownloadBtn", "docAction");
      downloadBtn.textContent = "Download";
      downloadBtn.dataset.path = doc.storage_path;

      const viewBtn = document.createElement("button");
      viewBtn.classList.add("docViewBtn", "docAction");
      viewBtn.textContent = "View";
      viewBtn.dataset.path = doc.storage_path;

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.classList.add("danger", "docDeleteBtn", "docAction");
      deleteBtn.dataset.path = doc.storage_path;

      item.appendChild(left);
      if (doc.uploaded_by === currentUser.id) {
        item.append(viewBtn, downloadBtn, deleteBtn);
      } else {
        item.append(viewBtn, downloadBtn);
      }
      list.appendChild(item);
    });
  }

  await handleDocUpload(uploadBtn, fileInput, currentWorkspace, container);
  deleteWorkspaceDoc();

  // Attach global document download/view listeners only once
  if (!docEventListenersAttached) {
    handleFileDownload(container);
    docEventListenersAttached = true;
  }
}

function deleteWorkspaceDoc() {
  document.querySelectorAll(".docDeleteBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const path = btn.dataset.path;
      if (!path) return;
      confirmAction("Are you sure you want to delete this document?", [
        { label: "Cancel", type: "cancel" },
        {
          label: "Delete",
          type: "confirm",
          onClick: () => handleDocDelete(path, btn),
        },
      ]);
    });
  });
}

async function handleDocDelete(path, btn) {
  try {
    const { error: storageErr } = await supabase.storage
      .from("workspace-documents")
      .remove([path]);
    if (storageErr) {
      console.error("Storage delete error:", storageErr);
      actionMsg("Failed to delete file from storage.", "error");
      return;
    }
    const { error: dbErr } = await supabase
      .from("workspace_documents")
      .delete()
      .eq("storage_path", path);
    if (dbErr) {
      console.error("DB delete error:", dbErr);
      actionMsg("File removed from storage but DB row failed.", "warning");
      return;
    }
    btn.closest(".documentItem").remove();
    actionMsg("Document deleted successfully.", "success");
  } catch (err) {
    console.error("Delete handler error:", err);
    actionMsg("Unexpected error deleting document.", "error");
  }
}

async function handleDocUpload(uploadBtn, fileInput, workspace, container) {
  uploadBtn.addEventListener("click", () => fileInput.click());

  const {
    data: { session },
  } = await supabase.auth.getSession();

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    showUploadStatus("Uploading...", false, container);
    uploadBtn.disabled = true;
    uploadBtn.classList.add("disabled");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("workspace_id", currentWorkspace.id);

      const res = await fetch(
        "https://qqactsebaxdottiiyrng.supabase.co/functions/v1/upload-document",
        {
          method: "POST",
          body: form,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );
      const data = await res.json();
      if (!res.ok) {
        showUploadStatus(data.error || "Upload failed", true, container);
      } else {
        showUploadStatus("Upload successful", false, container);
        // Refresh the documents section
        renderSection("documents", workspace, container);
      }
    } catch (err) {
      console.error(err);
      showUploadStatus(`Unexpected error: ${err}`, true, container);
    } finally {
      fileInput.value = "";
      uploadBtn.disabled = false;
      uploadBtn.classList.remove("disabled");
    }
  });
}

function handleFileDownload(container) {
  document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("docViewBtn")) {
      const path = e.target.dataset.path;
      if (!path) return;
      try {
        const { data, error } = await supabase.storage
          .from("workspace-documents")
          .createSignedUrl(path, 60);
        if (error) {
          showUploadStatus("Download failed", true, container);
          return;
        }
        window.open(data.signedUrl, "_blank");
      } catch (err) {
        showUploadStatus("Unexpected download error", true, container);
      }
    }

    if (e.target.classList.contains("docDownloadBtn")) {
      const path = e.target.dataset.path;
      if (!path) return;
      showUploadStatus("Downloading...", false, container);
      try {
        const { data, error } = await supabase.storage
          .from("workspace-documents")
          .createSignedUrl(path, 60);
        if (error || !data?.signedUrl) {
          showUploadStatus("Download failed", true, container);
          return;
        }
        const response = await fetch(data.signedUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = path.split("/").pop();
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showUploadStatus("Download successful", false, container);
      } catch (err) {
        showUploadStatus("Unexpected download error", true, container);
      }
    }
  });
}

// -------------------------------------------------------------------
// DISCUSSION RENDERING (shared)
// -------------------------------------------------------------------
export async function loadDiscussions(title, discussions, container) {
  const section = document.createElement("div");
  section.classList.add("section");

  const sectionHeader = document.createElement("div");
  sectionHeader.classList.add("sectionHeader");
  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = "💬" + title;
  sectionHeader.appendChild(sectionTitle);
  section.appendChild(sectionHeader);

  if (!discussions || discussions.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.classList.add("placeholderText");
    placeholder.textContent = "No discussions started yet.";
    section.appendChild(placeholder);
  } else {
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
      const descText = document.createElement("p");
      descText.textContent = dcn.content;
      details.append(summary, descText);

      const createdOn = document.createElement("p");
      createdOn.classList.add("meta");
      createdOn.textContent = formatDateTime(dcn.created_at);

      const dcnMeta = document.createElement("div");
      dcnMeta.classList.add("dcnMeta");
      dcnMeta.append(createdOn);

      const viewBtn = document.createElement("button");
      viewBtn.classList.add("btn", "btn-primary");
      viewBtn.textContent = "Open";
      viewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = `discussion-view?dcn=${dcn.id}`;
      });

      details.addEventListener("click", (e) => e.stopPropagation());

      discussionCard.append(dcnHeader, dcnMeta, dcnTitle, details, viewBtn);
      divGrid.appendChild(discussionCard);
    });

    section.appendChild(divGrid);
  }

  container.appendChild(section);
}

// -------------------------------------------------------------------
// MEMBERS LIST (read‑only for members, actions for admins/owners)
// -------------------------------------------------------------------
function loadMembers(members, container) {
  if (!members || members.length === 0) {
    container.innerHTML = `<p class="placeholderText">No members found.</p>`;
    return;
  }

  const myPermissions = PERMISSIONS[currentUserRole] || {};

  const section = document.createElement("section");
  section.classList.add("section");
  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = "Workspace Members";
  const docLink = document.createElement("a");
  docLink.classList.add("docLink");
  docLink.href = "https://docs.loghue.com/roles";
  docLink.target = "_blank";
  docLink.rel = "noopener";
  docLink.textContent = "Docs";
  const sectionHeader = document.createElement("div");
  sectionHeader.classList.add("sectionHeader");
  sectionHeader.append(sectionTitle, docLink);

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

    const avatar = document.createElement("img");
    avatar.classList.add("profileImg");
    avatar.src = mbr.profiles.avatar_url;
    const profileAvatarContainer = document.createElement("div");
    profileAvatarContainer.classList.add(
      "profileAvatarContainer",
      mbr.profiles.plan.name,
    );
    profileAvatarContainer.append(avatar);

    const cardHeader = document.createElement("div");
    cardHeader.classList.add("cardHeader");
    cardHeader.append(tag, profileAvatarContainer, memberName);
    cardHeader.title = `${mbr.profiles.plan.name} plan member`;

    const adminActions = document.createElement("div");
    adminActions.classList.add("adminActions");

    // Only admins/owners see assignment / removal buttons
    if (myPermissions.assignTasks) {
      const assignBtn = document.createElement("button");
      assignBtn.type = "button";
      assignBtn.id = mbr.profiles.id;
      assignBtn.classList.add("btn", "btn-sm", "btn-primary", "assignTaskBtn");
      assignBtn.textContent = "Assign Task";
      adminActions.appendChild(assignBtn);
    }

    const canRemove = canRemoveMemberPermission(
      currentUserRole,
      mbr.role,
      mbr.user_id === user.id,
    );
    if (canRemove) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.id = mbr.profiles.id;
      removeBtn.classList.add(
        "btn",
        "btn-sm",
        "btn-primary",
        "danger",
        "removeMemberBtn",
      );
      removeBtn.textContent = "Remove member";
      adminActions.appendChild(removeBtn);
    }

    memberCard.append(cardHeader, adminActions);
    divGrid.appendChild(memberCard);
  });

  section.append(sectionHeader, divGrid);
  container.append(section);

  // Attach event listeners only if the buttons exist
  if (myPermissions.assignTasks) assignMemberTask();
  if (document.querySelector(".removeMemberBtn")) removeMember();
}

// -------------------------------------------------------------------
// SETTINGS (fully permission‑gated)
// -------------------------------------------------------------------
async function loadSettings(container, workspace, currentUserId) {
  container.innerHTML = ""; // clear the container once

  const myPermissions = PERMISSIONS[currentUserRole] || {};

  // SECTION HEADER
  const sectionHeader = document.createElement("div");
  sectionHeader.classList.add("sectionHeader");
  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = "Workspace Settings";
  const docLink = document.createElement("a");
  docLink.classList.add("docLink");
  docLink.href = "https://docs.loghue.com/workspaces#workspaceSettings";
  docLink.target = "_blank";
  docLink.rel = "noopener";
  docLink.textContent = "Docs";
  sectionHeader.append(sectionTitle, docLink);

  // 1. WORKSPACE INFO CARD (always visible)
  const infoCard = document.createElement("div");
  infoCard.classList.add("card", "workspaceInfoCard");
  const owner = workspace.workspace_members.find((m) => m.role === "owner");
  infoCard.innerHTML = `
    <h3>Workspace Info</h3>
    <p><strong>Name:</strong> ${workspace.name}</p>
    <p><strong>Description:</strong> ${workspace.description}</p>
    <div>
      <strong>Workspace ID:</strong>
      <div class="workspaceIdContainer">
        <input class="inputField workspaceId" readonly value="${workspace.id}">
        <button class="copyBtn" title="Copy">Copy</button>
      </div>
    </div>
    <p><strong>Owner:</strong> ${owner?.profiles.full_name || "Unknown"}</p>
    <div class="SettingsActionBtnsContainer"></div>
  `;
  infoCard.querySelector(".copyBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(workspace.id);
    actionMsg("Copied to clipboard!", "success");
  });

  // Edit / Archive buttons (admin / owner only)
  if (myPermissions.manageWorkspace) {
    const btnsContainer = infoCard.querySelector(
      ".SettingsActionBtnsContainer",
    );
    const editBtn = document.createElement("button");
    editBtn.id = "editWorkspace";
    editBtn.classList.add("btn", "btn-primary");
    editBtn.textContent = "Edit Workspace";
    const archiveBtn = document.createElement("button");
    archiveBtn.id = "archiveWorkspace";
    archiveBtn.classList.add("btn", "btn-secondary");
    archiveBtn.textContent = "Archive Workspace";
    btnsContainer.append(editBtn, archiveBtn);
  }

  // 2. API KEYS CARD
  let apiCard = null; // will be used outside the if block
  if (myPermissions.createApiKey) {
    apiCard = document.createElement("div");
    apiCard.classList.add("card");
    apiCard.innerHTML = `
      <h3>API Keys</h3>
      <button class="btn-secondary btn" id="createApiKeyBtn">Create API Key</button>
      <table class="table">
        <thead>
          <tr><th>Name</th><th>Prefix</th><th>Created</th><th>Last Used</th><th>Status</th><th>Permissions</th><th>Actions</th></tr>
        </thead>
        <tbody id="apiKeysTable"></tbody>
      </table>
    `;
    apiCard.querySelector("#createApiKeyBtn").onclick = async () => {
      await openApiKeyModal(workspace);
    };
    loadApiKeys(apiCard.querySelector("#apiKeysTable"), workspace.id);
  } else {
    // Member sees a read‑only API keys table
    apiCard = document.createElement("div");
    apiCard.classList.add("card");
    apiCard.innerHTML = `
      <h3>API Keys</h3>
      <p class="mutedText">Only admins and owner can create API Keys.</p>
      <table class="table">
        <thead>
          <tr><th>Name</th><th>Prefix</th><th>Created</th><th>Last Used</th><th>Status</th><th>Permissions</th><th>Actions</th></tr>
        </thead>
        <tbody id="apiKeysTable"></tbody>
      </table>
    `;
    loadApiKeys(apiCard.querySelector("#apiKeysTable"), workspace.id);
  }

  // 3. DANGER ZONE (owner only)
  let dangerContainer = null;
  if (myPermissions.transferOwnership || myPermissions.deleteWorkspace) {
    dangerContainer = document.createElement("div");
    dangerContainer.classList.add("danger");

    const dangerTitle = document.createElement("h3");
    dangerTitle.textContent = "Danger Zone";
    const dangerInner = document.createElement("div");
    dangerInner.classList.add("settingsCard"); // not "danger settingsCard" – just one class

    if (myPermissions.transferOwnership) {
      const transferCard = document.createElement("div");
      transferCard.classList.add("card");
      transferCard.innerHTML = `
        <h3>Transfer Ownership</h3>
        <p class="tunedText">
          Transferring ownership to another member means you will no longer be the owner
          of this workspace and will <b>NOT</b> be able to perform sensitive actions.
        </p>
        <p class="text-muted text-center">This action cannot be undone by you again.</p>
        <button type="button" class="btn danger" id="transferBtn">Transfer Ownership</button>
      `;
      transferCard.querySelector("#transferBtn").onclick = async () => {
        await openTransferOwnershipModal(workspace);
      };
      dangerInner.appendChild(transferCard);
    }

    if (myPermissions.deleteWorkspace) {
      const deleteCard = document.createElement("div");
      deleteCard.classList.add("card", "deleteCard");
      deleteCard.innerHTML = `
        <h3>⚠️ Delete Workspace</h3>
        <p class="tunedText">
          Deleting this workspace will erase all content, tasks, discussions, and histories.
          Members will be removed.
        </p>
        <p class="text-muted text-center">This action <b>CANNOT</b> be undone.</p>
        <button type="button" class="btn danger" id="deleteWorkspace">Delete Workspace</button>
      `;
      dangerInner.appendChild(deleteCard);
    }

    dangerContainer.append(dangerTitle, dangerInner);
  }

  // BUILD THE FINAL SECTION IN ORDER
  const section = document.createElement("section");
  section.classList.add("section");
  section.appendChild(sectionHeader);
  section.appendChild(infoCard);
  if (apiCard) section.appendChild(apiCard);
  if (dangerContainer) section.appendChild(dangerContainer);

  container.appendChild(section);

  // Attach listeners for the newly created buttons
  await attachSettingsActions(workspace, workspace.id);
}

async function attachSettingsActions(ws, id) {
  const editBtn = document.querySelector("#editWorkspace");
  const archiveBtn = document.querySelector("#archiveWorkspace");
  const deleteBtn = document.querySelector("#deleteWorkspace");

  if (editBtn) editBtn.onclick = async () => await editWorkspace(ws, id);
  if (archiveBtn) archiveBtn.onclick = async () => await archiveWorkspace(id);
  if (deleteBtn) deleteBtn.onclick = async () => await deleteWorkspace(id);
}

// -------------------------------------------------------------------
// ACTIVITIES (shared, same as before)
// -------------------------------------------------------------------
export function loadActivities(activities, container) {
  if (sessionState.plan.name === "free" || sessionState.plan.name === "Free") {
    const p = document.createElement("p");
    p.classList.add("placeholderText");
    p.textContent =
      "Workspace activities overview is not available on your current plan. ";
    const a = document.createElement("a");
    a.href = "https://loghue.com/pricing";
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Upgrade";
    p.appendChild(a);
    container.append(p);
    return;
  }

  if (!activities || activities.length === 0) {
    const p = document.createElement("p");
    p.classList.add("placeholderText");
    p.textContent = "No activity in this workspace yet.";
    container.append(p);
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");
  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "Activities";
  const list = document.createElement("div");
  list.classList.add("activityList", "double-grid");

  activities.forEach((item) => {
    const actor = item.actor;
    const avatar = actor?.avatar_url || "/assets/default-avatar.png";
    const name = actor?.full_name || "Unknown User";
    const label =
      item.type === "task_log"
        ? `gave an update on "${item.title || "Unknown Task"}"`
        : `started a discussion "${item.title || "Untitled"}"`;

    const div = document.createElement("div");
    div.classList.add("activityItem");

    const activityHeader = document.createElement("div");
    activityHeader.classList.add("activityHeader");
    const profileImg = document.createElement("img");
    profileImg.classList.add("profileImg");
    profileImg.src = avatar;
    const actorName = document.createElement("span");
    actorName.classList.add("actorName");
    actorName.textContent = `${name} ${label}`;
    activityHeader.append(profileImg, actorName);

    const activityBody = document.createElement("div");
    activityBody.classList.add("activityBody");
    if (item.type === "task_log") {
      const note = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = "Update: ";
      note.append(strong, document.createTextNode(item.note || ""));
      const status = document.createElement("p");
      const statusLabel = document.createElement("strong");
      statusLabel.textContent = "Status: ";
      const statusValue = document.createElement("span");
      statusValue.classList.add("statusBadge");
      statusValue.textContent = item.status || "";
      status.append(statusLabel, statusValue);
      activityBody.append(note, status);
    } else {
      const msg = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = "Message: ";
      msg.append(strong, document.createTextNode(item.note || ""));
      activityBody.append(msg);
    }

    const activityTime = document.createElement("div");
    activityTime.classList.add("activityTime");
    activityTime.textContent = formatDateTime(item.created_at);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("btn", "pageOpenLink", "btn-primary");
    btn.textContent = "Open";
    if (item.type === "discussion") {
      btn.onclick = () =>
        (window.location.href = `https://app.loghue.com/discussion-view?dcn=${item.id}`);
    } else if (item.type === "task_log") {
      btn.onclick = () =>
        (window.location.href = `https://app.loghue.com/task-view?task=${item.task_id}`);
    }

    div.append(activityHeader, activityBody, activityTime, btn);
    list.appendChild(div);
  });

  section.append(title, list);
  container.append(section);
}

// -------------------------------------------------------------------
// INVITE HISTORY (admin/owner only)
// -------------------------------------------------------------------
function loadInviteHistory(invites, container) {
  const table = document.createElement("table");
  table.classList.add("inviteTable");
  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  [
    "Invite Method",
    "Invite Target",
    "Created",
    "Uses",
    "Status",
    "Actions",
  ].forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    trHead.append(th);
  });
  thead.append(trHead);
  const tbody = document.createElement("tbody");
  tbody.id = "invite-body";
  table.append(thead, tbody);

  const inviteTemplate = document.getElementById("invite-row-template");
  if (!inviteTemplate) return;

  invites.forEach((inv) => {
    const row = inviteTemplate.content.cloneNode(true);
    const tr = row.querySelector("tr");

    const method = inv.email ? "Email" : "Link";
    const target = inv.email
      ? inv.email
      : `https://app.loghue.com/invite?token=${inv.token}`;
    const created = inv.created_at;
    const count = inv.accepted_count ?? 0;
    let status = "Active";
    let statusClass = "active";
    if (count >= inv.max_invite_count) {
      status = "Full";
      statusClass = "full";
    } else if (inv.accepted) {
      status = "Used";
      statusClass = "used";
    }

    row.querySelector(".method").textContent = method;
    const urlText = row.querySelector(".urlText");
    urlText.textContent = target;
    urlText.title = target;
    row.querySelector(".created").textContent = formatDateTime(created);
    row.querySelector(".uses").textContent =
      `${count} / ${inv.max_invite_count}`;
    const statusCell = row.querySelector(".status");
    statusCell.textContent = status;
    statusCell.classList.add(statusClass);

    row.querySelector(".copyBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(target);
      actionMsg("Copied to clipboard!", "success");
    });

    const actionsCell = row.querySelector(".actions");
    const revokeBtn = document.createElement("button");
    revokeBtn.classList.add("revokeInviteBtn", "revoke");
    revokeBtn.type = "button";
    revokeBtn.id = inv.id;
    revokeBtn.textContent = "Revoke";
    actionsCell.append(revokeBtn);

    row.querySelector(".method").dataset.label = "Invite Method";
    row.querySelector(".urlCell").dataset.label = "Invite Target";
    row.querySelector(".created").dataset.label = "Created";
    row.querySelector(".uses").dataset.label = "Uses";
    row.querySelector(".status").dataset.label = "Status";
    row.querySelector(".actions").dataset.label = "Actions";

    tbody.prepend(row);

    revokeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = e.currentTarget.id;
      const { error } = await supabase
        .from("workspace_invites")
        .delete()
        .eq("id", id)
        .eq("created_by", user.id);
      if (error) {
        console.error(error);
        actionMsg("Failed to revoke invite.", "error");
        return;
      }
      tr.remove();
      actionMsg("Invite revoked!", "success");
    });
  });

  container.append(table);
}

// -------------------------------------------------------------------
// CREATE WORKSPACE INVITE (used by modals)
// -------------------------------------------------------------------
export async function createWorkspaceInvite({
  workspaceId,
  role,
  email = null,
}) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    throw new Error("Authentication required to create invites");

  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      role,
      email,
      token,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
