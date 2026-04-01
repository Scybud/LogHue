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
  // Get current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Fetch notifications where actor is NOT the user
  const { data, error } = await supabase
    .from("notifications")
    .select(
      `
      *,
      workspace_members!inner(user_id)
    `,
    )
    .eq("workspace_members.user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }

  return data || [];
}

//RENDER NOTIFICATIONS
export function renderGlobalNotifications(notifications) {
  const container = document.getElementById("notificationsList");
  if (!container) return;

  container.innerHTML = ""; // clear old

  if (notifications.length === 0) {
    container.innerHTML = `<p class="placeholderText">Nothing here yet.</p>`;
    return;
  }

  notifications.forEach((notif) => {
    const notifEl = document.createElement("li");
    notifEl.classList.add("notificationsItem", "notification-card");

    // Customize text based on type
    let text = "";
    switch (notif.type) {
      case "task_assigned":
        text = `You were assigned to task "${notif.entity_id}"`;
        break;
      case "discussion_created":
        text = `New discussion started in a workspace`;
        break;
      default:
        text = `New notification: ${notif.type}`;
    }

    notifEl.textContent = text;
    container.append(notifEl);
  });
}

