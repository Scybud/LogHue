import { initCommandPalette } from "./components/commandPalette.js";
import {
  loadComponent,
  removeLoader,
  preferedPrimary,
  setTheme,
  setInterfaceDensity,
} from "./ui.js";
import { attachSidebarEvents } from "./components/sidebar.js";
import {
  openCreateTaskModal,
  openLogTaskModal,
  openCreateWorkspaceModal,
  openLoginModal,
} from "./utils/modals.js";
import { attachSidebarToggle, toggleSearchBar } from "./utils/toggle.js";
import { initSession } from "./session.js";
import { initWorkspaces } from "./features/workspaceData.js";
import { autoExpandTextarea } from "./utils/textarea.js";
import { handleConcentEvents, loadAnalytics } from "https://loghue.com/analytics.js";
import { attachSignoutEvents } from "./auth/auth.js";
import {
  renderGlobalNotifications,
  fetchNotificationsForUser,
} from "./utils/notifications.js";
import {sessionState, sessionReady} from "./session.js"
import {initOnboarding} from "./components/onboardingModal.js"

window.addEventListener("DOMContentLoaded", async () => {
  await sessionReady;

  const userId = await sessionState.user.id;


  const path = window.location.pathname;

  await initCommandPalette();

  // Load correct sidebar based on page
  if (path.includes("workspace")) {
    // Prefer a shared container id; fall back to the old ones while migrating
    const target =
      document.getElementById("workspaceSidebarContainer");

    if (target) {
      await loadComponent("../components/workspace-sidebar", target.id);
    }
  }


  // General sidebar is safe everywhere
  await loadComponent("../components/sidebar", "sidebarContainer");

  // SESSION FUNCTION
  initSession();

  // Analytics
  await loadComponent("../components/modals/cookies-banner", "infoDisplay");
  const saved = localStorage.getItem("consent-preferences");
  if (saved) {
    const prefs = JSON.parse(saved);
    const consentBanner = document.getElementById("consent-banner");
    if (consentBanner) consentBanner.remove();

    if (prefs.analytics) loadAnalytics();
  }

  //JOIN NOTIFICATIONS GLOBALLY
  async function loadGlobalNotifications() {
    const notifications = await fetchNotificationsForUser();

    renderGlobalNotifications(notifications);
  }

  // Call on page load
  loadGlobalNotifications();

  toggleSearchBar();

  await initOnboarding(userId);

  handleConcentEvents();
  setTheme();
  removeLoader();
  attachSignoutEvents();
  attachSidebarToggle();
  attachSidebarEvents();

  // Modals (safe globally) — skip log-task on workspace pages;
  // initWorkspaceDashboard wires it with a real workspaceId.
  if (!path.includes("workspace")) {
    openLogTaskModal();
  }
  openCreateTaskModal();
  openCreateWorkspaceModal();
  openLoginModal();

  initWorkspaces();
  autoExpandTextarea();
});

//preffered primary color
preferedPrimary();

//ADD INTERFACE DENSITY PREFFERENCE
setInterfaceDensity();
