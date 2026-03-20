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
import {
  attachSidebarToggle,
} from "./utils/toggle.js";
import { initSession } from "./session.js";
import { initPersonalTasks } from "./features/personalTasks.js";
import { initWorkspaces } from "./features/workspaceData.js";
import { autoExpandTextarea } from "./utils/textarea.js";
import { handleConcentEvents, loadAnalytics } from "../analytics.js";
import { attachSignoutEvents } from "./auth/auth.js";

window.addEventListener("DOMContentLoaded", async () => {
  const path = window.location.pathname;

  // Load correct sidebar based on page
  if (path.includes("workspace-dashboard-admin")) {
    await loadComponent(
      "https://loghue.com/components/sidebar-admin",
      "adminSidebarContainer",
    );
  }

  if (path.includes("workspace-dashboard-member")) {
    await loadComponent(
      "https://loghue.com/components/sidebar-member",
      "memberSidebarContainer",
    );
  }

  if (path.includes("dashboard")) {
    await loadComponent(
      "https://loghue.com/components/sidebar-dashboard",
      "dashboardSidebarContainer",
    );
  }

  // General sidebar is safe everywhere
  await loadComponent(
    "https://loghue.com/components/sidebar-general",
    "generalSidebarContainer",
  );

  // SESSION FUNCTION
  initSession();

  // Analytics
  const saved = localStorage.getItem("consent-preferences");
  if (saved) {
    const prefs = JSON.parse(saved);
    const actionsMessage = document.getElementById("actionsMessage");
    if (actionsMessage) actionsMessage.innerHTML = "";

    if (prefs.analytics) loadAnalytics();
  }

  handleConcentEvents();
  setTheme();
  removeLoader();
  attachSignoutEvents();
  attachSidebarToggle();
  attachSidebarEvents();

  // Modals (safe globally)
  openCreateTaskModal();
  openLogTaskModal();
  openCreateWorkspaceModal();
  openLoginModal();

  initPersonalTasks();
  initWorkspaces();
  autoExpandTextarea();
});


//preffered primary color
preferedPrimary();

//ADD INTERFACE DENSITY PREFFERENCE
setInterfaceDensity();
