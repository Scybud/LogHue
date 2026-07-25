import { supabase } from "../../supabase.js";
import { PERMISSIONS } from "../../shared/workspace/permissions.js";
import { getCurrentUserRole, getUser, setLoadedMembers } from "./state.js";
import { loadTasks, loadAssignedTasks, loadAllTasks } from "./tasks.js";
import { loadMembers } from "./members.js";
import { loadDocuments } from "./documents.js";
import { loadActivities } from "./activities.js";
import { loadDiscussions } from "./discussions.js";
import { loadInviteHistory } from "./invites.js";
import { loadSettings } from "./settings.js";

// -------------------------------------------------------------------
// renderSection: handles every section, gated by permissions
// -------------------------------------------------------------------
export async function renderSection(section, workspace, container) {
  if (!workspace || !container) return;
  container.innerHTML = "";

  // Safely get tasks array, never null
  const allTasks = Array.isArray(workspace.workspace_tasks)
    ? workspace.workspace_tasks
    : [];

  // Fetch discussions (shared by many sections)
  const { data: allDiscussions } = await supabase
    .from("discussions")
    .select(`*, profiles:created_by (full_name, avatar_url)`)
    .eq("workspace_id", workspace.id);

  const currentUserRole = getCurrentUserRole();
  const user = getUser();
  const myPermissions = PERMISSIONS[currentUserRole] || {};

  switch (section) {
    // ----- Admin / owner sections -----
    case "createdTasks":
      loadTasks(
        "Created Tasks",
        allTasks.filter((t) => t.status === "in progress"),
        container,
      );
      break;

    case "members": {
      setLoadedMembers(workspace.workspace_members);
      loadMembers(workspace.workspace_members, container);
      break;
    }

    case "documents": {
      const { data: docs } = await supabase
        .from("workspace_documents")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });
      await loadDocuments(docs || [], container, workspace);
      break;
    }

    case "activities": {
      const { data: logs } = await supabase
        .from("workspace_task_logs")
        .select(
          `*, profiles:created_by (full_name, avatar_url), workspace_tasks:task_id (title)`,
        )
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });
      const { data: actDcns } = await supabase
        .from("discussions")
        .select(`*, profiles:created_by (full_name, avatar_url)`)
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      const normalizedLogs = (logs || []).map((log) => ({
        id: log.id,
        task_id: log.task_id,
        type: "task_log",
        actor: log.profiles,
        title: log.workspace_tasks?.title,
        note: log.log_note,
        status: log.task_status,
        created_at: log.created_at,
      }));
      const normalizedDiscussions = (actDcns || []).map((d) => ({
        id: d.id,
        type: "discussion",
        actor: d.profiles,
        title: d.title,
        note: d.content,
        status: null,
        created_at: d.created_at,
      }));
      const activities = [...normalizedLogs, ...normalizedDiscussions].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
      loadActivities(activities, container);
      break;
    }

    case "discussions":
      await loadDiscussions(
        "Discussions",
        allDiscussions?.filter((d) => d.status === "open") || [],
        container,
      );
      break;

    case "inviteHistory": {
      if (myPermissions.inviteMembers) {
        const { data: inviteHistory } = await supabase
          .from("workspace_invites")
          .select("*")
          .eq("workspace_id", workspace.id);
        loadInviteHistory(inviteHistory || [], container);
      } else {
        container.innerHTML = `<p class="placeholderText">You don't have permission to view invite history.</p>`;
      }
      break;
    }

    case "taskHistory":
      loadTasks(
        "Tasks History",
        allTasks.filter((t) => t.status === "completed"),
        container,
      );
      break;

    case "discussionHistory":
      await loadDiscussions(
        "Discussions History",
        allDiscussions?.filter((d) => d.status === "closed") || [],
        container,
      );
      break;

    case "settings":
      await loadSettings(container, workspace, user.id);
      break;

    // ----- Member specific sections -----
    case "myTasks": {
      const myTasks = allTasks
        .filter((t) => String(t.assigned_to) === String(user.id))
        .filter((t) => t.status === "in progress");
      loadAssignedTasks("My Tasks", myTasks, container);
      break;
    }

    case "allTasks":
      loadAllTasks(allTasks, container);
      break;

    default:
      container.innerHTML = `<p class="placeholderText">Section not found.</p>`;
  }
}
