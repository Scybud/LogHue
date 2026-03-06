import { loadComponent, removeLoader, preferedPrimary } from "./ui.js";
import { attachSidebarEvents } from "./components/sidebar.js";
import {
  openCreateTaskModal,
  openLogTaskModal,
  openCreateWorkspaceModal,
  openLoginModal,
  
} from "./utils/modals.js";
import {
  attachSidebarToggle,
  personalLogInputContainerPanelToggle,
} from "./utils/toggle.js";
import {initSession
} from "./session.js"
import { initPersonalTasks } from "./features/personalTasks.js";
import { initWorkspaces } from "./features/workspaceData.js";
import { autoExpandTextarea } from "./utils/textarea.js";

import {loginFuntion, attachSignoutEvents} from "./auth.js"

window.addEventListener("DOMContentLoaded", async () => {
  await loadComponent(
    "../components/sidebar-admin.html",
    "adminSidebarContainer",
  );
  await loadComponent(
    "../components/sidebar-member.html",
    "memberSidebarContainer",
  );
  await loadComponent(
    "../components/sidebar-dashboard.html",
    "dashboardSidebarContainer",
  );
  await loadComponent(
    "../components/sidebar-general.html",
    "generalSidebarContainer",
  );

  //LOADER
removeLoader()

initSession()
  //Login function
  loginFuntion()
//Logout function
  attachSignoutEvents()

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
