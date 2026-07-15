import { supabase } from "../supabase.js";
import { actionMsg } from "../utils/modals.js";

export async function fetchUserTasks(userId) {
    const { data: tasks, error } = await supabase
      .from("workspace_tasks")
      .select("id, title")
      .eq("assigned_to", userId)

      if(error) {
        actionMsg("Error loading tasks", "error");
        return
      }
      return tasks;
}