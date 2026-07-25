import { supabase } from "../../supabase.js";

// ---------------------------------------------------------
// Flat, role-only capabilities.
// These map 1:1 to gates that already exist in workspace-admin.js /
// workspace-member.js today — this table doesn't add new restrictions,
// it just centralizes ones that were previously hardcoded per file
// (e.g. "member sees no Create API Key button", "admin has no
// Transfer Ownership card").
// ---------------------------------------------------------
export const PERMISSIONS = {
  owner: {
    transferOwnership: true,
    deleteWorkspace: true,
    createApiKey: true,
    assignTasks: true,
    pingAssignee: true,
    createTask: true,
  },
  admin: {
    transferOwnership: false,
    deleteWorkspace: false,
    createApiKey: true,
    assignTasks: true,
    pingAssignee: true,
    createTask: true,
  },
  member: {
    transferOwnership: false,
    deleteWorkspace: false,
    createApiKey: false,
    assignTasks: false,
    pingAssignee: false,
    createTask: true, // members can now create tasks too
  },
};

// ---------------------------------------------------------
// Member removal isn't a flat per-role capability — it depends on the
// target's role too (admin can remove members but not other admins/owners;
// owner can remove anyone except themselves). Same logic as the original
// canRemoveMember() in workspace-admin.js, relocated here so both pages
// share one implementation instead of workspace-member.js needing its own
// copy once it gains member-management UI.
// ---------------------------------------------------------
export function canRemoveMember(actorRole, targetRole, isSelf) {
  if (isSelf || targetRole === "owner") return false;
  if (actorRole === "owner") return true;
  if (actorRole === "admin" && targetRole === "member") return true;
  return false;
}

// ---------------------------------------------------------
// Deleting a task or discussion isn't role-gated at all — it's
// creator-or-owner: whoever created the item can delete it regardless of
// their role, and the workspace owner can delete anything as an override.
// An admin who didn't create the item cannot delete it. Same shape as
// canRemoveMember() above (relational, not a flat PERMISSIONS entry),
// and shared by both tasks (workspace_tasks.created_by) and discussions
// (discussions.created_by) since the rule is identical for both.
// ---------------------------------------------------------
export function canDeleteEntity(currentUserId, currentUserRole, creatorId) {
  if (currentUserRole === "owner") return true;
  return String(currentUserId) === String(creatorId);
}

// ---------------------------------------------------------
// Hides/shows sidebar nav items based on role, using a data-roles
// attribute convention: elements with data-roles="admin owner" only show
// for those roles; elements with no data-roles attribute show for everyone.
// This is what lets one merged sidebar.html serve admin/owner/member
// instead of needing separate sidebar-admin.html / sidebar-member.html
// files with hardcoded visibility per file.
// ---------------------------------------------------------
export function applySidebarRole(role) {
  document.querySelectorAll("[data-roles]").forEach((el) => {
    const allowedRoles = el.dataset.roles.split(" ");
    el.style.display = allowedRoles.includes(role) ? "" : "none";
  });
}

// ---------------------------------------------------------
// Looks up the current user's role within a given workspace's already-
// fetched workspace_members array (no extra Supabase call if you already
// have the workspace object loaded, which both pages do).
// ---------------------------------------------------------
export function getCurrentUserRole(workspace, userId) {
  const members = Array.isArray(workspace?.workspace_members)
    ? workspace.workspace_members
    : [workspace?.workspace_members].filter(Boolean);

  const me = members.find(
    (m) => m.user_id === userId || m.profiles?.id === userId,
  );

  return me?.role || null;
}

// ---------------------------------------------------------
// Replaces checkAdminAccess() / checkMemberAccess(). Queries the role
// directly (doesn't require the full workspace object to already be
// loaded, unlike getCurrentUserRole above) and redirects if the role
// isn't in allowedRoles. Returns the role on success so callers can use
// it immediately without a second lookup.
//
// Usage:
//   const role = await checkWorkspaceAccess(workspaceId, user, ["admin", "owner"]);
//   if (!role) return; // already redirected
// ---------------------------------------------------------
export async function checkWorkspaceAccess(workspaceId, user, allowedRoles) {
  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (error || !membership || !allowedRoles.includes(membership.role)) {
    return null;
  }

  return membership.role;
}
