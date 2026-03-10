import {
  savedWorkspaceData,
  workspacesReady,
  createWorkspaceCardElement,
  dropdownClick,
} from "./features/workspaceData.js";
import { dataCount } from "./utils.js";


//MOCK DATA FOR DASHBOARD POPULATION
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
const closedWorkspacesCount = document.getElementById("closedWorkspacesCount");
const activeWorkspaceCount = document.getElementById("activeWorkspaceCount");
dataCount(activeWorkspaceCount, openedWorkspaces);
dataCount(createdWorkspacesCount, createdWorkspaces);
dataCount(closedWorkspacesCount, closedWorkspaces);

export async function renderDashboard() {
await workspacesReady;

   if (!upperDashboardContainer) return;
  
    upperDashboardContainer.innerHTML = "";
  
    const header = document.createElement("h2");
    header.textContent = "Recent Workspaces";
  
    const sectionDescription = document.createElement("p")
    sectionDescription.classList.add("sectionDescription");
    sectionDescription.textContent = "Two of your most recent workspaces:"

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
    upperDashboardContainer.prepend(header, sectionDescription, div);

    dropdownClick();
}

renderDashboard();