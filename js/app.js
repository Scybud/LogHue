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
  await loadComponent(
    "https://loghue.com/components/sidebar-admin",
    "adminSidebarContainer",
  );
  await loadComponent(
    "https://loghue.com/components/sidebar-member",
    "memberSidebarContainer",
  );
  await loadComponent(
    "https://loghue.com/components/sidebar-dashboard",
    "dashboardSidebarContainer",
  );
  await loadComponent(
    "https://loghue.com/components/sidebar-general",
    "generalSidebarContainer",
  );
   await loadComponent(
     "https://loghue.com/components/modals/cookies-banner",
     "actionsMessage",
   );

  //SESSION FUNCTION
  initSession();


  // Auto-load analytics if user already accepted
  const saved = localStorage.getItem("consent-preferences");
  if (saved) {
    const prefs = JSON.parse(saved);
      const actionsMessage = document.getElementById("actionsMessage");
      if(actionsMessage) {
        actionsMessage.innerHTML = "";

      }

    if (prefs.analytics) {
      loadAnalytics();
    }
  }

  // Attach banner + modal events
  handleConcentEvents();

  //ADD THEME PREFFERENCE
  setTheme();

  //LOADER
  removeLoader();

  //Logout function
  attachSignoutEvents();

  attachSidebarToggle();
  attachSidebarEvents();

  openCreateTaskModal();
  openLogTaskModal();
  openCreateWorkspaceModal();
  openLoginModal();


  initPersonalTasks();
  initWorkspaces();
  personalLogInputContainerPanelToggle();

  autoExpandTextarea();
});

//preffered primary color
preferedPrimary();

//ADD INTERFACE DENSITY PREFFERENCE
setInterfaceDensity();
