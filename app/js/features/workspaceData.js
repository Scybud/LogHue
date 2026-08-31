import { dataCount } from "../utils.js";
import {
  loadComponent,
  createEmptyState,
  closeModal,
} from "https://scybud.github.io/scybud-ui/js/ui.js";
import { supabase } from "../supabase.js";
import { sessionState, sessionReady } from "../session.js";
import {
  confirmAction,
  actionMsg,
  openUpgradeModal,
} from "../../js/utils/modals.js";
import { createDropdown } from "../ui.js";
import { setButtonLoading } from "https://scybud.github.io/scybud-ui/js/ui.js";
import { formatDateTime, formatDateTimeRelatively } from "../utils/time.js";

if (window.__workspaceInit) {
  console.warn("workspaceData.js already initialized");
} else {
  window.__workspaceInit = true;
}

let workspaceNameEl;
let workspaceDescriptionEl;
let createWorkspaceBtn;
let allWorkspacesContainer;
let user = null;
export let savedWorkspaceData = [];

function getWorkspaceDropdown(ws) {
  if (ws.role === "owner") {
    return createDropdown([
      { label: "Delete ", action: () => deleteWorkspace(ws.id) },
      { label: "Archive Workspace", action: () => archiveWorkspace(ws.id) },
      { label: "Edit Workspace", action: () => editWorkspace(ws, ws.id) },
      { label: "Open Workspace", action: () => openWorkspace(ws.id) },
    ]);
  }
  if (ws.role === "admin") {
    return createDropdown([
      { label: "Archive Workspace", action: () => archiveWorkspace(ws.id) },
      { label: "Edit Workspace", action: () => editWorkspace(ws, ws.id) },
      { label: "Open Workspace", action: () => openWorkspace(ws.id) },
    ]);
  }
  if (ws.role === "member") {
    return createDropdown([
      { label: "Leave Workspace", action: () => leaveWorkspace(ws.id) },
      { label: "Open Workspace", action: () => openWorkspace(ws.id) },
    ]);
  }

  // fallback for unknown roles
  return createDropdown([
    { label: "View Workspace", action: () => viewWorkspace(ws.id) },
  ]);
}

export function dropdownClick() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".workspaceMenuBtn");
    if (!btn) return;

    const card = btn.closest(".workspaceCard");
    const cardHeaderRight = card.querySelector(".workspaceCardHeaderRight");
    if (!cardHeaderRight) return;

    // If a dropdown is already open in this card, close it and stop.
    const existing = cardHeaderRight.querySelector(".dropdown");
    if (existing) {
      existing.remove();
      return;
    }

    const wsId = card.dataset.id;
    const ws = savedWorkspaceData.find((w) => w.id == wsId);
    if (!ws) return;

    const dropdown = getWorkspaceDropdown(ws);
    if (!dropdown) return;

    dropdown.hidden = false;
    cardHeaderRight.append(dropdown);

    dropdown.addEventListener("click", () => dropdown.remove(), { once: true });
  });
}

export async function initWorkspaces() {
  await sessionReady;

  user = sessionState.user;
  if (!user) return;

  //GET Membership WORKSPACES
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role, workspaces: workspace_id(*)")
    .eq("user_id", user.id);

  if (membershipError) {
    console.error(membershipError);
    alert(membershipError);
  }

  const { data: createdWorkspaces, error: createdError } = await supabase
    .from("workspaces")
    .select("created_by")
    .eq("created_by", user.id);

  if (createdError) {
    console.error(createdError);
    actionMsg(createdError);
  }

  //NORMALISE MEMBER WORKSPACES
  const normalizedCreated = (membership || []).map((m) => ({
    ...m.workspaces,
    role: m.role,
  }));

  workspaceNameEl = document.getElementById("workspacename");
  workspaceDescriptionEl = document.getElementById("workspaceDescription");
  createWorkspaceBtn = document.getElementById("createWorkspace");
  allWorkspacesContainer = document.getElementById("allWorkspacesContainer");

  savedWorkspaceData = await attachWorkspaceStats(normalizedCreated || []);

  checkIfEmpty(createdWorkspaces);
  attachCreateWorkspaceEvent(allWorkspacesContainer, createdWorkspaces);
  attachOpenWorkspaceClickEvent();
}

//MERGE MEMBER COUNT, TASK COUNTS AND LAST ACTIVITY ONTO EACH WORKSPACE
async function attachWorkspaceStats(workspaces) {
  if (!workspaces.length) return workspaces;

  const workspaceIds = workspaces.map((w) => w.id);

  const { data: allMembers, error: membersError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .in("workspace_id", workspaceIds);

  if (membersError) {
    console.error(membersError);
  }

  const membersCountMap = (allMembers || []).reduce((acc, m) => {
    acc[m.workspace_id] = (acc[m.workspace_id] || 0) + 1;
    return acc;
  }, {});

  const { data: allTasks, error: tasksError } = await supabase
    .from("workspace_tasks")
    .select("workspace_id, status, updated_at, created_at")
    .in("workspace_id", workspaceIds);

  if (tasksError) {
    console.error(tasksError);
  }

  const taskStatsMap = (allTasks || []).reduce((acc, t) => {
    if (!acc[t.workspace_id]) {
      acc[t.workspace_id] = { total: 0, open: 0, lastActivity: null };
    }
    const entry = acc[t.workspace_id];
    entry.total += 1;
    if (t.status !== "completed") entry.open += 1;

    const activityTime = t.updated_at || t.created_at;
    if (
      activityTime &&
      (!entry.lastActivity ||
        new Date(activityTime) > new Date(entry.lastActivity))
    ) {
      entry.lastActivity = activityTime;
    }
    return acc;
  }, {});

  return workspaces.map((ws) => {
    const taskStats = taskStatsMap[ws.id] || {
      total: 0,
      open: 0,
      lastActivity: null,
    };
    return {
      ...ws,
      member_count: membersCountMap[ws.id] || 0,
      total_tasks: taskStats.total,
      open_tasks: taskStats.open,
      last_activity: taskStats.lastActivity || ws.created_at,
    };
  });
}

async function checkIfEmpty(createdWorkspaces) {
  if (!allWorkspacesContainer) return;

  if (savedWorkspaceData.length === 0) {
    allWorkspacesContainer.textContent = "";

    await createEmptyState({
      container: allWorkspacesContainer,
      icon: "🗂️",
      title: "No workspaces yet",
      description: "Create a workspace to start organizing your work",
      actionText: "Create Workspace",
      onAction: async () => {
        await loadComponent(
          "../components/modals/create-workspace",
          "modalContainer",
        );

        // Re-query the modal's elements now that they exist in the DOM
        workspaceNameEl = document.getElementById("workspacename");
        workspaceDescriptionEl = document.getElementById(
          "workspaceDescription",
        );
        createWorkspaceBtn = document.getElementById("createWorkspace");

        await attachCreateWorkspaceEvent(
          allWorkspacesContainer,
          createdWorkspaces,
        );
      },
    });
    return;
  }
}

async function attachCreateWorkspaceEvent(container, workspaces) {
  if (!createWorkspaceBtn) return;

  if (createWorkspaceBtn.__listenerAttached) return;
  createWorkspaceBtn.__listenerAttached = true;

  workspaceNameEl.addEventListener("input", () => {
    workspaceNameEl.classList.remove("error");
  });
  workspaceDescriptionEl.addEventListener("input", () => {
    workspaceDescriptionEl.classList.remove("error");
  });
  //When log task button is clicked to create new log
  createWorkspaceBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    setButtonLoading(createWorkspaceBtn, true);

    const workspaceNameValue = workspaceNameEl.value.trim();
    const workspaceDescriptionValue = workspaceDescriptionEl.value.trim();

    const user = sessionState.user;
    if (!user) {
      setButtonLoading(createWorkspaceBtn, false);
      return alert("You must be logged in.");
    }

    if (!workspaceNameValue || !workspaceDescriptionValue) {
      actionMsg("Workspace name and description required", "error");
      workspaceNameEl.classList.add("error");
      workspaceDescriptionEl.classList.add("error");
      setButtonLoading(createWorkspaceBtn, false);
      return;
    }

    if (
      workspaces.length >= sessionState.plan.max_workspaces &&
      sessionState.plan.max_workspaces !== null
    ) {
      openUpgradeModal("unlimitedWorkspaces");
      setButtonLoading(createWorkspaceBtn, false);
      return;
    }

    //DEFINE DATA CONTENT
    const workspaceData = {
      name: workspaceNameValue,
      description: workspaceDescriptionValue,
      created_by: user.id,
    };

    //INSERT INTO SUPABASE
    const { data, error } = await supabase
      .from("workspaces")
      .insert(workspaceData)
      .select();

    if (error) {
      console.error(error);
      actionMsg("Failed to create workspace!", "error");
      setButtonLoading(createWorkspaceBtn, false);
      return;
    }

    const newWorkspace = data[0];

    // Assign role manually for UI consistency
    newWorkspace.role = "owner";

    // Seed stats fields so the card doesn't render zeros until reload
    newWorkspace.member_count = 1;
    newWorkspace.total_tasks = 0;
    newWorkspace.open_tasks = 0;
    newWorkspace.last_activity = newWorkspace.created_at;

    //ADD WORKSPACE ADMIN AS MEMBER
    const { data: existing } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", newWorkspace.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      const { error: memberInsertError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: newWorkspace.id,
          user_id: user.id,
          role: "owner",
        });

      if (memberInsertError) {
        actionMsg(
          "Workspace creation was successful but an error occured",
          "error",
        );
        console.error(memberInsertError);
      }
    }

    savedWorkspaceData.unshift(newWorkspace);
    const wsCard = createWorkspaceCardElement(newWorkspace);

    //RE-RENDER UI
    if (container) {
      container.prepend(wsCard);
    }
    checkIfEmpty(workspaces);

    document.dispatchEvent(
      new CustomEvent("onboarding:workspace_created", {
        detail: { workspaceId: newWorkspace.id },
      }),
    );

    //RESET FORM
    workspaceNameEl.value = "";
    workspaceDescriptionEl.value = "";

    closeModal();

    actionMsg("Workspace created successfully!", "success");
    setButtonLoading(createWorkspaceBtn, false);
  });
}

export function createWorkspaceCardElement(ws) {
  const formattedActivity = ws.last_activity
    ? formatDateTimeRelatively(ws.last_activity)
    : "No recent activity";

  const workspaceCard = document.createElement("div");
  workspaceCard.classList.add("workspaceCard", "card");
  workspaceCard.dataset.id = ws.id;

  // 1. HEADER
  const header = document.createElement("div");
  header.classList.add("workspaceCardHeader");

  const headerLeft = document.createElement("div");
  headerLeft.classList.add("workspaceCardHeaderLeft");

  const workspaceName = document.createElement("span");
  workspaceName.classList.add("text-bold", "workspaceName");
  workspaceName.textContent = ws.name; // SAFE

  const roleSpan = document.createElement("span");
  const roleClass = ws.role || "member"; // Default to member cleanly

  roleSpan.classList.add("tag", roleClass);
  roleSpan.textContent = roleClass;

  workspaceName.append(roleSpan);
  headerLeft.append(workspaceName);

  // 2. HEADER RIGHT (menu button with SVG)
  const headerRight = document.createElement("div");
  headerRight.classList.add("workspaceCardHeaderRight");

  const menuBtn = document.createElement("button");
  menuBtn.classList.add("workspaceMenuBtn", "actionBtn");

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "currentColor");

  [5, 12, 19].forEach((y) => {
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", y);
    circle.setAttribute("r", "2");
    svg.append(circle);
  });

  menuBtn.append(svg);
  headerRight.append(menuBtn);
  header.append(headerLeft, headerRight);

  // 3. DESCRIPTION
  const descP = document.createElement("p");
  descP.classList.add("workspaceCardDesc");
  descP.textContent = ws.description || "No description provided."; // SAFE

  // 4. LIVE METRICS CONTAINER (New Collaboration Hub Signals)
  const statsContainer = document.createElement("div");
  statsContainer.classList.add("workspaceCardStats");

  // Member Count Badge
  const membersBadge = document.createElement("span");
  membersBadge.classList.add("stat-badge");
  membersBadge.textContent = `👥 ${ws.member_count || 0} members`;

  // Task Progression Badge
  const tasksBadge = document.createElement("span");
  tasksBadge.classList.add("stat-badge");
  const totalTasks = ws.total_tasks || 0;
  const openTasks = ws.open_tasks || 0;
  const completedTasks = totalTasks - openTasks;
  tasksBadge.textContent = `✅Tasks: ${completedTasks} completed | ${openTasks} incomplete | ${totalTasks} total`;

  // Last Activity Note
  const activitySpan = document.createElement("span");
  activitySpan.classList.add("meta", "activity-meta");
  activitySpan.textContent = `Active: ${formattedActivity}`;

  statsContainer.append(membersBadge, tasksBadge, activitySpan);

  // 5. OPEN BUTTON
  const openBtn = document.createElement("button");
  openBtn.classList.add("btn", "btn-primary", "openWorkspaceBtn");
  openBtn.dataset.id = ws.id;
  openBtn.dataset.role = ws.role;
  openBtn.textContent = "Open →";

  // ASSEMBLE ALL ELEMENTS
  workspaceCard.append(header, descP, statsContainer, openBtn);

  // 6. ACTION DROPDOWN FOR OWNERS/ADMINS
  if (ws.role === "admin" || ws.role === "owner") {
    const dropdown = getWorkspaceDropdown(ws);
    workspaceCard.append(dropdown);
  }

  return workspaceCard;
}

function attachOpenWorkspaceClickEvent() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".openWorkspaceBtn");
    if (!btn) return;

    const wsId = btn.dataset.id;
    const role = btn.dataset.role;

    window.location.href = `workspace?ws=${wsId}`;
  });
}

//DELETE WORKSPACE
export async function deleteWorkspace(id) {
  confirmAction(
    "Delete Workspace",
    "Are you sure you want to delete this? All Activities(Tasks, logs and discussions) related to this workspace will be deleted and members will be removed from the workspace permanently. It cannot be reversed",
    [
      { label: "Cancel", type: "cancel" },
      {
        label: "Delete",
        type: "confirm",
        onClick: () => performWorkspaceDelete(id),
      },
    ],
  );
}
//PERFORM WORKSPACE DELETE IF CONFIRMED
async function performWorkspaceDelete(id) {
  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", id)
    .eq("created_by", user.id);

  if (error) {
    console.error(error);
    actionMsg("Failed to delete workspace", "error");
    return;
  }

  actionMsg("Workspace deleted!", "success");

  setTimeout(() => {
    // Refresh UI
    window.location.reload();
  }, 2000);
}

//ARCHEIVE WORKSPACE
export async function archiveWorkspace(id) {
  confirmAction(
    "Archive Workspace",
    "Are you sure you want to Archeive this?",
    [
      { label: "Cancel", type: "cancel" },
      {
        label: "Archeive",
        type: "confirm",
        onClick: () => performWorkspaceArcheive(id),
      },
    ],
  );
}

//PERFORM WORKSPACE ARCHEIVE IF CONFIRMED
async function performWorkspaceArcheive(id) {
  const utcNow = new Date().toISOString();

  const { error } = await supabase
    .from("workspaces")
    .update({
      status: "closed",
      closed_at: utcNow,
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Failed to archeive workspace");
    return;
  }

  actionMsg("Workspace archieved!", "success");

  // Refresh UI
  setTimeout(() => {
    window.location.reload();
  }, 2000);
}

//EDIT WORKSPACE
export async function editWorkspace(ws, id) {
  await loadComponent(
    "../components/modals/create-workspace",
    "modalContainer",
  );

  const pageTitle = modalContainer.querySelector(".pageTitle");
  const editWorkspaceNameEl = document.getElementById("workspacename");
  const editWorkspaceDescriptionEl = document.getElementById(
    "workspaceDescription",
  );
  const updateWorkspaceBtn = document.getElementById("createWorkspace");

  pageTitle.textContent = "Update Workspace";
  editWorkspaceNameEl.value = ws.name;
  editWorkspaceDescriptionEl.value = ws.description;
  updateWorkspaceBtn.textContent = "Update Workspace";

  updateWorkspaceBtn.addEventListener("click", async () => {
    const updatedWorkspaceNameValue = editWorkspaceNameEl.value.trim();
    const updatedWorkspaceDescriptionValue =
      editWorkspaceDescriptionEl.value.trim();

    const { error } = await supabase
      .from("workspaces")
      .update({
        name: updatedWorkspaceNameValue,
        description: updatedWorkspaceDescriptionValue,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Failed to update data");
      return;
    }
    actionMsg("Workspace edited!", "success");

    closeModal();

    // Refresh UI
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  });
}

function openWorkspace(wsId) {
  window.location.href = `workspace?ws=${wsId}`;
}

//EXPORT PROMISE WHEN WORKSPACE IS READY
export function getWorkspaceReady() {
  return initWorkspaces();
}
