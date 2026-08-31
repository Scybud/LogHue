import { sessionReady, sessionState } from "../session.js";
import { initSmartSearch } from "../utils/search.js";
import { supabase } from "../supabase.js";

const closeWarningBtn = document.getElementById("closeWarning");

// Handles Onboarding Prompt UI Text Adjustments dynamically
function handleOnboardingWarning() {
  if (sessionState.profile?.onboarded === false) {
    const warningText = document.querySelector(".warningText");
    if (warningText) {
      warningText.innerHTML = `Hi! Get started by creating a workspace. <a href="create-workspace">Create workspace</a>`;
    }
  }
}

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

  const dashboardSection = document.querySelector(".dashboard-section");
  await initSmartSearch(dashboardSection);
}

function renderGreeting(user) {
  const greetingEl = document.getElementById("dashboardGreeting");
  if (!greetingEl) return;

  const name = sessionState.profile?.full_name?.split(" ")[0];
  greetingEl.textContent = name ? `Welcome back, ${name}` : "Welcome back";
}

async function renderDashboardStats(user) {
  const statsEl = document.getElementById("dashboardStats");
  if (!statsEl) return;

  const [tasksRes, notesRes, membershipRes] = await Promise.all([
    supabase
      .from("personal_tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_recurring", false)
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
    <span class="dashboardStat"><strong>${openTasks}</strong> open task${openTasks === 1 ? "" : "s"}</span>
    <span class="dashboardStat"><strong>${notes}</strong> note${notes === 1 ? "" : "s"}</span>
    <span class="dashboardStat"><strong>${workspaces}</strong> workspace${workspaces === 1 ? "" : "s"}</span>
  `;
}
