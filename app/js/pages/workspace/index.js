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
  currentWorkspace,
} from "./state.js";
import { renderSection } from "./render.js";
import { loadTasks, loadAssignedTasks } from "./tasks.js";

/**
 * Wait until the sidebar partial has been injected into the DOM.
 * app.js loads it asynchronously via loadComponent, so we must not
 * call navDropdowns() / attachSidebarEvents() before the nodes exist.
 */
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
  const { data: currentWorkspace, error } = await supabase
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

  workspace = currentWorkspace;

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

  // Default section: Tasks
  try {
    if (role === "member") {
      await renderSection("myTasks", currentWorkspace, container);
    } else if (role === "owner" || role === "admin") {
      await renderSection("createdTasks", currentWorkspace, container);
    }
  } catch (err) {
    console.error(err);
  }

  setLoading(false, container);

  // Sidebar is loaded async by app.js — wait for it, then wire events
  await waitForSidebar();
  attachSidebarEvents();
  navDropdowns(); // needs #navBtnDropdown to already exist

  // Modals that need workspace context — call AFTER setCurrentWorkspace
  openStartDiscussionModal(currentWorkspace, authData.user);

  if (role === "member") {
    openCreateTaskModal(currentWorkspace.id);
    openLogTaskModal(supabase, workspaceId, authData.user.id);
  } else {
    openCreateTaskModal(currentWorkspace.id);
    openAddMemeberModal(currentWorkspace.id);
  }

  // Nav click handler (shared). Ignore the Histories dropdown toggle itself.
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

    const content = getContentContainer();
    const section = btn.dataset.section;
    if (!section) return;

    setLoading(true, content);
    try {
      await new Promise(requestAnimationFrame);
      await renderSection(section, currentWorkspace, content);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false, content);
    }
  });
}

// Backwards-compatible aliases so existing HTML can keep working while you migrate
export const initAdminWorkspaceData = initWorkspaceDashboard;
export const initMemberWorkspaceData = initWorkspaceDashboard;
