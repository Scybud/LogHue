import {
  savedWorkspaceData,
  getWorkspaceReady,
  createWorkspaceCardElement,
  dropdownClick,
} from "./features/workspaceData.js";
import { dataCount } from "./utils.js";
import {
  savedLogDetails,
  createLogElement,
  attachDeleteLogEvent,
} from "./features/personalTasks.js";
import { sessionReady, sessionState } from "./session.js";


const recentLogs = document.getElementById("recentLogs");
const upperDashboardContainer =  document.getElementById("upperDashboardContainer")


let createdWorkspaces;
let closedWorkspaces;

export async function renderDashboard() {
  const workspacesReady = getWorkspaceReady();

  await workspacesReady;
    await sessionReady;


    const openedWorkspaces = savedWorkspaceData.filter(
      (ws) => ws.status === "active",
    );

    const createdWorkspacesCount = document.getElementById(
      "createdWorkspacesCount",
    );

    const closedWorkspacesCount = document.getElementById(
      "closedWorkspacesCount",
    );
    const activeWorkspaceCount = document.getElementById(
      "activeWorkspaceCount",
    );
    dataCount(activeWorkspaceCount, openedWorkspaces);
    dataCount(createdWorkspacesCount, createdWorkspaces);
    dataCount(closedWorkspacesCount, closedWorkspaces);


    const user = sessionState.user;

  if (!upperDashboardContainer) return;

  upperDashboardContainer.innerHTML = "";

  const div = document.createElement("div");
  div.classList.add("recentContainer");

   createdWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.role === "admin" && ws.status === "active",
  );

  const activeWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.status === "active",
  );

   closedWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.status === "closed",
  );

  if (activeWorkspaces.length === 0) {
    upperDashboardContainer.innerHTML = `
     
 <svg
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
    fill="none"y="106" width="60" height="10" rx="5" fill="#E0E0E6" />
  <rect x="94" y="106" width="40" height="10" rx="5" fill="#E0E0E6" />

  <!-- Subtle background circles -->
  <circle cx="40" cy="26" r="4" fill="#FFE4D8" />
  <circle cx="190" cy="120" r="5" fill="#FFE4D8" />
  <circle cx="32" cy="118" r="3" fill="#FFE4D8" />

  <!-- Hint text -->
  <text
    x="110"
    y="130"
    text-anchor="middle"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
    font-size="9"
    fill="#8A8A99"
  >
    You don't have any active workspaces.
  </text>
</svg>
      `;
  }
  const recentWorkspaces = activeWorkspaces
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 2);

  recentWorkspaces.forEach((wsData) => {
    const wsCard = createWorkspaceCardElement(wsData);
    div.append(wsCard);
  });
  upperDashboardContainer.prepend(div);

  dropdownClick();
  renderRecentLogs();
  attachDeleteLogEvent(recentLogs, user.id);
}

renderDashboard();

export function renderRecentLogs() {
  if (!recentLogs) return;

  recentLogs.innerHTML = "";
  recentLogs.classList.add("reordering");

  const allRecents = savedLogDetails.slice(0, 5);

  allRecents.forEach((log) => {
    const el = createLogElement(log);
    recentLogs.append(el);

    requestAnimationFrame(() => el.classList.add("show"));
  });

  setTimeout(() => {
    recentLogs.classList.remove("reordering");
  }, 300);
}