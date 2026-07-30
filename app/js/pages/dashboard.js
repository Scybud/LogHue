import { sessionReady, sessionState } from "../session.js";
import { initSmartSearch } from "../utils/search.js";

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
  "Search workspaces...",
  "Search notes...",
  "Search tasks...",
  'Try "all workspaces"',
  'Try "all notes"',
  'Try "all tasks"',
  "Press Ctrl + K anywhere",
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

  const dashboardSection = document.querySelector(".dashboard-section");
  await initSmartSearch(dashboardSection);
}
