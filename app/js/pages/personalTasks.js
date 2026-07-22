import { supabase } from "../supabase.js";
import { sessionState, sessionReady } from "../session.js";
import { actionMsg, openLogPersonalTaskModal } from "../utils/modals.js";
import { confirmAction } from "../utils/modals.js";
import { setLoading } from "../ui.js";
import {
  loadComponent,
  createEmptyState,
} from "https://scybud.github.io/scybud-ui/js/ui.js";
import { attachCreatePersonalTaskEvent } from "../utils/modalEvents.js";
// NOTE: openLogPersonalTaskModal is still imported from modals.js, which
// hasn't been renamed yet. attachCreatePersonalTaskEvent has since been
// renamed on your end in modalEvents.js — updated here to match.

let personalCreatedTasks = null;
let loggedTasksCount = null;

export let savedTaskDetails = [];
// NOTE: renamed from savedLogDetails — this is exported, so any other file
// importing { savedLogDetails } from this module will break until updated
// to import { savedTaskDetails } instead.

// -------------------------------
// Initialization
// -------------------------------
export async function initPersonalTasks() {
  await sessionReady;
  const user = sessionState.user;

  if (!user) return;

  personalCreatedTasks = document.getElementById("personalCreatedTasks");
  // NOTE: getElementById target renamed to match — the actual HTML element's
  // id attribute needs to be updated to "personalCreatedTasks" too, or this
  // will resolve to null.

  loggedTasksCount = document.getElementById("loggedTasksCount");

  setLoading(true, personalCreatedTasks);

  const { data, error } = await supabase
    .from("personal_tasks")
    .select("*")
    .eq("user_id", user.id)
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
  openLogPersonalTaskModal();
}

// -------------------------------
// Helpers
// -------------------------------
function formatDateTime(iso) {
  return new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// -------------------------------
// Empty State
// -------------------------------
export async function checkIfEmpty() {
  if (!personalCreatedTasks) return;

  if (savedTaskDetails.length === 0) {
    await createEmptyState({
      container: personalCreatedTasks,
      icon: "📭",
      title: "Nothing here yet",
      description: "You have no created tasks yet",
      actionText: "Create Task",
      onAction: async () => {
        // Open modal
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

// -------------------------------
// Icon helpers
// -------------------------------
function createSvgIcon(paths, { viewBox = "0 0 24 24" } = {}) {
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

const deleteIconPaths = [
  { tag: "polyline", attrs: { points: "3 6 5 6 21 6" } },
  { tag: "path", attrs: { d: "M19 6l-1 14H6L5 6" } },
  { tag: "path", attrs: { d: "M10 11v6" } },
  { tag: "path", attrs: { d: "M14 11v6" } },
  { tag: "path", attrs: { d: "M9 6V4h6v2" } },
];

// Two overlapping squares — standard "duplicate/copy" glyph
const duplicateIconPaths = [
  {
    tag: "rect",
    attrs: { x: "9", y: "9", width: "13", height: "13", rx: "2" },
  },
  {
    tag: "path",
    attrs: { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" },
  },
];

// -------------------------------
// Create Task Element
// -------------------------------
export function createTaskElement(task) {
  const el = document.createElement("div");
  el.classList.add("taskCard");
  el.dataset.id = task.id;
  if (task.is_completed) el.classList.add("completed");

  // --- Top row: checkbox + name + actions ---
  const topRow = document.createElement("div");
  topRow.classList.add("taskTopRow");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.classList.add("taskCheckbox");
  checkbox.checked = Boolean(task.is_completed);
  checkbox.setAttribute("aria-label", "Mark task as done");
  // NOTE: no click handler wired here — createTaskElement only builds markup.
  // Persisting the toggle to Supabase (is_completed) needs a delegated
  // listener alongside attachDeleteTaskEvent, e.g. attachToggleCompleteEvent.

  const nameSpan = document.createElement("span");
  nameSpan.classList.add("personalTaskName");
  nameSpan.textContent = task.name;

  const actionsGroup = document.createElement("div");
  actionsGroup.classList.add("taskActions");

  const duplicateBtn = document.createElement("button");
  duplicateBtn.setAttribute("data-title", "Duplicate to Workspace");
  duplicateBtn.setAttribute("type", "button");
  duplicateBtn.classList.add("duplicateBtn", "tooltip");
  duplicateBtn.appendChild(createSvgIcon(duplicateIconPaths));
  // NOTE: same as checkbox — no handler wired here. This needs a delegated
  // click listener that opens a workspace picker, then inserts a copy of
  // this task into workspace_tasks for the chosen workspace.

  const deleteBtn = document.createElement("button");
  deleteBtn.setAttribute("data-title", "Delete Task");
  deleteBtn.setAttribute("type", "button");
  deleteBtn.classList.add("deleteBtn", "tooltip");
  deleteBtn.appendChild(createSvgIcon(deleteIconPaths));

  actionsGroup.append(duplicateBtn, deleteBtn);
  topRow.append(checkbox, nameSpan, actionsGroup);
  el.append(topRow);

  // --- Description: only rendered if present ---
  if (task.description && task.description.trim() !== "") {
    const desc = document.createElement("p");
    desc.classList.add("taskDescription");
    desc.textContent = task.description;
    el.append(desc);
  }

  // --- Date ---
  const dateSpan = document.createElement("span");
  dateSpan.classList.add("taskDate");
  dateSpan.textContent = formatDateTime(task.created_at);
  el.append(dateSpan);

  return el;
}

// -------------------------------
// Render Tasks
// -------------------------------
export function renderExistingTasks() {
  if (!personalCreatedTasks) return;

  personalCreatedTasks.innerHTML = "";
  personalCreatedTasks.classList.add("reordering");

  savedTaskDetails.forEach((task) => {
    const el = createTaskElement(task);
    personalCreatedTasks.append(el);

    requestAnimationFrame(() => el.classList.add("show"));
  });

  setTimeout(() => {
    personalCreatedTasks.classList.remove("reordering");
  }, 300);
}

// -------------------------------
// Delete Task
// -------------------------------

export function attachDeleteTaskEvent(container, userId) {
  if (!container) return;

  container.addEventListener("click", async (e) => {
    const btn = e.target.closest(".deleteBtn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    confirmAction("Delete this task?", [
      { label: "Cancel", type: "cancel" },
      {
        label: "Delete",
        type: "confirm",
        onClick: () => performTaskDelete(btn, userId),
      },
    ]);
  });
}

async function performTaskDelete(btn, userId) {
  const taskToDelete = btn.closest(".taskCard");
  const id = taskToDelete.dataset.id;

  const { error } = await supabase
    .from("personal_tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  // Remove from memory
  savedTaskDetails = savedTaskDetails.filter(
    (task) => String(task.id) !== String(id),
  );

  // Animate + remove
  taskToDelete.classList.add("removing");

  setTimeout(() => {
    taskToDelete.remove();
  }, 550);
  actionMsg("Task deleted successfully!", "success");
  updateTaskCount();
  checkIfEmpty();
}
