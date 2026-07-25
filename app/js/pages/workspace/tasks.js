import { formatDateTimeRelatively } from "../../utils/time.js";
import { loadComponent } from "https://scybud.github.io/scybud-ui/js/ui.js";
import { actionMsg } from "../../utils/modals.js";

let taskIdToAssign = null;
let selectedAssigneeId = null;

// Attach the outside-click handler only once so repeated calls to
// loadOwnerAndAdminTasks do not stack identical document listeners.
let outsideClickHandlerAttached = false;

export async function loadOwnerAndAdminTasks(
  title,
  tasks,
  container,
  loadedMembers,
) {
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
    taskCard.dataset.id = tsk.id; // IMPORTANT

    const taskTitle = document.createElement("h3");
    taskTitle.classList.add("taskTitle");
    taskTitle.textContent = tsk.title;

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Description";

    const descriptionText = document.createElement("p");
    descriptionText.textContent = tsk.description;

    details.append(summary, descriptionText);

    const assignee = document.createElement("p");
    assignee.classList.add("meta");
    assignee.textContent = tsk.profiles
      ? `Assigned to: ${tsk.profiles.full_name}`
      : "Unassigned";

    const assignedOn = document.createElement("p");
    assignedOn.classList.add("meta");
    assignedOn.textContent = `Assigned on: ${formatDateTimeRelatively(tsk.created_at)}`;

    const taskMeta = document.createElement("div");
    taskMeta.classList.add("taskMeta");
    taskMeta.append(assignee, assignedOn);

    // --- Menu button: toggles the actions container's hidden attribute ---
    // Scoped per-card via closest()/querySelector() rather than a global id,
    // since id-based `elementId.hidden ^= 1` only works for a page-unique id —
    // every task card needs its own independent toggle.
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

    // Actions container must be created before the click listener that references it.
    const actionsMenu = document.createElement("div");
    actionsMenu.classList.add("taskActionsMenu");
    actionsMenu.hidden = true;

    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close any other open menu first, so only one is visible at a time.
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

    details.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    taskCard.append(taskTitle, taskMeta, menuBtn, details, actionsMenu);

    // Unassigned tasks get an "Assign" button; assigned tasks keep "Ping Assignee".
    if (!tsk.assigned_to || !tsk.profiles) {
      const assignBtn = document.createElement("button");
      assignBtn.type = "button";
      assignBtn.classList.add("btn", "btn-secondary", "assignBtn", "btn-sm");
      assignBtn.textContent = "Assign";
      // No inline listener here — handled via attachAssignTaskEvent's
      // delegated listener on the grid container.

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

    divGrid.prepend(taskCard);
  });

  // Close any open task menu when clicking anywhere outside it.
  // Guard so the handler is registered only once for the whole module.
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

  await attachAssignTaskEvent(divGrid, loadedMembers);
}

// Assign Unassigned Task (Delegated)
async function attachAssignTaskEvent(container, loadedMembers) {
  if (!container) return;

  container.addEventListener("click", async (e) => {
    const btn = e.target.closest(".assignBtn");
    if (!btn) return;

    taskIdToAssign = btn.closest(".taskCard").dataset.id;

    await loadComponent("../components/modals/assign-task", "modalContainer");

    const memberListContainer = document.getElementById(
      "assignMemberListContainer",
    );

    populateMemberList(memberListContainer, loadedMembers);

    // Fresh DOM node each time loadComponent runs, so no listener-stacking
    // risk here (same reasoning as the duplicate-task confirm button).
    const confirmBtn = document.getElementById("confirmAssignBtn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async (evt) => {
        evt.preventDefault(); // button sits inside a <form>
        await performTaskAssign(confirmBtn, loadedMembers);
      });
    }
  });
}

// POPULATE MEMBER LIST FOR TASK ASSIGN MODAL
function populateMemberList(container, loadedMembers) {
  if (!container) return;

  container.innerHTML = "";
  selectedAssigneeId = null; // reset each time the modal opens

  loadedMembers.forEach((m) => {
    if (!m.profiles) return; // guard against orphaned membership rows

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

async function performTaskAssign(btn, loadedMembers) {
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

  // Keep in-memory workspace data in sync so a re-render (e.g. switching
  // nav sections and back) shows the new assignee without a full reload.
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

  // Re-render the currently visible task section so the assigned card
  // updates (Assign button -> Ping button) without needing a page reload.
  const activeContainer = document.getElementById(
    "adminWorkspaceDashboardContent",
  );
  if (activeContainer) {
    activeContainer.innerHTML = "";
    const inProgress = currentWorkspace.workspace_tasks.filter(
      (ts) => ts.status === "in progress",
    );
    loadOwnerAndAdminTasks(
      "Created Tasks",
      inProgress,
      activeContainer,
      loadedMembers,
    );
  }
}
