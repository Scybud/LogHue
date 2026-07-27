import {
  savedWorkspaceData,
  getWorkspaceReady,
} from "../features/workspaceData.js";
import { supabase } from "../supabase.js";
import { confirmAction, actionMsg } from "../utils/modals.js";
import { setLoading } from "../ui.js";
import { formatDateTime } from "../utils/time.js";

function checkIfEmpty(historyContainer) {
  const closedWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.status === "closed",
  );

  if (!historyContainer) return;

  if (closedWorkspaces.length === 0) {
    historyContainer.innerHTML = `
<svg
  class="emptyStateImg"
  viewBox="0 0 220 160"
  fill="none"
  role="img"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <!-- Background -->
  <rect width="100%" height="100%" fill="#6b6b6b" />

  <!-- Content -->
  <rect x="28" y="40" width="80" height="10" rx="5" fill="#E0E0E6" />
  <rect x="28" y="58" width="140" height="8" rx="4" fill="#E8E8EE" />
  <rect x="28" y="72" width="110" height="8" rx="4" fill="#E8E8EE" />
  <rect x="28" y="86" width="90" height="8" rx="4" fill="#E8E8EE" />

  <!-- Bottom -->
  <rect x="28" y="106" width="60" height="10" rx="5" fill="#E0E0E6" />
  <rect x="94" y="106" width="40" height="10" rx="5" fill="#E0E0E6" />

  <!-- Decorations -->
  <circle cx="40" cy="26" r="4" fill="#FFE4D8" />
  <circle cx="190" cy="120" r="5" fill="#FFE4D8" />
  <circle cx="32" cy="118" r="3" fill="#FFE4D8" />

  <text
    x="110"
    y="130"
    text-anchor="middle"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
    font-size="9"
    fill="#303030"
  >
    Nothing in your archive
  </text>
</svg>
`;
  }
}

export async function renderArchive() {
  const historyContainer = document.querySelector("#historyContainer");

  setLoading(true, historyContainer);

  await getWorkspaceReady();

  historyContainer.innerHTML = "";

  const closedWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.status === "closed",
  );

  setLoading(false, historyContainer);

  if (closedWorkspaces.length === 0) {
    checkIfEmpty(historyContainer);
    return;
  }

  const div = document.createElement("div");
  div.classList.add("double-grid");

  closedWorkspaces.forEach((ws) => {
    const formattedDate = formatDateTime(ws.closed_at);

    // Card
    const card = document.createElement("div");
    card.classList.add("workspaceCard", "card", ws.status);
    card.dataset.id = ws.id;
    card.title = "Workspace can only be accessed after restore.";

    // Header
    const header = document.createElement("div");
    header.className = "workspaceCardHeader";

    const headerLeft = document.createElement("div");
    headerLeft.className = "workspaceCardHeaderLeft";

    const title = document.createElement("h3");
    title.textContent = ws.name;

    const roleTag = document.createElement("span");
    roleTag.className = `tag ${ws.role}`;
    roleTag.textContent = ws.role;

    title.appendChild(roleTag);

    const meta = document.createElement("p");
    const metaSpan = document.createElement("span");
    metaSpan.className = "meta";
    metaSpan.textContent = `Archived on: ${formattedDate}`;

    meta.appendChild(metaSpan);

    headerLeft.append(title, meta);
    header.appendChild(headerLeft);

    // Description
    const details = document.createElement("details");

    const summary = document.createElement("summary");
    summary.textContent = "Description";

    const desc = document.createElement("p");
    desc.textContent = ws.description || "No description.";

    details.append(summary, desc);

    // Restore section
    let restoreSection;

    if (ws.role === "owner" || ws.role === "admin") {
      const btn = document.createElement("button");
      btn.className = "btn btn-secondary restoreWorkspaceBtn";
      btn.textContent = "Restore";

      restoreSection = btn;
    } else {
      const info = document.createElement("p");
      info.textContent =
        "Only admins or owners of this workspace can restore it.";

      restoreSection = info;
    }

    card.append(header, details, restoreSection);
    div.appendChild(card);
  });

  historyContainer.appendChild(div);
}

// Restore button event
function restoreWorkspaceEvent() {
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".restoreWorkspaceBtn");
    if (!btn) return;

    const workspace = btn.closest(".workspaceCard");
    if (!workspace) return;

    await restoreWorkspace(workspace.dataset.id);
  });
}

async function restoreWorkspace(id) {
  confirmAction(
    "Restore this workspace? Restoring the workspace will allow all members to access it again.",
    [
      { label: "Cancel", type: "cancel" },
      {
        label: "Restore",
        type: "confirm",
        onClick: () => performWorkspaceRestore(id),
      },
    ],
  );
}

async function performWorkspaceRestore(id) {
  const { error } = await supabase
    .from("workspaces")
    .update({
      status: "active",
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  actionMsg(
    "Workspace restored! Open it in the 'All Workspaces' page.",
    "success",
  );

  renderArchive();
}

// Initialise
restoreWorkspaceEvent();
renderArchive();
