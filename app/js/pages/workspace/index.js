import { attachSidebarEvents, navDropdowns } from "../../components/sidebar.js";
import { supabase } from "../../supabase.js";
import {
  openCreateTaskModal,
  openAddMemeberModal,
  openStartDiscussionModal,
  openLogTaskModal,
  actionMsg,
} from "../../utils/modals.js";
import {
  setCurrentWorkspace,
  setLoadedMembers,
  setUser,
  setCurrentRole,
  setLoading,
  fetchMembershipRole,
  getContentContainer,
  currentRole,
} from "./state.js";
import { renderSection } from "./render.js";

// Wait until the sidebar partial has been injected into the DOM.

export let workspace = null;

function waitForSidebar(timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (
      document.getElementById("navBtnDropdown") ||
      document.getElementById("sidebar")
    ) {
      resolve();
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      if (
        document.getElementById("navBtnDropdown") ||
        document.getElementById("sidebar") ||
        Date.now() - start > timeoutMs
      ) {
        clearInterval(id);
        resolve();
      }
    }, 50);
  });
}

//  ROUTING HELPERS

function getSectionFromUrl() {
  return new URLSearchParams(window.location.search).get("section");
}

function setSectionInUrl(section, { replace = false } = {}) {
  const params = new URLSearchParams(window.location.search);
  params.set("section", section);
  const url = `${window.location.pathname}?${params.toString()}`;

  if (replace) {
    history.replaceState({ section }, "", url);
  } else {
    history.pushState({ section }, "", url);
  }
}

function setActiveNav(section) {
  document.querySelectorAll(".navBtn[data-section]").forEach((btn) => {
    btn.classList.remove("active");
  });

  const activeBtn = document.querySelector(
    `.navBtn[data-section="${section}"]`,
  );
  if (activeBtn) {
    activeBtn.classList.add("active");
  }
}

async function navigateToSection(
  section,
  workspace,
  container,
  { push = true } = {},
) {
  if (!section || !container) return;

  setLoading(true, container);

  try {
    await new Promise(requestAnimationFrame);
    await renderSection(section, workspace, container);
    setActiveNav(section);

    if (push) {
      setSectionInUrl(section);
    }
  } catch (err) {
    console.error("Failed to navigate to section:", section, err);
  } finally {
    setLoading(false, container);
  }
}

//  MAIN ENTRY POINT

/**
 * Single entry point for both admin/owner and member workspace dashboards.
 * Detects the caller's role and initialises the appropriate UI.
 */
export async function initWorkspaceDashboard() {
  const params = new URLSearchParams(window.location.search);
  const workspaceId = params.get("ws");

  if (!workspaceId) {
    window.location.href = "dashboard";
    return;
  }

  // Auth
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    console.error(authError);
    return;
  }
  setUser(authData.user);

  // Role
  const role = await fetchMembershipRole(workspaceId, authData.user.id);
  if (!role) {
    actionMsg(
      "Access Denied: You are not a member of this workspace.",
      "error",
    );
    window.location.href = "my-workspaces";
    return;
  }
  setCurrentRole(role);
  // Drives CSS visibility for .adminOnly / .memberOnly in the unified sidebar
  document.body.dataset.role = role;

  if (role !== "member" && role !== "owner" && role !== "admin") {
    actionMsg("Access Denied.", "error");
    window.location.href = "my-workspaces";
    return;
  }

  const container = getContentContainer();
  setLoading(true, container);

  // Load workspace + related data
  const { data: currentWorkspaceData, error } = await supabase
    .from("workspaces")
    .select(
      `*,
       workspace_tasks(*, profiles:assigned_to (id, full_name, avatar_url)),
       workspace_members(role, profiles (id, full_name, avatar_url, plan:plan_id (name)))`,
    )
    .eq("id", workspaceId)
    .single();

  if (error) {
    console.error(error);
    actionMsg(error.message || "Failed to load workspace", "error");
    setLoading(false, container);
    return;
  }

  workspace = currentWorkspaceData;

  if (!workspace || workspaceId.length < 10 || workspace.status === "closed") {
    actionMsg("This workspace has been archived", "warning");
    setTimeout(() => {
      window.location.href = "archive";
    }, 1500);
    return;
  }

  // Must be set BEFORE any modal wiring that reads currentWorkspace
  setCurrentWorkspace(workspace);
  workspace.workspace_tasks = workspace.workspace_tasks || [];

  const members = Array.isArray(workspace.workspace_members)
    ? workspace.workspace_members
    : [workspace.workspace_members];
  setLoadedMembers(members);

  // Header
  const workspaceNameEl = document.getElementById("workspaceName");
  if (workspaceNameEl) workspaceNameEl.textContent = workspace.name;
  document.title = `${workspace.name} | LogHue`;

  if (container) container.innerHTML = "";

  //  ROUTING: decide & render initial section 
  let initialSection = getSectionFromUrl();

  if (!initialSection) {
    initialSection = role === "member" ? "myTasks" : "createdTasks";
    setSectionInUrl(initialSection, { replace: true });
  }

  try {
    await navigateToSection(initialSection, workspace, container, {
      push: false,
    });
  } catch (err) {
    console.error(err);
  }

  setLoading(false, container);

  // Sidebar is loaded async by app.js — wait for it, then wire events
  await waitForSidebar();
  attachSidebarEvents();
  navDropdowns(); 

  // Modals that need workspace context — call AFTER setCurrentWorkspace
  openStartDiscussionModal(workspace, authData.user);

  if (role === "member") {
    openCreateTaskModal(workspace.id);
    openLogTaskModal(supabase, workspaceId, authData.user.id);
  } else {
    openCreateTaskModal(workspace.id);
    openAddMemeberModal(workspace.id);
  }

  //  NAV CLICK HANDLER 
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".navBtn");
    if (!btn) return;

    // Don't treat the dropdown toggle as a section navigation
    if (
      btn.classList.contains("navBtnDropdown") ||
      btn.id === "navBtnDropdown"
    ) {
      return;
    }

    const section = btn.dataset.section;
    if (!section) return;

    // Already on this section → do nothing
    if (getSectionFromUrl() === section) return;

    await navigateToSection(section, workspace, getContentContainer());
  });

  //  BROWSER BACK / FORWARD 
  window.addEventListener("popstate", async () => {
    const section =
      getSectionFromUrl() ||
      (currentRole === "member" ? "myTasks" : "createdTasks");

    await navigateToSection(section, workspace, getContentContainer(), {
      push: false,
    });
  });
}

// Backwards-compatible aliases so existing HTML can keep working while you migrate
export const initAdminWorkspaceData = initWorkspaceDashboard;
export const initMemberWorkspaceData = initWorkspaceDashboard;
