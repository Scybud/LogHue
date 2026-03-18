import { dataCount } from "../utils.js";
import { closeModal, loadComponent } from "../ui.js";
import { supabase } from "../supabase.js";
import { sessionState, sessionReady } from "../session.js";
import { confirmAction, actionMsg } from "../utils/modals.js";

if (window.__workspaceInit) {
  console.warn("workspaceData.js already initialized");
} else {
  window.__workspaceInit = true;
}

let workspaceNameEl;
let workspaceDescriptionEl;
let createWorkspaceBtn;
let upperDashboardContainer;
export let savedWorkspaceData = [];

import { createDropdown } from "../ui.js";

function getWorkspaceDropdown(ws) {
  if (ws.role !== "admin") return null;

  return createDropdown([
    { label: "Delete", action: () => deleteWorkspace(ws.id) },
    { label: "Edit", action: () => editWorkspace(ws, ws.id) },
    { label: "Archive", action: () => archiveWorkspace(ws.id) },
  ]);
}

export function dropdownClick() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".workspaceMenuBtn");
    if (!btn) return;

    const card = btn.closest(".workspaceCard");
    const wsId = card.dataset.id;
    const ws = savedWorkspaceData.find((w) => w.id == wsId);

    if (!ws || ws.role !== "admin") return;

    // Create dropdown on demand
    const dropdown = getWorkspaceDropdown(ws);
    if (!dropdown) return;

    document.querySelector("main").append(dropdown);
    dropdown.classList.add("show");
    setTimeout(() => dropdown.classList.add("open"), 50);

    dropdown.addEventListener("click", () => dropdown.remove(), { once: true });
  });
}

export async function initWorkspaces() {
  await sessionReady;

  const user = sessionState.user;

  //GET CREATED WORKSPACES
  const { data: createdWorkspaces, error: createdError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  if (createdError) {
    console.error(createdError);
    alert(createdError);
  }

  //GET WORKSPACES THE USER IS A MEMBER OF
  const { data: memberWorkspaces, error: memberError } = await supabase
    .from("workspace_members")
    .select("role, workspaces: workspace_id(*)")
    .eq("user_id", user.id);

  if (memberError) {
    console.error(memberError);
    alert(memberError);
  }

  //NORMALISE MEMBER WORKSPACES
  const normalizedMemberWorkspaces = (memberWorkspaces || []).map((m) => ({
    ...m.workspaces,
    role: m.role, // override role from membership table
  }));

  workspaceNameEl = document.getElementById("workspacename");
  workspaceDescriptionEl = document.getElementById("workspaceDescription");
  createWorkspaceBtn = document.getElementById("createWorkspace");
  upperDashboardContainer = document.getElementById("upperDashboardContainer");

  const combinedWorkspaceData = [
    ...createdWorkspaces.map((ws) => ({ ...ws, role: "admin" })),
    ...normalizedMemberWorkspaces,
  ];

  // Remove duplicates by workspace id
  const uniqueWorkspaces = [];
  const seen = new Set();

  for (const ws of combinedWorkspaceData) {
    if (!seen.has(ws.id)) {
      seen.add(ws.id);
      uniqueWorkspaces.push(ws);
    }
  }

  savedWorkspaceData = uniqueWorkspaces || [];

  updateworkspaceCount();
  checkIfEmpty();
  attachCreateWorkspaceEvent();
  attachOpenWorkspaceClickEvent();
}

function checkIfEmpty() {
  if (!upperDashboardContainer) return;
  if (savedWorkspaceData.length === 0) {
    upperDashboardContainer.innerHTML = `<svg
    class="emptyStateImg"
  viewBox="0 0 220 160"
  fill="none"
  role="img"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <!-- Background card -->
"100%" height="100%" fill="currentColor"  <rect x="28" y="40" width="80" height="10" rx="5" fill="#E0E0E6" />
  <rect x="28" y="58" width="140" height="8" rx="4" fill="#E8E8EE" />
  <rect x="28" y="72" width="110" height="8" rx="4" fill="#E8E8EE" />
  <rect x="28" y="86" width="90" height="8" rx="4" fill="#E8E8EE" />

  <!-- Dotted workspace placeholder -->
  <rect
    x="130"
    y="44"
    width="56"
    height="40"
    rx="8"
    fill="none"
    stroke="#D3D3E0"
    stroke-dasharray="4 4"
  />
  <circle cx="158" cy="64" r="10" fill="#FF6B35" opacity="0.12" />
  <path
    d="M158 58V70M152 64H164"
    stroke="#FF6B35"
    stroke-width="2"
    stroke-linecap="round"
  />

  <!-- Bottom bar -->
  <rect x="28" y="106" width="60" height="10" rx="5" fill="#E0E0E6" />
  <rect x="94" y="106" width="40" height="10" rx="5" fill="#E0E0E6" />

  <!-- Subtle background circles -->
  <circle cx="40" cy="26" r="4" fill="#FFE4D8" />
  <circle cx="190" cy="120" r="5" fill="#FFE4D8" />
  <circle cx="32" cy="118" r="3" fill="#FFE4D8" />

  <!-- Hint text -->
  <text
    x="110"
    y="160"
    text-anchor="middle"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
    font-size="9"
    fill="#8A8A99"
  >
    No workspaces yet — create your first one
  </text>
</svg>
`;
  } else {
    const placeholder =
      upperDashboardContainer.querySelector(".placeholderText");
    if (placeholder) placeholder.remove();
  }
}

export function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "long", // February
    day: "numeric", // 11
    year: "numeric", // 2026
    hour: "2-digit", // 12
    minute: "2-digit", // 27
  });
}

async function attachCreateWorkspaceEvent() {
  if (!createWorkspaceBtn) return;

  if (createWorkspaceBtn.__listenerAttached) return;
  createWorkspaceBtn.__listenerAttached = true;

  //When log task button is clicked to create new log
  createWorkspaceBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const workspaceNameValue = workspaceNameEl.value.trim();
    const workspaceDescriptionValue = workspaceDescriptionEl.value.trim();

    const user = sessionState.user;
    if (!user) return alert("You must be logged in.");

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
      alert("Failed to create workspace.");
      return;
    }

    const newWorkspace = data[0];

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
          role: "admin",
        });

      if (memberInsertError) {
        console.error(memberInsertError);
      }
    }

    savedWorkspaceData.unshift(newWorkspace);

    //RE-RENDER UI
    updateworkspaceCount();
    checkIfEmpty();

    //RESET FORM
    workspaceNameEl.value = "";
    workspaceDescriptionEl.value = "";

    closeModal();
    window.location.reload();
  });
}

function updateworkspaceCount() {
  const createdWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.role === "admin",
  );
  const openedWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.status === "active",
  );
  const closedWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.status === "closed",
  );

  const createdWorkspacesCount = document.getElementById(
    "createdWorkspacesCount",
  );
  const closedWorkspacesCount = document.getElementById(
    "closedWorkspacesCount",
  );
  const activeWorkspaceCount = document.getElementById("activeWorkspaceCount");
  dataCount(activeWorkspaceCount, openedWorkspaces);
  dataCount(createdWorkspacesCount, createdWorkspaces);
  dataCount(closedWorkspacesCount, closedWorkspaces);
}

export function createWorkspaceCardElement(ws) {
  const formattedTDate = formatDateTime(ws.created_at);

  const workspaceCard = document.createElement("div");
  workspaceCard.classList.add("workspaceCard", "card");
  workspaceCard.dataset.id = ws.id;
  workspaceCard.innerHTML = `
  <div class="workspaceCardHeader">
  <div class="workspaceCardHeaderLeft">
  <h3>
  ${ws.name} 
  <span class="tag ${ws.role}">
  ${ws.role}
  </span>
  </h3> 
  <p>
  <span class="meta">Created on: ${formattedTDate}</span>
  </p>
  </div>
  
  <div class="workspaceCardHeaderRight">
  <button class="workspaceMenuBtn"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
  <circle cx="12" cy="5" r="2"/>
  <circle cx="12" cy="12" r="2"/>
  <circle cx="12" cy="19" r="2"/>
  </svg></button>
  </div>
  
  </div>
  <details>
           <summary>Description</summary>
           <p>${ws.description}</p>
           </details>
           <button class="btn btn-primary openWorkspaceBtn" data-id="${ws.id}" data-role="${ws.role}">Open Workspace</button> 
`;

  if (ws.role === "admin") {
    const dropdown = getWorkspaceDropdown(ws);
    workspaceCard.appendChild(dropdown);
  }

  return workspaceCard;
}

function attachOpenWorkspaceClickEvent() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".openWorkspaceBtn");
    if (!btn) return;

    const wsId = btn.dataset.id;
    const role = btn.dataset.role;

    if (role === "admin") {
      window.location.href = `workspace-dashboard-admin?ws=${wsId}`;
    } else {
      window.location.href = `workspace-dashboard-member?ws=${wsId}`;
    }
  });
}

//DELETE WORKSPACE
async function deleteWorkspace(id) {
  confirmAction("Are you sure you want to delete this?", [
    { label: "Cancel", type: "cancel" },
    { label: "Delete", type: "confirm", onClick: () => performWorkspaceDelete(id) },
  ]);
}
//PERFORM WORKSPACE DELETE IF CONFIRMED
async function performWorkspaceDelete(id) {

    const { error } = await supabase.from("workspaces").delete().eq("id", id);

    if (error) {
      console.error(error);
      alert("Failed to delete workspace");
      return;
    }

    actionMsg("Note deleted successfully!", "success");

       setTimeout(() => {
         noteToDelete.remove();
         // Refresh UI
         window.location.reload();
   
       }, 5000);
}


//ARCHEIVE WORKSPACE
async function archiveWorkspace(id) {
  confirmAction("Are you sure you want to Archeive this?", [
    { label: "Cancel", type: "cancel" },
    {
      label: "Archeive",
      type: "confirm",
      onClick: () => performWorkspaceArcheive(id),
    },
  ]);
  
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

// Refresh UI
window.location.reload();
}

//EDIT WORKSPACE
async function editWorkspace(ws, id) {
  await loadComponent(
    "https://loghue.com/components/modals/create-workspace",
    "modalContainer",
  );

  const pageTitle = modalContainer.querySelector(".pageTitle");
  const workspaceNameEl = document.getElementById("workspacename");
  const workspaceDescriptionEl = document.getElementById(
    "workspaceDescription",
  );
  const updateWorkspaceBtn = document.getElementById("createWorkspace");

  pageTitle.textContent = "Update Workspace";
  workspaceNameEl.value = ws.name;
  workspaceDescriptionEl.value = ws.description;
  updateWorkspaceBtn.textContent = "Update Workspace";

  updateWorkspaceBtn.addEventListener("click", async () => {
    const updatedWorkspaceNameValue = workspaceNameEl.value.trim();
    const updatedWorkspaceDescriptionValue =
      workspaceDescriptionEl.value.trim();

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

    // Refresh UI
    window.location.reload();
  });
}

//EXPORT PROMISE WHEN WORKSPACE IS READY
export const workspacesReady = initWorkspaces();
