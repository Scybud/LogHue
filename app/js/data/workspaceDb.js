import { supabase } from "../supabase.js"; // Adjust the relative path to your client if needed
import { actionMsg } from "../utils/modals.js";

/**
 * Fetches all workspaces where the logged-in user is a member,
 * enriched with pre-aggregated statistics from the SQL View.
 * * @param {string} userId - The active user's UUID
 * @returns {Promise<Array>} Array of unified workspace objects with roles and counts
 */
export async function fetchUserWorkspaces(userId) {
  if (!userId) return [];

  try {
    // Fetch aggregated data and membership maps in parallel
    const [viewResponse, membershipResponse] = await Promise.all([
      supabase.from("workspace_card_view").select("*"),
      supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", userId),
    ]);

    if (viewResponse.error) throw viewResponse.error;
    if (membershipResponse.error) throw membershipResponse.error;

    // Create a fast-lookup map for membership roles
    const roleMap = new Map(
      membershipResponse.data.map((m) => [m.workspace_id, m.role]),
    );

    // Streamline: Only return workspaces the user actually belongs to
    return viewResponse.data
      .filter((ws) => roleMap.has(ws.id))
      .map((ws) => ({
        ...ws,
        role: roleMap.get(ws.id),
      }));
  } catch (error) {
    console.error("CRITICAL: Error in fetchUserWorkspaces:", error.message);
    throw error;
  }
}

/**
 * Aggregates all non-completed tasks explicitly assigned to the user
 * across every single workspace they are a part of.
 * * @param {string} userId - The active user's UUID
 * @returns {Promise<Array>} List of open tasks paired with their parent workspace name
 */
export async function fetchUserGlobalTasks(userId) {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from("workspace_tasks")
      .select(
        `
        id,
        title,
        status,
        workspace:workspace_id (
          name
        )
      `,
      )
      .eq("assigned_to", userId)
      .neq("status", "completed"); // Subtract completed tasks immediately

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("CRITICAL: Error in fetchUserGlobalTasks:", error.message);
    throw error;
  }
}

export async function fetchWorkspaceFromMember(userId) {
  const { data: workspaces, error } =
      await supabase
        .from("workspace_members")
        .select(
          `
    role,
    workspaces: workspace_id (
      id,
      name
    )
  `,)
        .eq("user_id", userId);

        if(error) {
          actionMsg("Error loading workspaces", "error");
          return;
        }

        return workspaces;
}