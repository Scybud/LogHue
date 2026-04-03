import { formatDateTime } from "../features/workspaceData.js";
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
  if (!receiverUserId) return;

  // 1. Create in-app notification
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

  // 2. Trigger push notification
  await supabase.functions.invoke("trigger-push", {
    body: {
      receiver_user_id: receiverUserId,
      workspace_id: workspaceId,
      type,
      entity_id: entityId,
      entity_type: entityType,
    },
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

const unreadCount = notifications.filter((n) => n.is_read === false).length;

  const notifBadge = document.getElementById("notifBadge")

  if(notifBadge) {
     notifBadge.textContent = unreadCount;
   }

  for (const notif of notifications) {
    const notifEl = document.createElement("li");
    notifEl.classList.add("notificationsItem", "notification-card");

    if (!notif.is_read) notifEl.classList.add("unread"); // highlight unread

    if (notif.type === "task_assigned") {
      let task = null;

      try {
        const { data } = await supabase
        .from("workspace_tasks")
        .select("title")
        .eq("id", notif.entity_id)
        .single();

        task = data;
      } catch (e) {
        task = null;
      }

      notif.task = task;
    }

    if (notif.type === "discussion_started") {
      let discussion = null;

      try {
        const { data } = await supabase
        .from("discussions")
        .select("title")
        .eq("id", notif.entity_id)
        .single();

        discussion = data;
      } catch (e) {

        discussion = null;
      }

        notif.discussion = discussion;
    }
      
    const time = formatDateTime(notif.created_at)

    // Customize text based on type
    let text = "";
    switch (notif.type) {
      case "task_assigned":
        const taskTitle = notif.task?.title || (notif.task === null ? "a deleted task" : "a task");
        text = `<a href="task-view?task=${notif.entity_id}"><b>${notif.actor.full_name}</b> assigned you to "${taskTitle || "Loading..."}" in workspace "${notif.workspace?.name}" <span class="timestamp">${time}</span></a>`;
        break;

      case "discussion_started":
              const discussionTitle =
                notif.discussion?.title ||
                (notif.discussion === null
                  ? "a deleted discussion"
                  : "a discussion");
        text = `<a href="discussion-view?dcn=${notif.entity_id}"><b>${notif.actor.full_name}</b> started a discussion "${discussionTitle || "Loading..."}" in workspace "${notif.workspace?.name}" <span class="timestamp">${time}</span></a>`;
        break;

      default:
        text = `New notification: ${notif.type}`;
    }
    notifEl.innerHTML = text;
    container.append(notifEl);

    notifEl.addEventListener("click", async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notif.id);

      if (error) console.error("Failed to mark as read:", error);
      
      // Update the local notifications array
      notif.is_read = true;
      notifEl.classList.remove("unread")
      const unreadCount = notifications.filter((n) => n.is_read === false).length;
      if (notifBadge) {
         notifBadge.textContent = unreadCount;
      }
   });
  }
}
