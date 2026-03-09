import { savedWorkspaceData, workspacesReady } from "./workspaceData.js";
import {createWorkspaceCardElement} from "./workspaceData.js"

async function renderAllWorkspaces() {
await workspacesReady;
  const div = document.createElement("div");
  div.classList.add("allWorkspaceContainer");

  savedWorkspaceData.forEach((wsData) => {
    const wsCard = createWorkspaceCardElement(wsData);

    div.prepend(wsCard);
  });
  const dashboardContent = document.getElementById("dashboardContent");

  dashboardContent.append( div);

}

renderAllWorkspaces();
