import { supabase } from "../supabase.js";
import { actionMsg } from "./modals.js";

//FOR ALL USERS IN A WORKSPACE
export async function notifyWorkspace({
  workspaceId,
  actorId,
  type,
  entityId,
  entityType,
}) {
  const { data: members } = await supabase
    .from("workspace_members")
    .select("id, user_id")
    .eq("workspace_id", workspaceId);

  const notifications = members
    .filter((m) => m.user_id !== actorId) // don't notify self
    .map((member) => ({
      workspace_id: workspaceId,
      workspace_member_id: member.id,
      actor_id: actorId,
      type,
      entity_id: entityId,
      entity_type: entityType,
    }));

  if (notifications.length > 0) {
    await supabase.from("notifications").insert(notifications);
  }
}

//FOR SPECIFIC USERS
export async function notifyUser({
  workspaceId,
  receiverUserId,
  actorId,
  type,
  entityId,
  entityType,
}) {
  if (!receiverUserId) {
    console.error("notifyUser called without receiverUserId");
    return;
  }
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", receiverUserId)
    .single();

  if (!member) return;

  await supabase.from("notifications").insert({
    workspace_id: workspaceId,
    workspace_member_id: member.id,
    actor_id: actorId,
    type,
    entity_id: entityId,
    entity_type: entityType,
  });
}

//FETCH NOTIFICATIONS FROM DB
export async function fetchNotificationsForUser() {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data?.user) return [];

  const user = data.user;

  const { data: notifications, error } = await supabase
    .from("notifications")
    .select(
      `
      *,
      actor:profiles(full_name),
      workspace:workspaces(name),
      workspace_members!inner(user_id)
    `,
    )
    .eq("workspace_members.user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }

  return Array.isArray(notifications) ? notifications : [notifications];
}


//RENDER NOTIFICATIONS
export async function renderGlobalNotifications(notifications) {
  const container = document.getElementById("notificationsList");
  if (!container) return;

  container.innerHTML = ""; // clear old

  if (!Array.isArray(notifications) || notifications.length === 0) {
    container.innerHTML = `<p class="placeholderText">Nothing here yet.</p>`;
    return;
  }

  for (const notif of notifications) {
    const notifEl = document.createElement("li");
    notifEl.classList.add("notificationsItem", "notification-card");

    if (notif.type === "task_assigned") {
  const { data: task } = await supabase
    .from("workspace_tasks")
    .select("title")
    .eq("id", notif.entity_id)
    .single();
  notif.task = task;
}

if (notif.type === "discussion_created") {
  const { data: discussion } = await supabase
    .from("workspace_discussions")
    .select("title")
    .eq("id", notif.entity_id)
    .single();
  notif.discussion = discussion;
}

    // Customize text based on type
    let text = "";
switch (notif.type) {
  case "task_assigned":
    text = `<b>${notif.actor.full_name}</b> assigned you to task "${notif.task?.title || "Loading..."}" in workspace "${notif.workspace?.name}"`;
    break;

  case "discussion_created":
    text = `${notif.actor.full_name} started a discussion "${notif.discussion?.title || 'Loading...'}" in workspace "${notif.workspace?.name}"`;
    break;

  default:
    text = `New notification: ${notif.type}`;
}
    notifEl.innerHTML = text;
    container.append(notifEl);
  
}
}
