import {
  savedWorkspaceData,
  workspacesReady,
  dropdownClick,
} from "./workspaceData.js";
import {createWorkspaceCardElement} from "./workspaceData.js"

async function renderAllWorkspaces() {
await workspacesReady;
  const openedWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.status === "active",
  );


  const div = document.createElement("div");
  div.classList.add("allWorkspaceContainer");
  
  openedWorkspaces.forEach((wsData) => {
    const wsCard = createWorkspaceCardElement(wsData);
    
    div.prepend(wsCard);
  });
  const dashboardContent = document.getElementById("allWorkspacesContainer");
  
  dashboardContent.append( div);
  
  dropdownClick()
}


renderAllWorkspaces();
