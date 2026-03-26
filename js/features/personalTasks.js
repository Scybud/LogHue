import { dataCount } from "../utils.js";
import { supabase } from "../supabase.js";
import { sessionState, sessionReady } from "../session.js";
import { openLogPersonalTaskModal } from "../utils/modals.js";
import { confirmAction } from "../utils/modals.js";

let personalCreatedLogs = null;
let loggedTasksCount = null;

export let savedLogDetails = [];
let isLoading = false;

// -------------------------------
// Loading State
// -------------------------------
function setLoading(state) {
  isLoading = state;
  personalCreatedLogs?.classList.toggle("isLoading", state);
}

// -------------------------------
// Initialization
// -------------------------------
export async function initPersonalTasks() {
  await sessionReady;
  const user = sessionState.user;

  personalCreatedLogs = document.getElementById("personalCreatedLogs");

  loggedTasksCount = document.getElementById("loggedTasksCount");

  setLoading(true);

  const { data, error } = await supabase
    .from("personal_tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  setLoading(false);

  if (error) {
    console.error(error);
    alert(error.message);
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
<svg class="emptyStateImg" ...> ... </svg>
`;

// -------------------------------
// Create Log Element
// -------------------------------
export function createLogElement(log) {
  const el = document.createElement("details");
  el.classList.add("taskContainer");
  el.dataset.id = log.id;

  el.innerHTML = `
    <summary title="click to see details">
     <span class="personalTaskName">${log.name}</span> <button data-title="Delete Task" type="button" class="deleteBtn tooltip"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6" />
  <path d="M19 6l-1 14H6L5 6" />
  <path d="M10 11v6" />
  <path d="M14 11v6" />
  <path d="M9 6V4h6v2" />
</svg>
      </button>
    </summary>
    <span>${formatDateTime(log.created_at)}</span>
    <p>${log.description}</p>
  `;

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
  if (!container && recentLogs) return;

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
        updateTaskCount();
        checkIfEmpty();
      }, 550);
}