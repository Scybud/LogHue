import { supabase } from "../supabase";
import { actionMsg } from "./modals";

export async function attachNotification(
  workspaceId = null,
  workspaceMemberId = null,
  userId,
  notificationType,
  entityId = null,
  entityType = null,
) {
  if (!userId || !notificationType) {
    return actionMsg("Invalid notification data", "error");
  }

  const payload = {
    actor_id: userId,
    type: notificationType,
    entity_id: entityId,
    entity_type: entityType,
    workspace_member_id: workspaceMemberId,
    workspace_id: workspaceId,
    user_id: receiverUserId,
  };
  const { data, error } = await supabase.from("notifications").insert(payload).select().single();

  if (error) {
       console.error(error);
    actionMsg("Something went wrong", "error");
    return;
  }
  return data;
}