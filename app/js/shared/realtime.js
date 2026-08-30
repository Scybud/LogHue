import { supabase } from "../supabase.js";

/**
 * One realtime channel per workspace covering discussions,
 * discussion_comments and discussion_comment_comments. Callers filter
 * client-side for the specific discussion they have open.
 *
 * @param {string} workspaceId
 * @param {object} handlers
 * @param {(row:object)=>void} [handlers.onDiscussionInsert]
 * @param {(row:object)=>void} [handlers.onDiscussionUpdate]
 * @param {(row:object)=>void} [handlers.onCommentInsert]
 * @param {(row:object)=>void} [handlers.onCommentUpdate]
 * @param {(row:object)=>void} [handlers.onCommentDelete]
 * @param {(row:object)=>void} [handlers.onReplyInsert]
 * @param {(row:object)=>void} [handlers.onReplyUpdate]
 * @param {(row:object)=>void} [handlers.onReplyDelete]
 * @returns {import("@supabase/supabase-js").RealtimeChannel}
 */
export function subscribeWorkspaceChannel(workspaceId, handlers = {}) {
  const channel = supabase
    .channel(`workspace-${workspaceId}-discussions`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "discussions",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => handlers.onDiscussionInsert?.(payload.new),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "discussions",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => handlers.onDiscussionUpdate?.(payload.new),
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "discussion_comments",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => handlers.onCommentInsert?.(payload.new),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "discussion_comments",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => handlers.onCommentUpdate?.(payload.new),
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "discussion_comments",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => handlers.onCommentDelete?.(payload.old),
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "discussion_comment_comments",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => handlers.onReplyInsert?.(payload.new),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "discussion_comment_comments",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => handlers.onReplyUpdate?.(payload.new),
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "discussion_comment_comments",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => handlers.onReplyDelete?.(payload.old),
    )
    .subscribe();

  return channel;
}

export function unsubscribeChannel(channel) {
  if (channel) supabase.removeChannel(channel);
}
