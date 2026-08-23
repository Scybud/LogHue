// Imports
import { supabase } from "../../js/supabase.js";
import { sessionState, sessionReady } from "../../js/session.js";
import {
  actionMsg,
  openLogPersonalTaskModal,
  confirmAction,
} from "../../js/utils/modals.js";
import { setLoading, closeModal } from "../../js/ui.js";
import {
  loadComponent,
  createEmptyState,
} from "https://ui.scybud.com/js/ui.js";
import { attachCreatePersonalTaskEvent } from "../../js/utils/modalEvents.js";
import { formatDateTime } from "../../js/utils/time.js";

// State
let personalCreatedTasks: HTMLElement;
let loggedTasksCount: HTMLElement;
let selectedWorkspaceId: string = "";
let taskIdToDuplicate: string = ""; // set when duplicateBtn is clicked, before the modal opens

type sessionUser = { id: string; email: string } | null;
let user: sessionUser = null;

export let savedTaskDetails: Task[] = []; // exported for other modules

// Initialization
export async function initPersonalTasks() {
  await sessionReady;
  user = sessionState.user as sessionUser;
  if (!user) return;

  personalCreatedTasks = document.getElementById(
    "personalCreatedTasks",
  ) as HTMLElement;
  loggedTasksCount = document.getElementById("loggedTasksCount") as HTMLElement;

  setLoading(true, personalCreatedTasks);

  // Fetch both templates and instances in one call. Templates
  const { data, error } = await supabase
    .from("personal_tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("is_completed", { ascending: true })
    .order("created_at", { ascending: false });

  setLoading(false, personalCreatedTasks);

  if (error) {
    console.error(error);
    actionMsg("Failed to load tasks", "error");
    return;
  }

  savedTaskDetails = data || [];

  renderExistingTasks();
  checkIfEmpty();
  attachDeleteTaskEvent(personalCreatedTasks, user.id);
  attachToggleCompleteEvent(personalCreatedTasks);
  attachDuplicateTaskEvent(personalCreatedTasks, user.id);
  openLogPersonalTaskModal();
}

// Empty State
export async function checkIfEmpty() {
  if (!personalCreatedTasks) return;

  if (savedTaskDetails.length === 0) {
    await createEmptyState({
      container: personalCreatedTasks,
      icon: "🎯",
      title: "No tasks created",
      description: "Start by creating your first task",
      actionText: "Create Task",
      onAction: async () => {
        await loadComponent(
          "../components/modals/personal-task-entry",
          "modalContainer",
        );
        await attachCreatePersonalTaskEvent();
      },
    });
    return;
  }

  const placeholder = personalCreatedTasks.querySelector(".emptyStateImg");
  if (placeholder) placeholder.remove();
}

// Icons
type SvgPath = {
  tag: string;
  attrs: Record<string, string>;
};

function createSvgIcon(paths: SvgPath[], { viewBox = "0 0 24 24" } = {}) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  paths.forEach(({ tag, attrs }) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) =>
      node.setAttribute(key, value),
    );
    svg.appendChild(node);
  });

  return svg;
}

const deleteIconPaths: SvgPath[] = [
  { tag: "polyline", attrs: { points: "3 6 5 6 21 6" } },
  { tag: "path", attrs: { d: "M19 6l-1 14H6L5 6" } },
  { tag: "path", attrs: { d: "M10 11v6" } },
  { tag: "path", attrs: { d: "M14 11v6" } },
  { tag: "path", attrs: { d: "M9 6V4h6v2" } },
];

const duplicateIconPaths: SvgPath[] = [
  {
    tag: "rect",
    attrs: { x: "9", y: "9", width: "13", height: "13", rx: "2" },
  },
  {
    tag: "path",
    attrs: { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" },
  },
];

type Task = {
  id: string;
  name: string;
  description: string;
  is_completed: boolean;
  task_deadline: string | null;
  created_at: string;
  is_recurring: boolean | null;
  is_template: boolean | null;
};

// Create Task Element
export function createTaskElement(task: Task) {
  const el = document.createElement("div");
  el.classList.add("taskCard");
  el.dataset.id = task.id;
  if (task.is_completed) el.classList.add("completed");

  // Top row
  const topRow = document.createElement("div");
  topRow.classList.add("taskTopRow");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.classList.add("taskCheckbox");
  checkbox.id = `task-${task.id}`;
  checkbox.checked = Boolean(task.is_completed);

  const nameLabel = document.createElement("label");
  nameLabel.htmlFor = checkbox.id;
  nameLabel.classList.add("personalTaskName");
  nameLabel.textContent = task.name;

  const actionsGroup = document.createElement("div");
  actionsGroup.classList.add("taskActions");

  const duplicateBtn = document.createElement("button");
  duplicateBtn.type = "button";
  duplicateBtn.classList.add("duplicateBtn", "tooltip");
  duplicateBtn.setAttribute("data-title", "Duplicate to Workspace");
  duplicateBtn.appendChild(createSvgIcon(duplicateIconPaths));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.classList.add("deleteBtn", "tooltip");
  deleteBtn.setAttribute("data-title", "Delete Task");
  deleteBtn.appendChild(createSvgIcon(deleteIconPaths));

  actionsGroup.append(duplicateBtn, deleteBtn);
  topRow.append(checkbox, nameLabel, actionsGroup);
  el.append(topRow);

  // Description
  if (task.description?.trim()) {
    const desc = document.createElement("p");
    desc.classList.add("taskDescription");
    desc.textContent = task.description;
    el.append(desc);
  }

  // Date
  const dateSpan = document.createElement("span");
  dateSpan.classList.add("taskDate");
  dateSpan.textContent =
    task.task_deadline !== null
      ? formatDateTime(task.task_deadline)
      : formatDateTime(task.created_at);
  el.append(dateSpan);

  return el;
}

// Render Tasks
export function renderExistingTasks() {
  if (!personalCreatedTasks) return;

  personalCreatedTasks.innerHTML = "";

  // is_template is the only flag that matters now, is_recurring is no
  // longer written on new rows. Templates (is_template true) are the
  // recurrence definitions and render into the "Recurring Tasks" group.
  // Everything else (is_template false) is a real, independently
  // completable task, whether it was created as a one-off or spawned as
  // a recurring instance, and renders into "Incomplete Tasks".
  const incomplete = savedTaskDetails.filter(
    (t) => !t.is_completed && !t.is_template,
  );
  const recurring = savedTaskDetails.filter(
    (t) => t.is_template && !t.is_completed,
  );
  const completed = savedTaskDetails.filter((t) => t.is_completed);

  // Create collapsible groups
  const incompleteGroup = createCollapsibleGroup(
    "Incomplete Tasks",
    incomplete.length,
    true,
  );
  const recurringGroup = createCollapsibleGroup(
    "Recurring Tasks",
    recurring.length,
    false,
  );
  const completedGroup = createCollapsibleGroup(
    "Completed Tasks",
    completed.length,
    false,
  );

  // Render incomplete tasks
  incomplete.forEach((task) => {
    const el = createTaskElement(task);
    incompleteGroup.body.append(el);
    requestAnimationFrame(() => el.classList.add("show"));
  });

  //Render recurring tasks
  recurring.forEach((task) => {
    const el = createTaskElement(task);
    recurringGroup.body.append(el);
    requestAnimationFrame(() => el.classList.add("show"));
  });

  // Render completed tasks
  completed.forEach((task) => {
    const el = createTaskElement(task);
    completedGroup.body.append(el);
    requestAnimationFrame(() => el.classList.add("show"));
  });

  // Append groups to main container
  personalCreatedTasks.append(
    incompleteGroup.wrapper,
    recurringGroup.wrapper,
    completedGroup.wrapper,
  );
}

// Toggle Complete (Delegated)
export function attachToggleCompleteEvent(container: HTMLElement) {
  if (!container) return;

  container.addEventListener("change", async (e: Event) => {
    const checkbox = e.target as HTMLInputElement;
    if (!checkbox.classList.contains("taskCheckbox")) return;

    const taskId = checkbox.id.replace("task-", "");
    const isCompleted = checkbox.checked;
    const previousChecked = !isCompleted;

    const { data: task, error: taskError } = await supabase
      .from("personal_tasks")
      .select("is_template, is_completed")
      .eq("id", taskId)
      .single();

    if (taskError) {
      checkbox.checked = previousChecked;
      actionMsg("Sorry, something went wrong", "error");
      return;
    }

    // Only confirm when an incomplete TEMPLATE is being marked done.
    if (task.is_template && !task.is_completed && isCompleted) {
      // Immediately undo the checkbox change.
      checkbox.checked = false;

      confirmAction(
        "Stop Recurring Task",
        "Marking this recurring task as done will stop new occurrences from being created. Past occurrences already created won't be affected.",
        [
          {
            label: "Cancel",
            type: "cancel",
          },
          {
            label: "Stop series",
            type: "confirm",
            onClick: async () => {
              await updateTaskCompletion(taskId, true);
            },
          },
        ],
      );

      return;
    }

    // Normal check/uncheck
    await updateTaskCompletion(taskId, isCompleted);
  });
}

async function updateTaskCompletion(taskId: string, isCompleted: boolean) {
  const { error } = await supabase
    .from("personal_tasks")
    .update({ is_completed: isCompleted })
    .eq("id", taskId);

  if (error) {
    console.error(error);
    actionMsg("Failed to update task", "error");
    return;
  }

  const taskRecord = savedTaskDetails.find(
    (t) => String(t.id) === String(taskId),
  );

  if (taskRecord) {
    taskRecord.is_completed = isCompleted;
  }

  renderExistingTasks();
}

// Delete Task
export function attachDeleteTaskEvent(container: HTMLElement, userId: string) {
  if (!container) return;

  container.addEventListener("click", async (e: Event) => {
    const btn = (e.target as HTMLElement).closest(
      ".deleteBtn",
    ) as HTMLButtonElement | null;
    if (!btn) return;

    const card = btn.closest(".taskCard") as HTMLElement | null;
    const taskId = card?.dataset.id;
    const taskRecord = taskId
      ? savedTaskDetails.find((t) => String(t.id) === String(taskId))
      : undefined;

    // stops the series going forward. Instances it already spawned stay
    const message = taskRecord?.is_template
      ? "Deleting this recurring task will stop future occurrences. Tasks it already created will stay in your list."
      : "Delete this task?";

    confirmAction("Delete Task", message, [
      { label: "Cancel", type: "cancel" },
      {
        label: "Delete",
        type: "confirm",
        onClick: () => performTaskDelete(btn, userId),
      },
    ]);
  });
}

async function performTaskDelete(btn: HTMLButtonElement, userId: string) {
  const card = btn.closest(".taskCard") as HTMLElement | null;
  if (!card) return;
  const id = card.dataset.id;

  const { error } = await supabase
    .from("personal_tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error(error);
    actionMsg("Failed to delete task", "error");
    return;
  }

  savedTaskDetails = savedTaskDetails.filter(
    (t) => String(t.id) !== String(id),
  );

  card.classList.add("removing");
  setTimeout(() => card.remove(), 550);

  actionMsg("Task deleted successfully!", "success");
  checkIfEmpty();
}

// Duplicate Task (Delegated)
export function attachDuplicateTaskEvent(
  container: HTMLElement,
  userId: string,
) {
  if (!container) return;

  container.addEventListener("click", async (e: Event) => {
    const btn = (e.target as HTMLElement).closest(
      ".duplicateBtn",
    ) as HTMLButtonElement | null;
    if (!btn) return;

    const card = btn.closest(".taskCard") as HTMLElement | null;
    if (!card) return;

    const taskId = card.dataset.id;
    if (!taskId) return;

    taskIdToDuplicate = taskId;

    await loadComponent(
      "../components/modals/duplicate-task",
      "modalContainer",
    );

    const workspaceListContainer = document.getElementById(
      "workspaceListContainer",
    ) as HTMLElement;

    await populateWorkspaceList(workspaceListContainer, userId);

   
    const confirmBtn = document.getElementById(
      "duplicateTaskToWorkspaceBtn",
    ) as HTMLButtonElement | null;
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async (evt) => {
        evt.preventDefault(); // button is inside a <form>, guard against submit
        await performTaskDuplicate(confirmBtn, userId);
      });
    }
  });
}

async function performTaskDuplicate(btn: HTMLButtonElement, userId: string) {
  if (!selectedWorkspaceId) {
    actionMsg("Please select a workspace.", "error");
    return;
  }

  const task = savedTaskDetails.find(
    (t) => String(t.id) === String(taskIdToDuplicate),
  );

  if (!task) {
    actionMsg("Task not found.", "error");
    return;
  }

  btn.disabled = true;

  
  const { error } = await supabase.from("workspace_tasks").insert({
    workspace_id: selectedWorkspaceId,
    created_by: userId,
    title: task.name,
    description: task.description || null,
    status: "in progress",
    assigned_to: null,
  });

  btn.disabled = false;

  if (error) {
    console.error(error);
    actionMsg("Failed to duplicate task.", "error");
    return;
  }

  actionMsg("Task duplicated to workspace!", "success");
  closeModal();

  taskIdToDuplicate = "";
  selectedWorkspaceId = "";
}

async function populateWorkspaceList(container: HTMLElement, userId: string) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces: workspace_id (id, name)")
    .eq("user_id", userId);

  if (error) {
    console.error(error);
    actionMsg("Failed to load workspaces", "error");
    return;
  }

  container.innerHTML = "";
  selectedWorkspaceId = ""; // reset each time the modal opens

  type WorkspaceRow = {
    role: string;
    workspaces: { id: string; name: string };
  };

  data
    .filter((m: WorkspaceRow) => m.workspaces) // guard against orphaned membership rows
    .forEach((m: WorkspaceRow) => {
      const item = document.createElement("div");
      item.classList.add("workspaceOption");
      item.dataset.workspaceId = m.workspaces.id;
      item.textContent = m.workspaces.name;

      item.addEventListener("click", () => {
        container
          .querySelectorAll(".workspaceOption.selected")
          .forEach((el) => el.classList.remove("selected"));
        item.classList.add("selected");
        selectedWorkspaceId = m.workspaces.id;
      });

      container.append(item);
    });
}

function createCollapsibleGroup(title: string, count: number, isOpen = true) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("collapsibleGroup");

  const header = document.createElement("div");
  header.classList.add("collapsibleHeader");
  header.innerHTML = `
  <span class="arrow">${isOpen ? "▼" : "▶"}</span>
    <span>${title} (${count})</span>
  `;

  const body = document.createElement("div");
  body.classList.add("collapsibleBody");
  if (!isOpen) body.classList.add("collapsed");

  header.addEventListener("click", () => {
    const isCollapsed = body.classList.contains("collapsed");

    if (isCollapsed) {
      body.classList.remove("collapsed");
      header.querySelector(".arrow")!.textContent = "▼";
    } else {
      body.classList.add("collapsed");
      header.querySelector(".arrow")!.textContent = "▶";
    }
  });

  wrapper.append(header, body);
  return { wrapper, body };
}

export async function toggleTaskCompletion(
  taskId: string,
  isCompleted: boolean,
) {
  const { error } = await supabase
    .from("personal_tasks")
    .update({ is_completed: isCompleted })
    .eq("id", taskId);
  if (error) {
    console.error(error);
    actionMsg("Failed to update task", "error");
    return;
  }
  const taskRecord = savedTaskDetails.find(
    (t) => String(t.id) === String(taskId),
  );
  if (taskRecord) taskRecord.is_completed = isCompleted;
  renderExistingTasks();
  document.dispatchEvent(new CustomEvent("personalTasksUpdated"));
}
