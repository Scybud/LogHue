import { dataCount } from "../utils.js";
import { state } from "../data/state.js";
import { closeModal } from "../ui.js";


let workspaceNameEl;
let workspaceDescriptionEl;
let createWorkspaceBtn;
let upperDashboardContainer;
let savedWorkspaceData = [];

export function initWorkspaces() {
   workspaceNameEl = document.getElementById("workspacename");
   workspaceDescriptionEl = document.getElementById("workspaceDescription");
createWorkspaceBtn = document.getElementById("createWorkspace");
  upperDashboardContainer = document.getElementById(
        "upperDashboardContainer",
      );

      savedWorkspaceData = state.workspaces

      renderExistingWorkspaces()
      updateworkspaceCount()
      checkIfEmpty()
      attachCreateWorkspaceEvent()      
      attachOpenWorkspaceClickEvent()
     
}


function checkIfEmpty() {
  if(!upperDashboardContainer) return
  if (savedWorkspaceData.length === 0) {
    upperDashboardContainer.innerHTML = `<p class="placeholderText">No workspaces created yet. Create one using the ‘Create Workspace’ button.</p>`;
  } else {
    const placeholder =
      upperDashboardContainer.querySelector(".placeholderText");
   if(placeholder) placeholder.remove()
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

function attachCreateWorkspaceEvent() {
  if (!createWorkspaceBtn) return;

  //When log task button is clicked to create new log
  createWorkspaceBtn.addEventListener("click", () => {
    const workspaceNameValue = workspaceNameEl.value.trim();
    const workspaceDescriptionValue = workspaceDescriptionEl.value.trim();

    if (!workspaceNameValue || !workspaceDescriptionValue) {
      alert("Input field must not be empty");
      return;
    }

    const formattedTDate = formatDateTime(Date.now());

    const workspaceData = {
      id: crypto.randomUUID(),
      name: workspaceNameValue,
      created_at: formattedTDate,
      role: "admin",
      status: "active",
      description: workspaceDescriptionValue,
    };

    savedWorkspaceData.unshift(workspaceData);
    state.workspaces = savedWorkspaceData;

    /*
    localStorage.setItem("logDetails", JSON.stringify(savedWorkspaceData));
    */

    renderExistingWorkspaces();
    updateworkspaceCount(); 
    checkIfEmpty();


    workspaceNameEl.value = "";
    workspaceDescriptionEl.value = "";

    closeModal()
    console.log("close")
  });
}


function updateworkspaceCount() {
  const createdWorkspaces = state.workspaces.filter(
    (ws) => ws.role === "admin" && ws.status === "active",
  );
  const openedWorkspaces = state.workspaces.filter(
    (ws) => ws.status === "active",
  );
  const closedWorkspaces = state.workspaces.filter(
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

const workspaceCard = document.createElement("div")
workspaceCard.classList.add("workspaceCard", "card");
workspaceCard.dataset.id = ws.id
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
           <button class="btn btn-sm openWorkspaceBtn" data-id=${ws.id} data-role=${ws.role}>Open Workspace</button> 
`;

return workspaceCard;

}


function renderExistingWorkspaces() {
  savedWorkspaceData = state.workspaces;


  if(!upperDashboardContainer) return

    upperDashboardContainer.innerHTML = ""
  

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

recentWorkspaces.forEach(wsData => {

   const wsCard = createWorkspaceCardElement(wsData);

   div.append(wsCard)

})
   upperDashboardContainer.prepend(header, div);

}


function attachOpenWorkspaceClickEvent() {
  document.addEventListener("click", (e) => {
    if(!e.target.classList.contains("openWorkspaceBtn")) return

    const wsId = e.target.dataset.id
    const role = e.target.dataset.role

    if(role === "admin") {
      window.location.href = `/pages/workspace-dashboard-admin.html?ws=${wsId}`
    } else {
            window.location.href = `/pages/workspace-dashboard-member.html?ws=${wsId}`;

    }
  })
}