import {
  savedWorkspaceData,
  workspacesReady,
  formatDateTime,
} from "./workspaceData.js";
import { supabase } from "../supabase.js";

function checkIfEmpty() {
  const closedWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.status === "closed",
  );

  if (!historyContainer) return;
  if (closedWorkspaces.length === 0) {
    historyContainer.innerHTML = `<svg
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


  <!-- Bottom bar -->
  <rect x="28" y="106" width="60" height="10" rx="5" fill="#E0E0E6" />
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
    Nothing in your archeive
  </text>
</svg>
`;
  } else {
    const placeholder = historyContainer.querySelector(".placeholderText");
    if (placeholder) placeholder.remove();
  }
}

export async function renderHistory() {
  await workspacesReady;

  const historyContainer = document.querySelector("#historyContainer");
  historyContainer.innerHTML = ""; // clear existing content

  const closedWorkspaces = savedWorkspaceData.filter(
    (ws) => ws.status === "closed",
  );

  closedWorkspaces.forEach((ws) => {
    const formattedTDate = formatDateTime(ws.closed_at);

    // --- Card wrapper ---
    const card = document.createElement("div");
    card.className = `workspaceCard card ${ws.status}`;
    card.dataset.id = ws.id;
    card.title = "Workspace can only be accessed after restore";

    // --- Header ---
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

    const metaP = document.createElement("p");
    const metaSpan = document.createElement("span");
    metaSpan.className = "meta";
    metaSpan.textContent = `Created on: ${formattedTDate}`;
    metaP.appendChild(metaSpan);

    headerLeft.appendChild(title);
    headerLeft.appendChild(metaP);
    header.appendChild(headerLeft);

    // --- Description section ---
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Description";

    const desc = document.createElement("p");
    desc.textContent = ws.description;

    details.appendChild(summary);
    details.appendChild(desc);

    // --- Restore section ---
    let restoreSection;

    if (ws.role === "admin") {
      const btn = document.createElement("button");
      btn.className = "btn btn-secondary restoreWorkspaceBtn";
      btn.textContent = "Restore";
      restoreSection = btn;
    } else {
      const placeholder = document.createElement("p");
      placeholder.className = "placeholderText";
      placeholder.textContent =
        "Only admin(s) of this workspace can restore it.";
      restoreSection = placeholder;
    }

    // --- Assemble card ---
    card.appendChild(header);
    card.appendChild(details);
    card.appendChild(restoreSection);

    // --- Add to container ---
    historyContainer.appendChild(card);
  });

  restoreWorkspaceEvent();
}

renderHistory();
checkIfEmpty();

//RESTORE WORKSPACE
function restoreWorkspaceEvent() {
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".restoreWorkspaceBtn");

    if (!btn) return;

    const ok = confirm("Restore workspace?");
    if (!ok) return;

    const workspaceToRestore = btn.closest(".workspaceCard");
    const id = workspaceToRestore.dataset.id;

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

    window.location.reload();
  });
  checkIfEmpty();
}
