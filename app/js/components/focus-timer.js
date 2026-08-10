// focus-timer.js
import { supabase } from "../supabase.js";
import { loadComponent, closeModal } from "https://scybud.github.io/scybud-ui/js/ui.js";
import { actionMsg } from "../utils/modals.js";
import { sessionState } from "../session.js";

const STORAGE_KEY = "loghue_focus_timer_state";
const TICK_MS = 1000;
const RING_CIRCUMFERENCE = 553;

let state = null;
let tickHandle = null;
let els = {};
let userId = null;

/**
 * Opens the focus timer modal for a task.
 * Loads the HTML, restores any previous timer for this task,
 * wires up the UI, and starts ticking if the timer was already running.
 */
export async function openFocusTimerModal(task) {
  // Load the modal HTML into the page
  await loadComponent("/components/modals/focus-timer", "modalContainer");

  // Grab references to every element we need
  cacheEls();

  // Prefer the scalar workspace_id; fall back to the nested workspace object
  const workspaceId = task.workspace_id ?? task.workspace?.id ?? null;

  // Try to restore a previously saved timer for this exact task
  const resumed = restoreState(task.id);

  // Build the live state object
  state = resumed
    ? {
        ...resumed,
        // If the saved state had a null workspaceId, replace it with the real one
        workspaceId: resumed.workspaceId ?? workspaceId,
      }
    : {
        taskId: task.id,
        workspaceId,
        taskTitle: task.title,
        startedAt: null,
        elapsedMs: 0,
        targetMs: 25 * 60 * 1000,
        status: "idle",
      };

  // Update the static labels at the top of the modal
  els.contextLabel.textContent =
    task.type === "workspace" || workspaceId
      ? "Workspace task"
      : "Personal task";
  els.taskTitle.textContent = task.title;
  els.targetInput.value = Math.round(state.targetMs / 60000);

  // Show how many minutes were already logged on this task today
  await refreshTodayTotal();

  // Paint the current numbers and button states
  render();

  // Attach all click / change handlers
  attachFocusTimerEvents();

  // If we restored a running timer, keep the clock moving
  if (state.status === "running") startTicking();
}

/**
 * Attach handlers to the buttons and inputs inside the modal.
 * Called every time the modal is opened because loadComponent
 * inserts fresh DOM nodes.
 */
export function attachFocusTimerEvents() {
  els.primaryBtn.onclick = handlePrimaryClick;
  els.stopBtn.onclick = handleStopAndLog;
  els.cancelBtn.onclick = handleCancel;
  els.targetInput.onchange = handleTargetChange;

  document.querySelectorAll("[data-close-focus-timer]").forEach((el) => {
    el.onclick = closeModal;
  });
}

/** Cache all the DOM elements we will touch so we don't query them repeatedly. */
function cacheEls() {
  els = {
    panel: document.querySelector(".focus-timer-panel"),
    contextLabel: document.getElementById("focusTimerContext"),
    taskTitle: document.getElementById("focusTimerTaskTitle"),
    time: document.getElementById("focusTimerTime"),
    stateLabel: document.getElementById("focusTimerState"),
    ring: document.getElementById("focusTimerRingProgress"),
    targetInput: document.getElementById("focusTimerTargetInput"),
    primaryBtn: document.getElementById("focusTimerPrimaryBtn"),
    stopBtn: document.getElementById("focusTimerStopBtn"),
    cancelBtn: document.getElementById("focusTimerCancelBtn"),
    todayTotal: document.getElementById("focusTimerTodayTotal"),
  };
}

/** Start or pause the timer when the main button is clicked. */
function handlePrimaryClick() {
  if (state.status === "idle" || state.status === "paused") {
    // Begin (or resume) counting from the current elapsed time
    state.status = "running";
    state.startedAt = Date.now() - state.elapsedMs;
    startTicking();
  } else if (state.status === "running") {
    // Freeze the clock
    state.status = "paused";
    stopTicking();
  }

  // Keep the browser storage in sync
  persistState();
  render();
}

/** Discard the timer and close the modal without saving anything. */
function handleCancel() {
  stopTicking();
  clearPersistedState();
  closeModal();
}

/**
 * Stop the timer, write a log row to the database,
 * then close the modal.
 */
async function handleStopAndLog() {
  userId = sessionState.user.id;

  // Refuse to log sessions shorter than one minute
  if (state.elapsedMs < 60000) {
    actionMsg("Log at least a minute before saving.", "warn");
    return;
  }

  stopTicking();

  const minutes = Math.round(state.elapsedMs / 60000);

  const { error } = await supabase.from("workspace_task_logs").insert({
    task_id: state.taskId,
    created_by: userId,
    log_note: `Just completed a ${minutes}minutes work session on this task`,
    workspace_id: state.workspaceId,
    duration_minutes: minutes,
    source: "focus_timer",
  });

  if (error) {
    console.log(error);
    actionMsg("Could not save your focus log. Try again.", "error");
    return;
  }

  actionMsg(`Logged ${minutes}m on this task.`, "success");
  clearPersistedState();
  closeModal();
}

/** Update the target duration when the user changes the minutes input. */
function handleTargetChange(e) {
  // Clamp between 5 and 180 minutes
  const minutes = Math.min(180, Math.max(5, Number(e.target.value) || 25));
  e.target.value = minutes;
  state.targetMs = minutes * 60000;
  persistState();
  render();
}

/** Start the 1-second interval that advances the clock. */
function startTicking() {
  stopTicking(); // clear any previous interval first
  tickHandle = setInterval(() => {
    state.elapsedMs = Date.now() - state.startedAt;

    // Mark the session as finished when the target is reached
    if (state.elapsedMs >= state.targetMs && state.status !== "reached") {
      state.status = "reached";
    }

    persistState();
    render();
  }, TICK_MS);
}

/** Clear the interval so the clock stops. */
function stopTicking() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

/** Push the current state values into the DOM. */
function render() {
  if (!els.panel) return;

  els.panel.dataset.state = state.status;
  els.time.textContent = formatTime(state.elapsedMs);

  const labels = {
    idle: "Ready",
    running: "Focusing",
    paused: "Paused",
    reached: "Target reached",
  };
  els.stateLabel.textContent = labels[state.status];

  // Update the circular progress ring
  const progress = Math.min(1, state.elapsedMs / state.targetMs);
  els.ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));

  // Update button labels and disabled states
  els.primaryBtn.textContent = state.status === "running" ? "Pause" : "Start";
  els.stopBtn.disabled = state.elapsedMs === 0;
  els.cancelBtn.disabled = state.elapsedMs === 0 && state.status === "idle";
}

/** Turn milliseconds into HH:MM:SS. */
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * Fetch all focus-timer logs for this task that were created today
 * and show the total minutes in the modal.
 */
async function refreshTodayTotal() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("workspace_task_logs")
    .select("duration_minutes")
    .eq("task_id", state.taskId)
    .eq("source", "focus_timer")
    .gte("created_at", startOfDay.toISOString());

  if (error || !data) {
    els.todayTotal.textContent = "0m";
    return;
  }

  const total = data.reduce((sum, row) => sum + (row.duration_minutes || 0), 0);
  els.todayTotal.textContent =
    total >= 60 ? `${Math.round(total / 60)}h ${total % 60}m` : `${total}m`;
}


/** Write the current timer state to localStorage so it survives a refresh. */
function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Read a previously saved timer from localStorage.
 * Returns the state only if it belongs to the same taskId;
 * otherwise returns null so a fresh timer is created.
 */
function restoreState(taskId) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && saved.taskId === taskId) {
      // If the timer was running when the page closed, advance the elapsed time
      if (saved.status === "running") {
        saved.elapsedMs = Date.now() - saved.startedAt;
      }
      return saved;
    }
  } catch {
    // Corrupt or missing data → start fresh
  }
  return null;
}

/** Delete the saved timer from localStorage. */
function clearPersistedState() {
  localStorage.removeItem(STORAGE_KEY);
}
