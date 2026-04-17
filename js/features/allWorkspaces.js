import {
  savedWorkspaceData,
  getWorkspaceReady,
  dropdownClick,
} from "./workspaceData.js";
import {createWorkspaceCardElement} from "./workspaceData.js"

export async function renderAllWorkspaces() {
  const workspacesReady = getWorkspaceReady();

await workspacesReady;
  const openedWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.status === "active",
  );


  const div = document.createElement("div");
  div.classList.add("allWorkspaceContainer", "double-grid");
  
  openedWorkspaces.forEach((wsData) => {
    const wsCard = createWorkspaceCardElement(wsData);
    
    div.prepend(wsCard);
  });
  const dashboardContent = document.getElementById("allWorkspacesContainer");
  if(dashboardContent) {

    dashboardContent.append( div);
  }
  
  dropdownClick()
}


renderAllWorkspaces();
