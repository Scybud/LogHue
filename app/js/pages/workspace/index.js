import { attachSidebarEvents, navDropdowns } from "../../components/sidebar.js";
import {
  openCreateTaskModal,
  openAddMemeberModal,
  actionMsg,
  openStartDiscussionModal,
  openLogTaskModal,
} from "../../utils/modals.js";
import { supabase } from "../../supabase.js";
import {
  checkWorkspaceAccess,
  PERMISSIONS,
  applySidebarRole,
} from "../../shared/workspace/permissions.js";
import {
  setCurrentWorkspace,
  setLoadedMembers,
  setUser,
  setCurrentUserRole,
  getCurrentWorkspace,
} from "./state.js";
import { renderSection } from "./render.js";
import { loadTasks, loadAssignedTasks } from "./tasks.js";

let isLoading = false;

function setLoading(state, container) {
  isLoading = state;
  container?.classList.toggle("isLoading", state);
}

// -------------------------------------------------------------------
// Role based access, checks membership, sets currentUserRole
// -------------------------------------------------------------------
async function ensureWorkspaceAccess(workspaceId, user) {
  const role = await checkWorkspaceAccess(workspaceId, user, [
    "owner",
    "admin",
    "member",
  ]);
  if (!role) {
    actionMsg("You are not a member of this workspace.", "error");
    window.location.href = "all-workspaces";
    return null;
  }
  return role;
}

await initWorkspaceData()
// -------------------------------------------------------------------
// INITIALISATION, single entry point for all roles
// -------------------------------------------------------------------
export async function initWorkspaceData() {
  const params = new URLSearchParams(window.location.search);
  const workspaceId = params.get("ws");

  const { data, userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    console.error(userError);
    return;
  }
  setUser(data.user);
  const user = data.user;

  if (!workspaceId) {
    window.location.href = "dashboard";
    return;
  }

  // 1. Determine role and stop if not a member
  const currentUserRole = await ensureWorkspaceAccess(workspaceId, user);
  if (!currentUserRole) return; // already redirected
  setCurrentUserRole(currentUserRole);

  const container = document.getElementById("workspaceDashboardContent");
  setLoading(true, container);

  // 2. Now that sidebar DOM is present, apply role based visibility
  applySidebarRole(currentUserRole);

  // 3. Attach sidebar events (dropdowns, etc.)
  attachSidebarEvents();
  navDropdowns();

  // 4. Fetch workspace data
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      `*, workspace_tasks(*, profiles:assigned_to (id, full_name, avatar_url)), workspace_members(role, profiles (id, full_name, avatar_url, plan:plan_id (name)))`,
    )
    .eq("id", workspaceId)
    .single();

  if (error || !workspace) {
    console.error(error);
    actionMsg(workspace ? error.message : "Workspace not found.", "error");
    setLoading(false, container);
    return;
  }

  if (workspace.status === "closed") {
    actionMsg("This workspace has been archived.", "warning");
    setTimeout(() => (window.location.href = "archive"), 1500);
    return;
  }

  workspace.workspace_tasks = workspace.workspace_tasks || [];
  workspace.workspace_members = workspace.workspace_members || [];
  setCurrentWorkspace(workspace);
  setLoadedMembers(workspace.workspace_members);

  // Page title & name
  document.title = workspace.name + " | LogHue";
  const workspaceNameEl = document.getElementById("workspaceName");
  if (workspaceNameEl) workspaceNameEl.textContent = workspace.name;

  // 5. Initial section content
  if (container) container.innerHTML = "";
  const myPermissions = PERMISSIONS[currentUserRole] || {};
  if (currentUserRole === "member") {
    const myTasks = workspace.workspace_tasks
      .filter((t) => String(t.assigned_to) === String(user.id))
      .filter((t) => t.status === "in progress");
    loadAssignedTasks("My Tasks", myTasks, container);
  } else {
    const tasks = workspace.workspace_tasks.filter(
      (t) => t.status === "in progress",
    );
    loadTasks("Created Tasks", tasks, container);
  }

  setLoading(false, container);

  // 6. Open modals based on permissions
  openStartDiscussionModal(getCurrentWorkspace(), user);

  if (myPermissions.createTask) {
    openCreateTaskModal(getCurrentWorkspace().id);
  }
  if (myPermissions.inviteMembers || myPermissions.manageMembers) {
    openAddMemeberModal(getCurrentWorkspace().id);
  }
  if (currentUserRole === "member") {
    openLogTaskModal(supabase, workspaceId, user.id);
  }
}

// -------------------------------------------------------------------
// Navigation handler, renderSection covers all roles
// -------------------------------------------------------------------
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".navBtn");
  if (!btn) return;

  const container = document.getElementById("workspaceDashboardContent");
  const section = btn.dataset.section;
  setLoading(true, container);
  try {
    await new Promise(requestAnimationFrame);
    await renderSection(section, getCurrentWorkspace(), container);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false, container);
  }
});

// -------------------------------------------------------------------
// Backward compatible re-exports
// -------------------------------------------------------------------
// Anything elsewhere in the app that used to do
//   import { loadTasks, loadDiscussions, currentWorkspace } from "../pages/workspace.js"
// needs to be found and updated. Function re-exports below work as is.
// currentWorkspace and loadedMembers do NOT work as drop in replacements,
// since they used to be live `export let` bindings and are now functions.
// Grep the codebase for these two names imported from the old path.
export { loadTasks, loadAssignedTasks, loadAllTasks } from "./tasks.js";
export { loadDiscussions } from "./discussions.js";
export { loadActivities } from "./activities.js";
export { createWorkspaceInvite } from "./invites.js";
