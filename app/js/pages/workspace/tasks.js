import { formatDateTime } from "../../utils/time.js";
import { loadComponent, closeModal } from "../../ui.js";
import { actionMsg, confirmAction } from "../../utils/modals.js";
import { notifyUser } from "../../utils/notifications.js";
import { supabase } from "../../supabase.js";
import {
  currentWorkspace,
  loadedMembers,
  user,
  selectedAssigneeId,
  taskIdToAssign,
  setSelectedAssigneeId,
  setTaskIdToAssign,
} from "./state.js";

let outsideClickHandlerAttached = false;

/**
 * Creator of the task, or the workspace owner, may delete a task.
 * Assumed columns: workspace_tasks.created_by, workspace.owner_id.
 * Adjust here if either name differs.
 */
function canDeleteTask(tsk) {
  if (!user) return false;
  const isCreator = String(tsk.created_by) === String(user.id);
  const isOwner = String(currentWorkspace?.created_by) === String(user.id);
  return isCreator || isOwner;
}

/**
 * Admin / Owner task list with Assign / Ping / Delete actions.
 */
export function loadTasks(title, tasks, container) {
  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = title;

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

    const assignee = document.createElement("p");
    assignee.classList.add("meta");
    assignee.textContent = tsk.profiles
      ? `Assigned to: ${tsk.profiles.full_name}`
      : "Unassigned";

    const deadline = document.createElement("p");
    deadline.classList.add("meta");
    deadline.textContent = `Deadline: ${tsk.task_deadline ? formatDateTime(tsk.task_deadline) : "No deadline"}`;

    const taskMeta = document.createElement("div");
    taskMeta.classList.add("taskMeta");
    taskMeta.append(assignee, deadline);

    const menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.classList.add("actionBtn", "taskMenuBtn");
    menuBtn.title = "Task actions";
    menuBtn.setAttribute("aria-label", "Task actions");
    menuBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="5" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="12" cy="19" r="1.5" />
      </svg>
    `;

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

    taskCard.append(taskTitle, taskMeta, menuBtn, actionsMenu);

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
      pingBtn.title =
        "Pinging assignee will send a notification to them asking for update on the task.";
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

    if (canDeleteTask(tsk)) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.classList.add("btn", "danger", "btn-sm");
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();

        confirmAction(
          "Delete Task",
          `Delete "${tsk.title}"? This cannot be undone.`,
          [
            { label: "Cancel", type: "cancel" },
            {
              label: "Delete",
              type: "confirm",
              onClick: async () => await handleTaskDelete(tsk, taskCard),
            },
          ],
        );
      });
      actionsMenu.append(deleteBtn);
    }

    divGrid.prepend(taskCard);
  });

  if (!outsideClickHandlerAttached) {
    document.addEventListener("click", (e) => {
      if (
        e.target.closest(".taskMenuBtn") ||
        e.target.closest(".taskActionsMenu")
      ) {
        return;
      }
      document
        .querySelectorAll(".taskActionsMenu:not([hidden])")
        .forEach((el) => (el.hidden = true));
    });
    outsideClickHandlerAttached = true;
  }

  container.append(section);
  attachAssignTaskEvent(divGrid);
}

async function handleTaskDelete(tsk, taskCard) {
  const { error } = await supabase
    .from("workspace_tasks")
    .delete()
    .eq("id", tsk.id);
  if (error) {
    actionMsg(error.message || "Failed to delete task", "error");
    return;
  }
  taskCard.remove();
  actionMsg("Task deleted.", "success");
}
/**
 * Member view – tasks assigned to the current user, with Delete
 * available if the current user created the task or is the workspace owner.
 */
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
  grid.classList.add("container", "double-grid");

  tasks.forEach((tsk) => {
    const card = document.createElement("div");
    card.classList.add("taskCard");

    const taskTitle = document.createElement("h3");
    taskTitle.textContent = tsk.title;

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

    card.append(taskTitle, meta, viewBtn);

    if (canDeleteTask(tsk)) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.classList.add("btn", "danger", "btn-sm");
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();

        confirmAction(
          "Delete Task",
          `Delete "${tsk.title}"? This cannot be undone.`,
          [
            { label: "Cancel", type: "cancel" },
            {
              label: "Delete",
              type: "confirm",
              onClick: async () => await handleTaskDelete(tsk, card),
            },
          ],
        );
      });
      card.append(deleteBtn);
    }

    grid.prepend(card);
  });

  section.append(title, grid);
  container.append(section);
}

/**
 * Member view – all workspace tasks (read-only, no delete here by design).
 */
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
  grid.classList.add("container", "double-grid");

  tasks.forEach((tsk) => {
    const card = document.createElement("div");
    card.classList.add("taskCard");
    card.dataset.id = tsk.id;

    const taskTitle = document.createElement("h3");
    taskTitle.textContent = tsk.title;

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

    
    card.append(taskTitle, meta, viewBtn);

    if (!tsk.assigned_to || !tsk.profiles) {
      const assignBtn = document.createElement("button");
      assignBtn.type = "button";
      assignBtn.classList.add("btn", "btn-secondary", "assignBtn", "btn-sm");
      assignBtn.textContent = "Assign";
      card.append(assignBtn);
    }
    
    if (canDeleteTask(tsk)) {
      const pingBtn = document.createElement("button");
      pingBtn.type = "button";
      pingBtn.classList.add("btn", "btn-secondary", "btn-sm");
      pingBtn.textContent = "Ping Assignee";
      pingBtn.title =
        "Pinging assignee will send a notification to them asking for update on the task.";
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

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.classList.add("btn", "danger", "btn-sm");
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();

        confirmAction(
          "Delete Task",
          `Delete "${tsk.title}"? This cannot be undone.`,
          [
            { label: "Cancel", type: "cancel" },
            {
              label: "Delete",
              type: "confirm",
              onClick: async () => await handleTaskDelete(tsk, card),
            },
          ],
        );
      });
      card.append(pingBtn, deleteBtn);
    }

    grid.prepend(card);
      attachAssignTaskEvent(grid);

  });

  section.append(title, grid);
  container.append(section);
}

// ---------------------------------------------------------------------------
// Assign-task flow (admin / owner only)
// ---------------------------------------------------------------------------

function attachAssignTaskEvent(container) {
  if (!container) return;

  container.addEventListener("click", async (e) => {
    const btn = e.target.closest(".assignBtn");
    if (!btn) return;

    setTaskIdToAssign(btn.closest(".taskCard").dataset.id);

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

export function populateMemberList(container) {
  if (!container) return;

  container.innerHTML = "";
  setSelectedAssigneeId(null);

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
      setSelectedAssigneeId(m.profiles.id);
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

  // Onboarding: reassigning an existing task also satisfies the
  // "assign a task" step (same event dispatched at creation time
  // in modalEvents.js's attachCreateTaskEvent).
  document.dispatchEvent(
    new CustomEvent("onboarding:task_assigned", {
      detail: { taskId: taskIdToAssign, workspaceId: currentWorkspace.id },
    }),
  );

  closeModal();

  setTaskIdToAssign(null);
  setSelectedAssigneeId(null);

  // Re-render the current "in progress" list
  const activeContainer = document.getElementById("workspaceDashboardContent");

  if (activeContainer) {
    activeContainer.innerHTML = "";
    const inProgress = currentWorkspace.workspace_tasks.filter(
      (ts) => ts.status === "in progress",
    );
    loadTasks("Created Tasks", inProgress, activeContainer);
  }
}
