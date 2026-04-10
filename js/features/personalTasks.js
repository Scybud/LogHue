import { dataCount } from "../utils.js";
import { supabase } from "../supabase.js";
import { sessionState, sessionReady } from "../session.js";
import { actionMsg, openLogPersonalTaskModal } from "../utils/modals.js";
import { confirmAction } from "../utils/modals.js";
import {setLoading} from "../ui.js"

let personalCreatedLogs = null;
let loggedTasksCount = null;

export let savedLogDetails = [];

// -------------------------------
// Initialization
// -------------------------------
export async function initPersonalTasks() {
  await sessionReady;
  const user = sessionState.user;

  personalCreatedLogs = document.getElementById("personalCreatedLogs");

  loggedTasksCount = document.getElementById("loggedTasksCount");

  setLoading(true, personalCreatedLogs);

  const { data, error } = await supabase
    .from("personal_tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  setLoading(false, personalCreatedLogs);

  if (error) {
    console.error(error);
actionMsg("Failed to load logs", "error");    
return;
  }

  savedLogDetails = data || [];

  renderExistingLogs();
  updateTaskCount();
  checkIfEmpty();
  attachDeleteLogEvent(personalCreatedLogs, user.id);
  openLogPersonalTaskModal();
}

// -------------------------------
// Helpers
// -------------------------------
function formatDateTime(iso) {
  return new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function updateTaskCount() {
  if (loggedTasksCount) dataCount(loggedTasksCount, savedLogDetails);
}

// -------------------------------
// Empty State
// -------------------------------
export function checkIfEmpty() {
  if (!personalCreatedLogs) return;

  if (savedLogDetails.length === 0) {
    personalCreatedLogs.innerHTML = EMPTY_STATE_SVG;
    return;
  }

  const placeholder = personalCreatedLogs.querySelector(".emptyStateImg");
  if (placeholder) placeholder.remove();
}

const EMPTY_STATE_SVG = `     
<svg
  class="emptyStateImg"
  viewBox="0 0 220 160"
  fill="none"
  role="img"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>

  <!-- Background card -->
  <rect x="20" y="32" width="180" height="90" rx="10" fill="var(--card-bg)" />

  <!-- Log lines -->
  <rect x="36" y="50" width="120" height="8" rx="4" fill="#E0E0E6" />
  <rect x="36" y="66" width="140" height="8" rx="4" fill="#E8E8EE" />
  <rect x="36" y="82" width="110" height="8" rx="4" fill="#E8E8EE" />
  <rect x="36" y="98" width="90" height="8" rx="4" fill="#E8E8EE" />

  <!-- Magnifying glass -->
  <circle cx="160" cy="88" r="16" stroke="#D0D0D8" stroke-width="3" />
  <line x1="170" y1="98" x2="178" y2="106" stroke="#D0D0D8" stroke-width="3" stroke-linecap="round" />

  <!-- Decorative circles -->
  <circle cx="32" cy="28" r="4" fill="#FFE4D8" />
  <circle cx="188" cy="122" r="5" fill="#FFE4D8" />
  <circle cx="40" cy="120" r="3" fill="#FFE4D8" />

  <!-- Hint text -->
  <text
    x="110"
    y="138"
    text-anchor="middle"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
    font-size="9"
    fill="#8A8A99"
  >
    No logs available yet.
  </text>

</svg>
`;

// -------------------------------
// Create Log Element
// -------------------------------
export function createLogElement(log) {
  const el = document.createElement("details");
  el.classList.add("taskContainer");
  el.dataset.id = log.id;

  const summary = document.createElement("summary");
  summary.setAttribute("title", "click to see details");

  const nameSpan = document.createElement("span");
  nameSpan.classList.add("personalTaskName");
  nameSpan.textContent = log.name;

  const deleteBtn = document.createElement("button");
  deleteBtn.setAttribute("data-title", "Delete Task");
  deleteBtn.setAttribute("type", "button");
  deleteBtn.classList.add("deleteBtn", "tooltip");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const polyline = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polyline",
  );
  polyline.setAttribute("points", "3 6 5 6 21 6");

  const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path1.setAttribute("d", "M19 6l-1 14H6L5 6");

  const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path2.setAttribute("d", "M10 11v6");

  const path3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path3.setAttribute("d", "M14 11v6");

  const path4 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path4.setAttribute("d", "M9 6V4h6v2");

  svg.append(polyline, path1, path2, path3, path4);
  deleteBtn.appendChild(svg);

  summary.append(nameSpan, deleteBtn);

  const dateSpan = document.createElement("span");
  dateSpan.textContent = formatDateTime(log.created_at);

  const desc = document.createElement("p");
  desc.textContent = log.description;

  el.append(summary, dateSpan, desc);

  return el;
}
// -------------------------------
// Render Logs
// -------------------------------
export function renderExistingLogs() {
  if (!personalCreatedLogs) return;

  personalCreatedLogs.innerHTML = "";
  personalCreatedLogs.classList.add("reordering");

  savedLogDetails.forEach((log) => {
    const el = createLogElement(log);
    personalCreatedLogs.append(el);

    requestAnimationFrame(() => el.classList.add("show"));
  });

  setTimeout(() => {
    personalCreatedLogs.classList.remove("reordering");
  }, 300);
}

// -------------------------------
// Delete Log
// -------------------------------

export function attachDeleteLogEvent(container, userId) {
  if (!container) return;

  container.addEventListener("click", async (e) => {
      const btn = e.target.closest(".deleteBtn");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

  confirmAction("Delete this task log?", [
    { label: "Cancel", type: "cancel" },
    { label: "Delete", type: "confirm", onClick: () => performLogDelete(btn, userId) },
  ]);

    });
}

async function performLogDelete(btn, userId) {
    const logToDelete = btn.closest(".taskContainer");
      const id = logToDelete.dataset.id;

      const { error } = await supabase
        .from("personal_tasks")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        console.error(error);
        alert(error.message);
        return;
      }

      // Remove from memory
      savedLogDetails = savedLogDetails.filter(
        (log) => String(log.id) !== String(id),
      );

      // Animate + remove
      logToDelete.classList.add("removing");

      setTimeout(() => {
        logToDelete.remove();
      }, 550);
      actionMsg("Log deleted successfully!", "success")
      updateTaskCount();
      checkIfEmpty();
}