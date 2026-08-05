import { formatDateTimeRelatively } from "./time.js";
import { supabase } from "../supabase.js";
import { actionMsg } from "./modals.js";

const PAGE_SIZE = 10;

let currentOffset = 0;
let isLoadingMore = false;
let hasMoreNotifications = true;

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

//FETCH A PAGE OF NOTIFICATIONS FROM DB
export async function fetchNotificationsForUser(offset = 0, limit = PAGE_SIZE) {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data?.user) return { notifications: [], hasMore: false };

  const user = data.user;

  const { data: notifications, error } = await supabase
    .from("notifications")
    .select(
      `
      *,
      actor:profiles(full_name, avatar_url),
      workspace:workspaces(name),
      workspace_members!inner(user_id)
    `,
    )
    .eq("workspace_members.user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching notifications:", error);
    return { notifications: [], hasMore: false };
  }

  const list = Array.isArray(notifications) ? notifications : [notifications];

  // a full page back means there might be more, next fetch confirms it
  const hasMore = list.length === limit;

  return { notifications: list, hasMore };
}

//FETCH UNREAD COUNT INDEPENDENTLY OF PAGINATION
async function fetchUnreadNotificationCount() {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data?.user) return 0;

  const user = data.user;

  const { count, error } = await supabase
    .from("notifications")
    .select("id, workspace_members!inner(user_id)", {
      count: "exact",
      head: true,
    })
    .eq("workspace_members.user_id", user.id)
    .eq("is_read", false);

  if (error) {
    console.error("Error fetching unread count:", error);
    return 0;
  }

  return count || 0;
}

function updateBadge(count) {
  const notifBadge = document.getElementById("notifBadge");
  if (!notifBadge) return;

  if (count <= 0) {
    notifBadge.remove();
    return;
  }

  notifBadge.textContent = count;
}

//RENDER NOTIFICATIONS (INITIAL LOAD, CLEARS CONTAINER)
export async function renderGlobalNotifications(
  notifications,
  hasMore = false,
) {
  const container = document.getElementById("notificationsList");
  if (!container) return;

  container.innerHTML = "";

  currentOffset = notifications.length;
  hasMoreNotifications = hasMore;

  if (!Array.isArray(notifications) || notifications.length === 0) {
    container.innerHTML = `<p class="placeholderText">Nothing here yet.</p>`;
    return;
  }

  const unreadCount = await fetchUnreadNotificationCount();
  updateBadge(unreadCount);

  for (const notif of notifications) {
    const notifEl = await buildNotificationItem(notif);
    container.append(notifEl);
  }

  renderLoadMoreButton(container);
}

//BUILD A SINGLE NOTIFICATION ROW (SHARED BY INITIAL RENDER AND LOAD MORE)
async function buildNotificationItem(notif) {
  const notifEl = document.createElement("li");
  notifEl.classList.add("notificationsItem", "notification-card");

  if (!notif.is_read) notifEl.classList.add("unread");

  if (notif.type === "task_assigned") {
    let task = null;
    try {
      const { data } = await supabase
        .from("workspace_tasks")
        .select("title")
        .eq("id", notif.entity_id)
        .maybeSingle();
      task = data;
    } catch (e) {
      task = null;
      console.log(e);
    }
    notif.task = task;
  }
  if (notif.type === "task_ping") {
    let task = null;
    try {
      const { data } = await supabase
        .from("workspace_tasks")
        .select("title")
        .eq("id", notif.entity_id)
        .maybeSingle();
      task = data;
    } catch (e) {
      task = null;
    }
    notif.task = task;
  }

  if (notif.type === "task_logged") {
    let task = null;
    try {
      const { data: log } = await supabase
        .from("workspace_task_logs")
        .select("task_id, workspace_tasks:task_id (title)")
        .eq("id", notif.entity_id)
        .maybeSingle();
      task = log?.workspace_tasks
        ? { id: log.task_id, title: log.workspace_tasks.title }
        : null;
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
        .maybeSingle();
      discussion = data;
    } catch (e) {
      discussion = null;
    }
    notif.discussion = discussion;
  }

  const time = formatDateTimeRelatively(notif.created_at);

  const link = document.createElement("a");
  link.className = "notificationLink";
  if (notif.type === "task_assigned" || notif.type === "task_ping") {
    link.href = `task-view?task=${encodeURIComponent(notif.entity_id)}`;
  } else if (notif.type === "discussion_started") {
    link.href = `discussion-view?dcn=${encodeURIComponent(notif.entity_id)}`;
  } else if (notif.type === "task_logged") {
    if (notif.task?.id) {
      link.href = `task-view?task=${encodeURIComponent(notif.task.id)}#${encodeURIComponent(notif.entity_id)}`;
    } else {
      link.href = "#";
    }
  }

  const actorAvatar = document.createElement("img");
  actorAvatar.classList.add("profileAvatar");
  actorAvatar.src =
    notif.actor.avatar_url ||
    "https://loghue.com/assets/images/default_profile.png";
  link.appendChild(actorAvatar);

  const actorName = notif.actor.full_name || "Someone";

  let bodyTextContent = document.createElement("p");

  if (notif.type === "task_assigned") {
    bodyTextContent.textContent = `${actorName} assigned you to "${notif.task?.title || (notif.task === null ? "a deleted task" : "a task")}" in workspace "${notif.workspace?.name || "Unknown Workspace"}" `;
  } else if (notif.type === "task_ping") {
    bodyTextContent.textContent = `${actorName} pinged you on "${notif.task?.title || (notif.task === null ? "a deleted task" : "a task")}" in workspace "${notif.workspace?.name || "Unknown Workspace"}". Log an update now!`;
  } else if (notif.type === "discussion_started") {
    bodyTextContent.textContent = `${actorName} started a discussion "${notif.discussion?.title || (notif.discussion === null ? "a deleted discussion" : "a discussion")}" in workspace "${notif.workspace?.name || "Unknown Workspace"}" `;
  } else if (notif.type === "task_logged") {
    bodyTextContent.textContent = `${actorName} logged progress on "${notif.task?.title || (notif.task === null ? "a deleted task" : "a task")}" in workspace "${notif.workspace?.name || "Unknown Workspace"}" `;
  } else {
    bodyTextContent.textContent = ` ${notif.type}`;
  }

  link.appendChild(bodyTextContent);

  const timeSpan = document.createElement("span");
  timeSpan.className = "timestamp";
  timeSpan.textContent = time;
  link.appendChild(timeSpan);

  if (
    notif.type === "task_assigned" ||
    notif.type === "discussion_started" ||
    notif.type === "task_logged" ||
    notif.type === "task_ping"
  ) {
    notifEl.appendChild(link);
  } else {
    notifEl.textContent = `New notification: ${notif.type}`;
  }

  notifEl.addEventListener("click", async () => {
    if (notif.is_read) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notif.id);

    if (error) {
      console.error("Failed to mark as read:", error);
      return;
    }

    notif.is_read = true;
    notifEl.classList.remove("unread");

    const notifBadge = document.getElementById("notifBadge");
    if (notifBadge) {
      const remaining = Math.max(0, (Number(notifBadge.textContent) || 0) - 1);
      updateBadge(remaining);
    }
  });

  return notifEl;
}

//RENDER OR REMOVE THE LOAD MORE BUTTON
function renderLoadMoreButton(container) {
  const existing = document.getElementById("notificationsLoadMore");
  if (existing) existing.remove();

  if (!hasMoreNotifications) return;

  const wrapper = document.createElement("li");
  wrapper.id = "notificationsLoadMore";
  wrapper.classList.add("notificationsLoadMoreWrapper");

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("notificationsLoadMoreBtn");
  button.textContent = "Load more";

  button.addEventListener("click", () =>
    handleLoadMoreClick(container, button),
  );

  wrapper.appendChild(button);
  container.appendChild(wrapper);
}

async function handleLoadMoreClick(container, button) {
  if (isLoadingMore || !hasMoreNotifications) return;

  isLoadingMore = true;
  button.disabled = true;
  button.textContent = "Loading...";

  try {
    const { notifications, hasMore } = await fetchNotificationsForUser(
      currentOffset,
      PAGE_SIZE,
    );

    currentOffset += notifications.length;
    hasMoreNotifications = hasMore;

    const loadMoreWrapper = document.getElementById("notificationsLoadMore");

    for (const notif of notifications) {
      const notifEl = await buildNotificationItem(notif);
      if (loadMoreWrapper) {
        container.insertBefore(notifEl, loadMoreWrapper);
      } else {
        container.appendChild(notifEl);
      }
    }

    renderLoadMoreButton(container);
  } finally {
    isLoadingMore = false;
  }
}
