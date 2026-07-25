import { supabase } from "../../supabase.js";

/** Shared workspace dashboard state */
export let currentWorkspace = null;
export let loadedMembers = [];
export let user = null;
export let currentRole = null; // "owner" | "admin" | "member"
export let isLoading = false;

/** Module-level assign-task state (used by tasks.js) */
export let selectedAssigneeId = null;
export let taskIdToAssign = null;

export function setSelectedAssigneeId(id) {
  selectedAssigneeId = id;
}
export function setTaskIdToAssign(id) {
  taskIdToAssign = id;
}

export function setCurrentWorkspace(ws) {
  currentWorkspace = ws;
}

export function setLoadedMembers(members) {
  loadedMembers = Array.isArray(members) ? members : members ? [members] : [];
}

export function setUser(u) {
  user = u;
}

export function setCurrentRole(role) {
  currentRole = role;
}

export function setLoading(state, container) {
  isLoading = state;
  container?.classList.toggle("isLoading", state);
}

/**
 * Fetch the current user's membership role for a workspace.
 * Returns "owner" | "admin" | "member" | null
 */
export async function fetchMembershipRole(workspaceId, userId) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data.role;
}

/**
 * Resolve the content container depending on role / page.
 * Falls back to either known id.
 */
export function getContentContainer() {
  return (
    document.getElementById("workspaceDashboardContent") ||
    document.getElementById("memberWorkspaceDashboardContent")
  );
}
