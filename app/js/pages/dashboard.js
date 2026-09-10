import { sessionReady, sessionState } from "../session.js";
import { initSmartSearch } from "../utils/search.js";
import { supabase } from "../supabase.js";
import { loadPersonalTasksOnLimit } from "../data/tasksDb.js";
import { formatDateTimeRelatively } from "../utils/time.js";
import { getDateBucket } from "./personalTasks.js";
import { escapeHTML } from "../utils/escapeHTML.js";


const searchInput = document.getElementById("mainSearchInput");

const hints = [
  "Press Ctrl + K anywhere",
  "Search workspaces...",
  "Search notes...",
  "Search tasks...",
  "Search discussions...",
  'Try "all workspaces"',
  'Try "all notes"',
  'Try "all tasks"',
  'Try "/notes"',
  'Try "/workspaces"',
  'Try "/tasks"',
];

let hintIndex = 0;
let hintInterval;

function changePlaceholder(text) {
  searchInput.classList.add("searchHintFade");
  setTimeout(() => {
    searchInput.placeholder = text;
    searchInput.classList.remove("searchHintFade");
  }, 250);
}

function startHintAnimation() {
  searchInput.placeholder = hints[hintIndex];
  hintInterval = setInterval(() => {
    if (document.activeElement === searchInput) return;
    if (searchInput.value.trim() !== "") return;
    hintIndex = (hintIndex + 1) % hints.length;
    changePlaceholder(hints[hintIndex]);
  }, 3000);
}

startHintAnimation();
initDashboard();

export async function initDashboard() {
  await sessionReady;
  const user = sessionState.user;
  if (!user) return;

  const userNameEl = document.querySelector(".userName");
  if (userNameEl) {
    userNameEl.textContent = sessionState.profile?.full_name || "Developer";
  }

  renderGreeting(user);
  renderDashboardStats(user);
  renderTodayTasks(user);
  renderRecentNotes(user);
  renderWorkspacesList(user);
  startClock();

  const dashboardSection = document.querySelector(".dashboard-section");
  await initSmartSearch(dashboardSection);
}

function renderGreeting(user) {
  const greetingEl = document.getElementById("dashboardGreeting");
  if (!greetingEl) return;
  const name = sessionState.profile?.full_name?.split(" ")[0];
  greetingEl.textContent = name ? `Welcome back, ${name}` : "Welcome back";
}

function startClock() {
  const clockEl = document.getElementById("dashboardClock");
  const dateEl = document.getElementById("dashboardDate");
  if (!clockEl && !dateEl) return;

  function tick() {
    const now = new Date();
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }
  }
  tick();
  setInterval(tick, 1000);
}

async function renderDashboardStats(user) {
  const statsEl = document.getElementById("dashboardStats");
  if (!statsEl) return;

  const [tasksRes, notesRes, membershipRes] = await Promise.all([
    supabase
      .from("personal_tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_template", false)
      .eq("is_completed", false),
    supabase
      .from("personal_notes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("workspace_members")
      .select("workspace_id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const openTasks = tasksRes.count ?? 0;
  const notes = notesRes.count ?? 0;
  const workspaces = membershipRes.count ?? 0;

  statsEl.innerHTML = `
    <a href="tasks" class="dashboardStat"><strong>${openTasks}</strong> open task${openTasks === 1 ? "" : "s"}</a>
    <a href="notes" class="dashboardStat"><strong>${notes}</strong> note${notes === 1 ? "" : "s"}</a>
    <a href="my-workspaces" class="dashboardStat"><strong>${workspaces}</strong> workspace${workspaces === 1 ? "" : "s"}</a>
  `;
}

// NOTE: assumes personal_tasks has `title` and `due_at` columns.
// Adjust the select list below if your column names differ.
async function renderTodayTasks(user) {
  const listEl = document.getElementById("todayTaskList");
  const metaEl = document.getElementById("todayTaskMeta");
  if (!listEl) return;

  const data = await loadPersonalTasksOnLimit(user.id, 5)

  if (!data) {
    console.error(error);
    listEl.innerHTML = `<p class="placeholderText">Could not load tasks.</p>`;
    return;
  }

  if (data.length === 0) {
    listEl.innerHTML = `<p class="placeholderText">Nothing due. Add a task to get started.</p>`;
    if (metaEl) metaEl.textContent = "0 open";
    return;
  }

 const todayTasks = data.filter((task) => getDateBucket(task.task_deadline) === "today");

if (todayTasks.length === 0) {
    listEl.innerHTML = `<p class="placeholderText">Nothing due today. Add a task to get started.</p>`;
    if (metaEl) metaEl.textContent = "0 open";
    return;
  }

  listEl.innerHTML = todayTasks
  .map(
    (task) => `
    <li class="dTaskItem" data-id="${task.id}" data-done="false">
    <button class="dTaskCheck" data-toggle aria-label="Mark complete">
    <svg viewBox="0 0 12 12"><polyline points="1.5,6 4.5,9 10.5,2" fill="none" stroke="#000" stroke-width="2"/></svg>
    </button>
    <span class="dTaskTime">${formatTaskTime(task.task_deadline)}</span>
    <span class="dTaskTitle">${escapeHTML(task.name)}</span>
    </li>
    `,
  )
  .join("");
  
  if (metaEl) metaEl.textContent = `${todayTasks.length} open`;

  listEl.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".dTaskItem");
      const id = item.dataset.id;
      item.dataset.done = "true";

      const { error: updateError } = await supabase
        .from("personal_tasks")
        .update({ is_completed: true })
        .eq("id", id);

      if (updateError) {
        console.error(updateError);
        item.dataset.done = "false";
        return;
      }

      setTimeout(() => {
        item.remove();
        const remaining = listEl.querySelectorAll(".dTaskItem").length;
        if (metaEl) metaEl.textContent = `${remaining} open`;
        if (remaining === 0) {
          listEl.innerHTML = `<p class="placeholderText">All caught up.</p>`;
        }
      }, 350);
    });
  });
}

function formatTaskTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// NOTE: assumes personal_notes has `title` and `updated_at` columns.
async function renderRecentNotes(user) {
  const listEl = document.getElementById("recentNotesList");
  if (!listEl) return;

  const { data, error } = await supabase
    .from("personal_notes")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(4);

  if (error) {
    console.error(error);
    listEl.innerHTML = `<p class="placeholderText">Could not load notes.</p>`;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = `<p class="placeholderText">No notes yet.</p>`;
    return;
  }

  listEl.innerHTML = data
    .map(
      (note) => `
    <li>
      <a href="notes?note=${note.id}">
        <span class="dNoteDot"></span>
        <span>
          <span class="dNoteTitle">${escapeHTML(note.title || "Untitled note")}</span>
          <span class="dNoteMeta">${formatDateTimeRelatively(note.updated_at)}</span>
        </span>
      </a>
    </li>
  `,
    )
    .join("");
}


async function renderWorkspacesList(user) {
  const listEl = document.getElementById("workspacesList");
  if (!listEl) return;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspace:workspaces(id, name)")
    .eq("user_id", user.id)
    .limit(6);

  if (error) {
    console.error(error);
    listEl.innerHTML = `<p class="placeholderText">Could not load workspaces.</p>`;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = `<p class="placeholderText">No workspaces yet.</p>`;
    return;
  }

  listEl.innerHTML = data
    .map((row) => {
      const ws = row.workspace || {};
      return `
      <li>
        <a href="workspace?ws=${ws.id}">
          <span class="dWsDot" style="background:${ws.color || "var(--link)"}"></span>
          <span class="dWsName">${escapeHTML(ws.name || "Untitled")}</span>
        </a>
      </li>
    `;
    })
    .join("");
}

