// Imports
import { supabase } from "../../js/supabase.js";
import { sessionState, sessionReady } from "../../js/session.js";
import { actionMsg, openLogPersonalTaskModal, confirmAction, } from "../../js/utils/modals.js";
import { setLoading, closeModal } from "../../js/ui.js";
import { loadComponent, createEmptyState, } from "https://ui.scybud.com/js/ui.js";
import { attachCreatePersonalTaskEvent } from "../../js/utils/modalEvents.js";
import { formatDateTime } from "../../js/utils/time.js";
import { linkify } from "../../js/utils/linkify.js";
// State
let personalCreatedTasks;
let loggedTasksCount;
let selectedWorkspaceId = "";
let taskIdToDuplicate = ""; // set when duplicateBtn is clicked, before the modal opens
let userNotes = [];
let user = null;
export let savedTaskDetails = []; // exported for other modules
// Initialization
export async function initPersonalTasks() {
    await sessionReady;
    user = sessionState.user;
    if (!user)
        return;
    personalCreatedTasks = document.getElementById("personalCreatedTasks");
    loggedTasksCount = document.getElementById("loggedTasksCount");
    setLoading(true, personalCreatedTasks);
    // Fetch both templates and instances in one call. Templates
    const { data, error } = await supabase
        .from("personal_tasks")
        .select("*, personal_notes!linked_note_id(id, title)")
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
    const { data: notesData } = await supabase
        .from("personal_notes")
        .select("id, title")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
    userNotes = notesData || [];
    renderExistingTasks();
    checkIfEmpty();
    attachDeleteTaskEvent(personalCreatedTasks, user.id);
    attachToggleCompleteEvent(personalCreatedTasks);
    attachDuplicateTaskEvent(personalCreatedTasks, user.id);
    attachLinkNoteEvent(personalCreatedTasks);
    openLogPersonalTaskModal();
}
// Empty State
export async function checkIfEmpty() {
    if (!personalCreatedTasks)
        return;
    if (savedTaskDetails.length === 0) {
        await createEmptyState({
            container: personalCreatedTasks,
            icon: "🎯",
            title: "No tasks created",
            description: "Start by creating your first task",
            actionText: "Create Task",
            onAction: async () => {
                await loadComponent("../components/modals/personal-task-entry", "modalContainer");
                await attachCreatePersonalTaskEvent();
            },
        });
        return;
    }
    const placeholder = personalCreatedTasks.querySelector(".emptyStateImg");
    if (placeholder)
        placeholder.remove();
}
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
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
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
const linkNoteIconPaths = [
    {
        tag: "path",
        attrs: { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" },
    },
    {
        tag: "path",
        attrs: {
            d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
        },
    },
];
// Create Task Element
export function createTaskElement(task) {
    const el = document.createElement("div");
    el.classList.add("taskCard");
    el.dataset.id = task.id;
    if (task.is_completed)
        el.classList.add("completed");
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
    const linkNoteBtn = document.createElement("button");
    linkNoteBtn.type = "button";
    linkNoteBtn.classList.add("linkNoteBtn", "tooltip");
    linkNoteBtn.setAttribute("data-title", "Link Note");
    linkNoteBtn.appendChild(createSvgIcon(linkNoteIconPaths));
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.classList.add("deleteBtn", "tooltip");
    deleteBtn.setAttribute("data-title", "Delete Task");
    deleteBtn.appendChild(createSvgIcon(deleteIconPaths));
    actionsGroup.append(linkNoteBtn, duplicateBtn, deleteBtn);
    topRow.append(checkbox, nameLabel, actionsGroup);
    el.append(topRow);
    // Description
    if (task.description?.trim()) {
        const desc = document.createElement("p");
        desc.classList.add("taskDescription");
        desc.innerHTML = linkify(task.description);
        el.append(desc);
    }
    //notes badge(if linked to note)
    if (task.personal_notes?.title) {
        const noteBadge = document.createElement("a");
        noteBadge.href = `notes?note=${task.personal_notes.id}`;
        noteBadge.classList.add("linkedNoteBadge");
        noteBadge.textContent = `📝 ${task.personal_notes.title}`;
        el.append(noteBadge);
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
    if (!personalCreatedTasks)
        return;
    personalCreatedTasks.innerHTML = "";
    const incomplete = savedTaskDetails.filter((t) => !t.is_completed && !t.is_template);
    const recurring = savedTaskDetails.filter((t) => t.is_template && !t.is_completed);
    const completed = savedTaskDetails.filter((t) => t.is_completed);
    // Create collapsible groups
    const incompleteGroup = createCollapsibleGroup("Incomplete Tasks", incomplete.length, true);
    const recurringGroup = createCollapsibleGroup("Recurring Tasks", recurring.length, false);
    const completedGroup = createCollapsibleGroup("Completed Tasks", completed.length, false);
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
    personalCreatedTasks.append(incompleteGroup.wrapper, recurringGroup.wrapper, completedGroup.wrapper);
}
// Toggle Complete (Delegated)
export function attachToggleCompleteEvent(container) {
    if (!container)
        return;
    container.addEventListener("change", async (e) => {
        const checkbox = e.target;
        if (!checkbox.classList.contains("taskCheckbox"))
            return;
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
            confirmAction("Stop Recurring Task", "Marking this recurring task as done will stop new occurrences from being created. Past occurrences already created won't be affected.", [
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
            ]);
            return;
        }
        // Normal check/uncheck
        await updateTaskCompletion(taskId, isCompleted);
    });
}
async function updateTaskCompletion(taskId, isCompleted) {
    const { error } = await supabase
        .from("personal_tasks")
        .update({ is_completed: isCompleted })
        .eq("id", taskId);
    if (error) {
        console.error(error);
        actionMsg("Failed to update task", "error");
        return;
    }
    const taskRecord = savedTaskDetails.find((t) => String(t.id) === String(taskId));
    if (taskRecord) {
        taskRecord.is_completed = isCompleted;
    }
    renderExistingTasks();
}
// Delete Task
export function attachDeleteTaskEvent(container, userId) {
    if (!container)
        return;
    container.addEventListener("click", async (e) => {
        const btn = e.target.closest(".deleteBtn");
        if (!btn)
            return;
        const card = btn.closest(".taskCard");
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
async function performTaskDelete(btn, userId) {
    const card = btn.closest(".taskCard");
    if (!card)
        return;
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
    savedTaskDetails = savedTaskDetails.filter((t) => String(t.id) !== String(id));
    card.classList.add("removing");
    setTimeout(() => card.remove(), 550);
    actionMsg("Task deleted successfully!", "success");
    checkIfEmpty();
}
// Duplicate Task (Delegated)
export function attachDuplicateTaskEvent(container, userId) {
    if (!container)
        return;
    container.addEventListener("click", async (e) => {
        const btn = e.target.closest(".duplicateBtn");
        if (!btn)
            return;
        const card = btn.closest(".taskCard");
        if (!card)
            return;
        const taskId = card.dataset.id;
        if (!taskId)
            return;
        taskIdToDuplicate = taskId;
        await loadComponent("../components/modals/duplicate-task", "modalContainer");
        const workspaceListContainer = document.getElementById("workspaceListContainer");
        await populateWorkspaceList(workspaceListContainer, userId);
        const confirmBtn = document.getElementById("duplicateTaskToWorkspaceBtn");
        if (confirmBtn) {
            confirmBtn.addEventListener("click", async (evt) => {
                evt.preventDefault(); // button is inside a <form>, guard against submit
                await performTaskDuplicate(confirmBtn, userId);
            });
        }
    });
}
//link task to note
function createNoteLinkSelect(task) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("linkNoteSelect");
    const select = document.createElement("select");
    select.classList.add("linkNoteDropdown");
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "No linked note";
    select.appendChild(noneOpt);
    userNotes.forEach((note) => {
        const opt = document.createElement("option");
        opt.value = note.id;
        opt.textContent = note.title || "Untitled";
        if (note.id === task.linked_note_id)
            opt.selected = true;
        select.appendChild(opt);
    });
    select.addEventListener("change", async () => {
        await updateTaskLinkedNote(task.id, select.value || null);
    });
    wrapper.appendChild(select);
    return wrapper;
}
export function attachLinkNoteEvent(container) {
    if (!container)
        return;
    container.addEventListener("click", (e) => {
        const btn = e.target.closest(".linkNoteBtn");
        if (!btn)
            return;
        const card = btn.closest(".taskCard");
        if (!card)
            return;
        const existing = card.querySelector(".linkNoteSelect");
        if (existing) {
            existing.remove();
            return;
        }
        const taskId = card.dataset.id;
        const task = savedTaskDetails.find((t) => String(t.id) === String(taskId));
        if (!task)
            return;
        card.appendChild(createNoteLinkSelect(task));
    });
}
async function updateTaskLinkedNote(taskId, noteId) {
    const { error } = await supabase
        .from("personal_tasks")
        .update({ linked_note_id: noteId })
        .eq("id", taskId);
    if (error) {
        console.error(error);
        actionMsg("Failed to link note", "error");
        return;
    }
    const taskRecord = savedTaskDetails.find((t) => String(t.id) === String(taskId));
    if (taskRecord) {
        taskRecord.linked_note_id = noteId;
        const note = userNotes.find((n) => n.id === noteId);
        taskRecord.personal_notes = note ? { id: note.id, title: note.title } : null;
    }
    renderExistingTasks();
}
async function performTaskDuplicate(btn, userId) {
    if (!selectedWorkspaceId) {
        actionMsg("Please select a workspace.", "error");
        return;
    }
    const task = savedTaskDetails.find((t) => String(t.id) === String(taskIdToDuplicate));
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
async function populateWorkspaceList(container, userId) {
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
    data
        .filter((m) => m.workspaces) // guard against orphaned membership rows
        .forEach((m) => {
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
function createCollapsibleGroup(title, count, isOpen = true) {
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
    if (!isOpen)
        body.classList.add("collapsed");
    header.addEventListener("click", () => {
        const isCollapsed = body.classList.contains("collapsed");
        if (isCollapsed) {
            body.classList.remove("collapsed");
            header.querySelector(".arrow").textContent = "▼";
        }
        else {
            body.classList.add("collapsed");
            header.querySelector(".arrow").textContent = "▶";
        }
    });
    wrapper.append(header, body);
    return { wrapper, body };
}
export async function toggleTaskCompletion(taskId, isCompleted) {
    const { error } = await supabase
        .from("personal_tasks")
        .update({ is_completed: isCompleted })
        .eq("id", taskId);
    if (error) {
        console.error(error);
        actionMsg("Failed to update task", "error");
        return;
    }
    const taskRecord = savedTaskDetails.find((t) => String(t.id) === String(taskId));
    if (taskRecord)
        taskRecord.is_completed = isCompleted;
    renderExistingTasks();
    document.dispatchEvent(new CustomEvent("personalTasksUpdated"));
}
//# sourceMappingURL=personalTasks.js.map