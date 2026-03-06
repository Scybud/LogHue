import { state } from "./data/state.js";
import { dataCount } from "./utils.js";











//MOCK DATA FOR DASHBOARD POPULATION
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
const closedWorkspacesCount = document.getElementById("closedWorkspacesCount");
const activeWorkspaceCount = document.getElementById("activeWorkspaceCount");
dataCount(activeWorkspaceCount, openedWorkspaces);
dataCount(createdWorkspacesCount, createdWorkspaces);
dataCount(closedWorkspacesCount, closedWorkspaces);

export function renderDashboard() {
  const dashboardContainer = document.querySelector("#upperDashboardContainer");
  const header = document.createElement("h2");
  header.textContent = "Recent Workspaces";

  const div = document.createElement("div");
  div.classList.add("recentContainer");

  div.innerHTML = state.workspaces
    .filter((ws) => ws.status === "active")
    .map(
      (ws) =>
        `
        <div class="workspaceCard card"> 
        <h3>
        ${ws.name} 
        <span class="tag ${ws.role}">
        ${ws.role}
        </span>
        </h3> 
        <p>
        <span class="meta">Created on: ${ws.created_at}</span>
        </p>
        <details>
        <summary>Description</summary>
        <p>${ws.description}</p>
        </details>
        <button class="btn btn-sm openWorkspaceBtn">Open Workspace</button> 
        </div> `,
    )
    .join("");

  dashboardContainer.prepend(header, div);
}
