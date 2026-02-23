import { state } from "./data/state.js";
import {createWorkspaceCardElement} from "./features/workspaceData.js"
const savedWorkspaceData = state.workspaces

function renderAllWorkspaces() {

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
