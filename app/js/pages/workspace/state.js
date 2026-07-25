// -------------------------------------------------------------------
// Shared workspace state
// -------------------------------------------------------------------
// Every section module (tasks, members, documents, ...) needs to read
// the current workspace, the current user, the member list, or the
// current role. This used to live as bare module level variables in
// workspace.js. Now that the page is split across files, that state
// has to live in exactly one place so every module reads and writes
// the same values instead of holding stale copies.

let currentWorkspace = null;
let loadedMembers = [];
let user = null;
let currentUserRole = null; // "owner", "admin", "member"

export function getCurrentWorkspace() {
  return currentWorkspace;
}

export function setCurrentWorkspace(workspace) {
  currentWorkspace = workspace;
}

export function getLoadedMembers() {
  return loadedMembers;
}

export function setLoadedMembers(members) {
  loadedMembers = Array.isArray(members) ? members : [members];
}

export function getUser() {
  return user;
}

export function setUser(u) {
  user = u;
}

export function getCurrentUserRole() {
  return currentUserRole;
}

export function setCurrentUserRole(role) {
  currentUserRole = role;
}
