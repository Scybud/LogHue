import { dataCount } from "../utils.js";
import { closeModal, loadComponent } from "../ui.js";
import { supabase } from "../supabase.js";
import { sessionState, sessionReady } from "../session.js";
import { confirmAction, actionMsg } from "../utils/modals.js";
import { createDropdown } from "../ui.js";

if (window.__workspaceInit) {
  console.warn("workspaceData.js already initialized");
} else {
  window.__workspaceInit = true;
}

let workspaceNameEl;
let workspaceDescriptionEl;
let createWorkspaceBtn;
let upperDashboardContainer;
let user = null;
export let savedWorkspaceData = [];


function getWorkspaceDropdown(ws) {
  if (ws.role === "owner") {
    return createDropdown([
      { label: "Delete ", action: () => deleteWorkspace(ws.id) },
      { label: "Archive Workspace", action: () => archiveWorkspace(ws.id) },
      { label: "Edit Workspace", action: () => editWorkspace(ws, ws.id) },
      { label: "Open Workspace", action: () => openWorkspace(ws.id, ws.role) },
    ]);
  }
  if (ws.role === "admin"){
    return createDropdown([
      { label: "Archive Workspace", action: () => archiveWorkspace(ws.id) },
      { label: "Edit Workspace", action: () => editWorkspace(ws, ws.id) },
      { label: "Open Workspace", action: () => openWorkspace(ws.id, ws.role) },
    ]);
  }
  if(ws.role === "member") {
  return createDropdown([
    { label: "Leave Workspace", action: () => leaveWorkspace(ws.id) },
    {label: "Open Workspace", action: () => openWorkspace(ws.id, ws.role)},
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
    const wsId = card.dataset.id;
    const ws = savedWorkspaceData.find((w) => w.id == wsId);

    if (!ws) return;

    // Create dropdown on demand
    const dropdown = getWorkspaceDropdown(ws);
    if (!dropdown) return;

    document.querySelector("main").append(dropdown);
    dropdown.classList.add("show");
    setTimeout(() => dropdown.classList.add("open"), 20);

    dropdown.addEventListener("click", () => dropdown.remove(), { once: true });
  });
}

export async function initWorkspaces() {
  await sessionReady;

   user = sessionState.user;
if(!user) return;

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
  upperDashboardContainer = document.getElementById("upperDashboardContainer");


  savedWorkspaceData = normalizedCreated || [];

  updateworkspaceCount();
  checkIfEmpty();
  attachCreateWorkspaceEvent(upperDashboardContainer, createdWorkspaces);
  attachOpenWorkspaceClickEvent();
}

function checkIfEmpty() {
  if (!upperDashboardContainer) return;

  if (savedWorkspaceData.length === 0) {
    upperDashboardContainer.textContent = "";

    const svgNS = "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(svgNS, "svg");
    svg.classList.add("emptyStateImg");
    svg.setAttribute("viewBox", "0 0 220 160");
    svg.setAttribute("fill", "none");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-hidden", "true");

    const rect1 = document.createElementNS(svgNS, "rect");
    rect1.setAttribute("x", "28");
    rect1.setAttribute("y", "40");
    rect1.setAttribute("width", "80");
    rect1.setAttribute("height", "10");
    rect1.setAttribute("rx", "5");
    rect1.setAttribute("fill", "#E0E0E6");

    const rect2 = document.createElementNS(svgNS, "rect");
    rect2.setAttribute("x", "28");
    rect2.setAttribute("y", "58");
    rect2.setAttribute("width", "140");
    rect2.setAttribute("height", "8");
    rect2.setAttribute("rx", "4");
    rect2.setAttribute("fill", "#E8E8EE");

    const rect3 = document.createElementNS(svgNS, "rect");
    rect3.setAttribute("x", "28");
    rect3.setAttribute("y", "72");
    rect3.setAttribute("width", "110");
    rect3.setAttribute("height", "8");
    rect3.setAttribute("rx", "4");
    rect3.setAttribute("fill", "#E8E8EE");

    const rect4 = document.createElementNS(svgNS, "rect");
    rect4.setAttribute("x", "28");
    rect4.setAttribute("y", "86");
    rect4.setAttribute("width", "90");
    rect4.setAttribute("height", "8");
    rect4.setAttribute("rx", "4");
    rect4.setAttribute("fill", "#E8E8EE");

    const rect5 = document.createElementNS(svgNS, "rect");
    rect5.setAttribute("x", "130");
    rect5.setAttribute("y", "44");
    rect5.setAttribute("width", "56");
    rect5.setAttribute("height", "40");
    rect5.setAttribute("rx", "8");
    rect5.setAttribute("fill", "none");
    rect5.setAttribute("stroke", "#D3D3E0");
    rect5.setAttribute("stroke-dasharray", "4 4");

    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "158");
    circle.setAttribute("cy", "64");
    circle.setAttribute("r", "10");
    circle.setAttribute("fill", "#FF6B35");
    circle.setAttribute("opacity", "0.12");

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M158 58V70M152 64H164");
    path.setAttribute("stroke", "#FF6B35");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");

    const bottom1 = document.createElementNS(svgNS, "rect");
    bottom1.setAttribute("x", "28");
    bottom1.setAttribute("y", "106");
    bottom1.setAttribute("width", "60");
    bottom1.setAttribute("height", "10");
    bottom1.setAttribute("rx", "5");
    bottom1.setAttribute("fill", "#E0E0E6");

    const bottom2 = document.createElementNS(svgNS, "rect");
    bottom2.setAttribute("x", "94");
    bottom2.setAttribute("y", "106");
    bottom2.setAttribute("width", "40");
    bottom2.setAttribute("height", "10");
    bottom2.setAttribute("rx", "5");
    bottom2.setAttribute("fill", "#E0E0E6");

    const t1 = document.createElementNS(svgNS, "text");
    t1.setAttribute("x", "110");
    t1.setAttribute("y", "130");
    t1.setAttribute("text-anchor", "middle");
    t1.setAttribute("font-size", "9");
    t1.setAttribute("fill", "#8A8A99");
    t1.textContent = "No workspaces yet — create your first one";

    svg.append(
      rect1,
      rect2,
      rect3,
      rect4,
      rect5,
      circle,
      path,
      bottom1,
      bottom2,
      t1,
    );

    upperDashboardContainer.appendChild(svg);
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

async function attachCreateWorkspaceEvent(container, workspaces) {
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
    
    if(!workspaceNameValue || !workspaceDescriptionValue) {
      actionMsg(
        "All field must not be empty",
        "error",
      );
      return;
    }

        if(workspaces.length >= sessionState.plan.max_workspaces && sessionState.plan.max_workspaces !== null) {
                    actionMsg("You have exceeded the limit for workspace creation on your current plan. Subscribe to a new plan to create more workspaces!", "error");
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
      return;
    }

    const newWorkspace = data[0];

    // Assign role manually for UI consistency
    newWorkspace.role = "owner";

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
                  actionMsg("Workspace creation was successful but an error occured", "error");
        console.error(memberInsertError);
      }
    }

    savedWorkspaceData.unshift(newWorkspace);
    const wsCard = createWorkspaceCardElement(newWorkspace);

    //RE-RENDER UI
    if(container) {
      container.prepend(wsCard);
    }
    updateworkspaceCount();
    checkIfEmpty();

    //RESET FORM
    workspaceNameEl.value = "";
    workspaceDescriptionEl.value = "";

    closeModal();

    actionMsg("Workspace created successfully!", "success");
  });
}

function updateworkspaceCount() {
  const membership = savedWorkspaceData.filter(
    (ws) => ws.role === "owner",
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
  dataCount(createdWorkspacesCount, membership);
  dataCount(closedWorkspacesCount, closedWorkspaces);
}

export function createWorkspaceCardElement(ws) {
  const formattedTDate = formatDateTime(ws.created_at);

  const workspaceCard = document.createElement("div");
  workspaceCard.classList.add("workspaceCard", "card");
  workspaceCard.dataset.id = ws.id;

  // HEADER
  const header = document.createElement("div");
  header.classList.add("workspaceCardHeader");

  const headerLeft = document.createElement("div");
  headerLeft.classList.add("workspaceCardHeaderLeft");

  const h3 = document.createElement("h3");

  // workspace name (SAFE)
  h3.appendChild(document.createTextNode(ws.name + " "));

  const roleSpan = document.createElement("span");
  const roleClass = ws.role || "unknown";

  roleSpan.classList.add("tag", roleClass);
  roleSpan.textContent = roleClass;

  h3.append(roleSpan);

  const p = document.createElement("p");
  const metaSpan = document.createElement("span");
  metaSpan.classList.add("meta");
  metaSpan.textContent = `Created on: ${formattedTDate}`;

  p.append(metaSpan);

  headerLeft.append(h3, p);

  // HEADER RIGHT (menu button with SVG)
  const headerRight = document.createElement("div");
  headerRight.classList.add("workspaceCardHeaderRight");

  const menuBtn = document.createElement("button");
  menuBtn.classList.add("workspaceMenuBtn");

  // SVG (safe because static)
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

  // DESCRIPTION
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Description";

  const descP = document.createElement("p");
  descP.textContent = ws.description; // SAFE

  details.append(summary, descP);

  // OPEN BUTTON
  const openBtn = document.createElement("button");
  openBtn.classList.add("btn", "btn-primary", "openWorkspaceBtn");
  openBtn.dataset.id = ws.id;
  openBtn.dataset.role = ws.role;
  openBtn.textContent = "Open Workspace";

  // ASSEMBLE
  workspaceCard.append(header, details, openBtn);

  if (ws.role === "admin") {
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

    if (role === "admin" || role === "owner") {
      window.location.href = `workspace-dashboard-admin?ws=${wsId}`;
    } else {
      window.location.href = `workspace-dashboard-member?ws=${wsId}`;
    }
  });
}

//DELETE WORKSPACE
export async function deleteWorkspace(id) {
  confirmAction("Are you sure you want to delete this? All activites(Tasks, logs and discussions) related to this workspace will be deleted and members will be removed from the workspace permanently. It cannot be reversed", [
    { label: "Cancel", type: "cancel" },
    { label: "Delete", type: "confirm", onClick: () => performWorkspaceDelete(id) },
  ]);
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

    actionMsg("Workspace archieved!", "success");

// Refresh UI
setTimeout(() => {

  window.location.reload();
}, 2000);
}

//EDIT WORKSPACE
export async function editWorkspace(ws, id) {
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
    actionMsg("Workspace edited!", "success");

    closeModal()

    // Refresh UI
    setTimeout(() => {

      window.location.reload();
    }, 2000)
  });
}

function openWorkspace(wsId, wsRole) {

    if (wsRole === "admin" || wsRole === "owner") {
      window.location.href = `workspace-dashboard-admin?ws=${wsId}`;
    } else {
      window.location.href = `workspace-dashboard-member?ws=${wsId}`;
    }
}

//EXPORT PROMISE WHEN WORKSPACE IS READY
export function getWorkspaceReady() {
  return initWorkspaces();
}
