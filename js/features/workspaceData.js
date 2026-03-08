import { dataCount } from "../utils.js";
import { closeModal } from "../ui.js";
import { supabase } from "../supabase.js";
import { sessionState, sessionReady } from "../session.js";

if (window.__workspaceInit) {
  console.warn("workspaceData.js already initialized");
} else {
  window.__workspaceInit = true;
}


let workspaceNameEl;
let workspaceDescriptionEl;
let createWorkspaceBtn;
let upperDashboardContainer;
let savedWorkspaceData = [];

export async function initWorkspaces() {
  await sessionReady;

  const user = sessionState.user;

  //GET CREATED WORKSPACES
  const { data: createdWorkspaces, error: createdError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

    if(createdError) {
      console.error(createdError)
      alert(createdError)
    }

    //GET WORKSPACES THE USER IS A MEMBER OF
     const { data: memberWorkspaces, error: memberError } = await supabase
       .from("workspace_members")
       .select("role, workspaces: workspace_id(*)")
       .eq("user_id", user.id)

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

  savedWorkspaceData = combinedWorkspaceData;

  renderExistingWorkspaces();
  updateworkspaceCount();
  checkIfEmpty();
  attachCreateWorkspaceEvent();
  attachOpenWorkspaceClickEvent();
}

function checkIfEmpty() {
  if (!upperDashboardContainer) return;
  if (savedWorkspaceData.length === 0) {
    upperDashboardContainer.innerHTML = `<p class="placeholderText">No workspaces created yet. Create one using the ‘Create Workspace’ button.</p>`;
  } else {
    const placeholder =
      upperDashboardContainer.querySelector(".placeholderText");
    if (placeholder) placeholder.remove();
  }
}

function formatDateTime(timestamp) {
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

  //When log task button is clicked to create new log
  createWorkspaceBtn.addEventListener("click", async (e) => {
    if (createWorkspaceBtn.__listenerAttached) return;
createWorkspaceBtn.__listenerAttached = true;


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
    const {data: existing} = await supabase.from("workspace_members").select("*").eq("workspace_id", newWorkspace.id).eq("user_id", user.id).maybeSingle();
    
    if (!existing) {
      await supabase.from("workspace_members").insert({
        workspace_id: newWorkspace.id, user_id: user.id, role: "admin"
      });
    }

    savedWorkspaceData.unshift(newWorkspace);

    //RE-RENDER UI
    renderExistingWorkspaces();
    updateworkspaceCount();
    checkIfEmpty();

    //RESET FORM
    workspaceNameEl.value = "";
    workspaceDescriptionEl.value = "";

    closeModal();
  });
}

function updateworkspaceCount() {
  const createdWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.role === "admin" && ws.status === "active",
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
<h3>
           ${ws.name} 
           <span class="tag ${ws.role}">
           ${ws.role}
           </span>
           </h3> 
           <p>
           <span class="meta">Created on: ${formattedTDate}</span>
           </p>
           <details>
           <summary>Description</summary>
           <p>${ws.description}</p>
           </details>
           <button class="btn btn-primary openWorkspaceBtn" data-id=${ws.id} data-role=${ws.role}>Open Workspace</button> 
`;

  return workspaceCard;
}

function renderExistingWorkspaces() {

  if (!upperDashboardContainer) return;

  upperDashboardContainer.innerHTML = "";

  const header = document.createElement("h2");
  header.textContent = "Recent Workspaces";

  const div = document.createElement("div");
  div.classList.add("recentContainer");

  const createdWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.role === "admin" && ws.status === "active",
  );

  const activeWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.status === "active",
  );

  const closedWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.status === "closed",
  );

  const recentWorkspaces = activeWorkspaces
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 2);

  recentWorkspaces.forEach((wsData) => {
    const wsCard = createWorkspaceCardElement(wsData);

    div.append(wsCard);
  });
  upperDashboardContainer.prepend(header, div);
}

function attachOpenWorkspaceClickEvent() {
  document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("openWorkspaceBtn")) return;

    const wsId = e.target.dataset.id;
    const role = e.target.dataset.role;

    if (role === "admin") {
      window.location.href = `workspace-dashboard-admin.html?ws=${wsId}`;
    } else {
      window.location.href = `workspace-dashboard-member.html?ws=${wsId}`;
    }
  });
}
