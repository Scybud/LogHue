// focus-timer.js
import { supabase } from "../supabase.js";
import { loadComponent, closeModal } from "https://ui.scybud.com/js/ui.js";
import { actionMsg } from "../utils/modals.js";
import { sessionState } from "../session.js";

const STORAGE_KEY = "loghue_focus_timer_state";
const TICK_MS = 1000;
const RING_CIRCUMFERENCE = 553;

let state = null;
let tickHandle = null;
let els = {};
let userId = null;

// Drag state
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;


function playGoalReachedSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // Soft two-tone chime
    const notes = [523.25, 659.25]; // C5 → E5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6 + i * 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.12);
      osc.stop(now + 0.7 + i * 0.15);
    });
  } catch (err) {
    // AudioContext can fail on some browsers if the user hasn't interacted yet
    console.warn("Could not play goal sound:", err);
  }
}


/**
 * Opens the focus timer modal for a task.
 * Works for both workspace tasks and personal tasks.
 * @param {object} task
 * @param {"workspace" | "personal"} [type] - optional, auto-detected when omitted
 */
export async function openFocusTimerModal(task, type = null) {
  await loadComponent("/components/modals/focus-timer", "modalContainer");

  cacheEls();

  const isPersonal =
    type === "personal" ||
    (!task.workspace_id && !task.workspace && !task.type);

  const workspaceId = isPersonal
    ? null
    : (task.workspace_id ?? task.workspace?.id ?? null);

  const taskTitle = task.title || task.name || "Untitled task";
  const resumed = restoreState(task.id);

  state = resumed
    ? {
        ...resumed,
        workspaceId: resumed.workspaceId ?? workspaceId,
        isPersonal: resumed.isPersonal ?? isPersonal,
      }
    : {
        taskId: task.id,
        workspaceId,
        taskTitle,
        isPersonal,
        startedAt: null,
        elapsedMs: 0,
        targetMs: 25 * 60 * 1000,
        status: "idle",
        isCompact: false,
        posX: null,
        posY: null,
      };

  els.contextLabel.textContent = state.isPersonal
    ? "Personal task"
    : "Workspace task";
  els.taskTitle.textContent = taskTitle;
  els.targetInput.value = Math.round(state.targetMs / 60000);

  // Personal tasks have no "logged today" data
  if (state.isPersonal) {
    els.todayTotal.closest(".focus-timer-today")?.style.setProperty("display", "none");
    els.stopBtn.textContent = "Stop";
  } else {
    els.todayTotal.closest(".focus-timer-today")?.style.removeProperty("display");
    els.stopBtn.textContent = "Stop & log";
    await refreshTodayTotal();
  }

  render();
  attachFocusTimerEvents();
  initDrag();

  if (state.status === "running") startTicking();
}

function cacheEls() {
  els = {
    panel: document.getElementById("focusTimerPanel"),
    contextLabel: document.getElementById("focusTimerContext"),
    taskTitle: document.getElementById("focusTimerTaskTitle"),
    time: document.getElementById("focusTimerTime"),
    stateLabel: document.getElementById("focusTimerState"),
    ring: document.getElementById("focusTimerRingProgress"),
    targetInput: document.getElementById("focusTimerTargetInput"),
    primaryBtn: document.getElementById("focusTimerPrimaryBtn"),
    stopBtn: document.getElementById("focusTimerStopBtn"),
    cancelBtn: document.getElementById("focusTimerCancelBtn"),
    minimizeBtn: document.getElementById("focusTimerMinimizeBtn"),
    todayTotal: document.getElementById("focusTimerTodayTotal"),
    compact: document.getElementById("focusTimerCompact"),
    compactTime: document.getElementById("focusTimerCompactTime"),
    compactToggle: document.getElementById("focusTimerCompactToggle"),
    compactExpand: document.getElementById("focusTimerCompactExpand"),
  };
}

export function attachFocusTimerEvents() {
  els.primaryBtn.onclick = handlePrimaryClick;
  els.stopBtn.onclick = handleStopAndLog;
  els.cancelBtn.onclick = handleCancel;
  els.targetInput.onchange = handleTargetChange;
  els.minimizeBtn.onclick = () => setCompact(true);
  els.compactExpand.onclick = () => setCompact(false);
  els.compactToggle.onclick = handlePrimaryClick;

  document.querySelectorAll("[data-close-focus-timer]").forEach((el) => {
    el.onclick = closeModal;
  });
}

/* ---------- Drag ---------- */
function initDrag() {
  const handle = els.compact;
  if (!handle) return;

  handle.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
}

function onPointerDown(e) {
  // Only drag when in compact mode and not clicking a button
  if (!state?.isCompact) return;
  if (e.target.closest("button")) return;

  isDragging = true;
  els.panel.classList.add("dragging");

  const rect = els.panel.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;

  // Switch to fixed positioning so we can freely move it
  els.panel.style.position = "fixed";
  els.panel.style.margin = "0";
  els.panel.style.zIndex = "9999";

  e.preventDefault();
}

function onPointerMove(e) {
  if (!isDragging) return;

  let x = e.clientX - dragOffsetX;
  let y = e.clientY - dragOffsetY;

  // Constrain to viewport
  const maxX = window.innerWidth - els.panel.offsetWidth;
  const maxY = window.innerHeight - els.panel.offsetHeight;
  x = Math.max(0, Math.min(x, maxX));
  y = Math.max(0, Math.min(y, maxY));

  els.panel.style.left = `${x}px`;
  els.panel.style.top = `${y}px`;
  els.panel.style.right = "auto";
  els.panel.style.bottom = "auto";

  state.posX = x;
  state.posY = y;
}

function onPointerUp() {
  if (!isDragging) return;
  isDragging = false;
  els.panel.classList.remove("dragging");
  persistState();
}

function applySavedPosition() {
  if (state.posX != null && state.posY != null && state.isCompact) {
    els.panel.style.position = "fixed";
    els.panel.style.left = `${state.posX}px`;
    els.panel.style.top = `${state.posY}px`;
    els.panel.style.right = "auto";
    els.panel.style.bottom = "auto";
    els.panel.style.margin = "0";
    els.panel.style.zIndex = "9999";
  }
}

/* ---------- Core timer logic ---------- */
function setCompact(compact) {
  state.isCompact = compact;
  if (!compact) {
    // Reset positioning when expanding
    els.panel.style.position = "";
    els.panel.style.left = "";
    els.panel.style.top = "";
    els.panel.style.right = "";
    els.panel.style.bottom = "";
    els.panel.style.margin = "";
    els.panel.style.zIndex = "";
  }
  persistState();
  render();
  if (compact) applySavedPosition();
}

function handlePrimaryClick() {
  if (
    state.status === "idle" ||
    state.status === "paused" ||
    state.status === "reached"
  ) {
    state.status = "running";
    state.startedAt = Date.now() - state.elapsedMs;
    startTicking();
  } else if (state.status === "running") {
    state.status = "paused";
    stopTicking();
  }
  persistState();
  render();
}

function handleCancel() {
  stopTicking();
  clearPersistedState();
  closeModal();
}

async function handleStopAndLog() {
  // Personal tasks → just stop and close, no DB write
  if (state.isPersonal) {
    stopTicking();
    clearPersistedState();
    closeModal();
    actionMsg("Focus session ended.", "success");
    return;
  }

  // ── Workspace task (existing logic) ──
  if (state.elapsedMs < 60000) {
    actionMsg("Log at least a minute before saving.", "warn");
    return;
  }

  els.stopBtn.disabled = true;
  els.primaryBtn.disabled = true;
  els.cancelBtn.disabled = true;

  stopTicking();

  const minutes = Math.round(state.elapsedMs / 60000);
  const userId = sessionState?.user?.id;

  try {
    const { error } = await supabase.from("workspace_task_logs").insert({
      task_id: state.taskId,
      created_by: userId,
      log_note: `Just completed a ${minutes} minute work session on this task`,
      workspace_id: state.workspaceId,
      duration_minutes: minutes,
      source: "focus_timer",
      task_status: "in progress",
    });

    if (error) throw error;

    actionMsg(`Logged ${minutes}m on this task.`, "success");
    clearPersistedState();
    closeModal();
  } catch (err) {
    console.error(err);
    actionMsg("Could not save your focus log. Try again.", "error");
    els.stopBtn.disabled = false;
    els.primaryBtn.disabled = false;
    els.cancelBtn.disabled = false;
  }
}

function handleTargetChange(e) {
  const minutes = Math.min(180, Math.max(5, Number(e.target.value) || 25));
  e.target.value = minutes;
  state.targetMs = minutes * 60000;
  persistState();
  render();
}

function startTicking() {
  stopTicking();
  tickHandle = setInterval(() => {
    state.elapsedMs = Date.now() - state.startedAt;

    if (state.elapsedMs >= state.targetMs && state.status !== "reached") {
      state.status = "reached";
      stopTicking();
      playGoalReachedSound();   // ← play the chime
    }

    persistState();
    render();
  }, TICK_MS);
}

function stopTicking() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

function render() {
  if (!els.panel) return;

  els.panel.classList.toggle("is-compact", !!state.isCompact);
  els.panel.dataset.state = state.status;

  const timeStr = formatTime(state.elapsedMs);
  els.time.textContent = timeStr;
  if (els.compactTime) els.compactTime.textContent = timeStr;

  const labels = {
    idle: "Ready",
    running: "Focusing",
    paused: "Paused",
    reached: "Target reached",
  };
  els.stateLabel.textContent = labels[state.status] || "Ready";

  const progress = Math.min(1, state.elapsedMs / state.targetMs);
  els.ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));

  // Primary button label
  if (state.status === "running") {
    els.primaryBtn.textContent = "Pause";
  } else if (state.status === "reached") {
    els.primaryBtn.textContent = "Restart";
  } else {
    els.primaryBtn.textContent = "Start";
  }

  // Compact toggle icon
  if (els.compactToggle) {
    els.compactToggle.innerHTML =
      state.status === "running" ? "&#10074;&#10074;" : "&#9654;";
    els.compactToggle.setAttribute(
      "aria-label",
      state.status === "running" ? "Pause" : "Resume",
    );
  }

  const hasTime = state.elapsedMs > 0;
  els.stopBtn.disabled = !hasTime;
  els.cancelBtn.disabled = !hasTime && state.status === "idle";
  els.primaryBtn.disabled = false; // always re-enable after render unless logging
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

async function refreshTodayTotal() {
  if (state?.isPersonal) {
    els.todayTotal.textContent = "0m";
    return;
  }

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
    total >= 60 ? `${Math.floor(total / 60)}h ${total % 60}m` : `${total}m`;
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function restoreState(taskId) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && saved.taskId === taskId) {
      if (saved.status === "running") {
        saved.elapsedMs = Date.now() - saved.startedAt;
        if (saved.elapsedMs >= saved.targetMs) {
          saved.status = "reached";
          saved.elapsedMs = saved.targetMs;
        }
      }
      return saved;
    }
  } catch {
    // ignore
  }
  return null;
}

function clearPersistedState() {
  localStorage.removeItem(STORAGE_KEY);
}
