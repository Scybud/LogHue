import { supabase } from "../../supabase.js";
import { actionMsg } from "../../utils/modals.js";
import {
  currentWorkspace,
  loadedMembers,
  user,
  currentRole,
  setLoadedMembers,
} from "./state.js";
import { loadTasks, loadAssignedTasks, loadAllTasks } from "./tasks.js";
import { loadMembersAdmin, loadMembersMember } from "./members.js";
import { loadDiscussions } from "./discussions.js";
import { loadActivities } from "./activities.js";
import { loadDocuments } from "./documents.js";
import { loadSettingsAdmin, loadSettingsMember } from "./settings.js";
import { loadInviteHistory } from "./invite.js";

/**
 * Central section renderer. Behaviour depends on currentRole.
 */
export async function renderSection(section, workspace, container) {
  if (!container) return;
  container.innerHTML = "";

  const allTasks = Array.isArray(workspace.workspace_tasks)
    ? workspace.workspace_tasks
    : workspace.workspace_tasks
      ? [workspace.workspace_tasks]
      : [];

  // Discussions are fetched on demand for sections that need them
  const fetchDiscussions = async () => {
    const { data, error } = await supabase
      .from("discussions")
      .select(`*, profiles:created_by (full_name, avatar_url)`)
      .eq("workspace_id", workspace.id);
    if (error) {
      actionMsg("Error loading discussions.", "error");
      return [];
    }
    return data || [];
  };

  switch (section) {
    // ---------- ADMIN / OWNER ----------
    case "createdTasks": {
      if (currentRole === "member") break;
      const tasks = allTasks.filter((ts) => ts.status === "in progress");
      loadTasks("Created Tasks", tasks, container);
      break;
    }

    case "taskHistory": {
      if (currentRole === "member") {
        // Member sees only their completed tasks
        const myCompleted = allTasks.filter(
          (t) =>
            String(t.assigned_to) === String(user.id) &&
            t.status === "completed",
        );
        loadAssignedTasks("Tasks History", myCompleted, container);
      } else {
        const history = allTasks.filter((ts) => ts.status === "completed");
        loadTasks("Tasks History", history, container);
      }
      break;
    }

    case "members": {
      const members = Array.isArray(workspace.workspace_members)
        ? workspace.workspace_members
        : [workspace.workspace_members];
      setLoadedMembers(members);

      if (currentRole === "member") {
        loadMembersMember(members, container);
      } else {
        loadMembersAdmin(members, container);
      }
      break;
    }

    case "documents": {
      const { data: docs } = await supabase
        .from("workspace_documents")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });
      await loadDocuments(docs || [], container);
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

    case "discussions": {
      const allDiscussions = await fetchDiscussions();
      const open = allDiscussions.filter((d) => d.status === "open");
      loadDiscussions(
        "Discussions",
        open,
        container,
        "No discussion started yet.",
      );
      break;
    }

    case "discussionHistory": {
      const allDiscussions = await fetchDiscussions();
      const closed = allDiscussions.filter((d) => d.status === "closed");
      loadDiscussions(
        "Discussions History",
        closed,
        container,
        "No discussion histories yet.",
      );
      break;
    }

    case "inviteHistory": {
      if (currentRole === "member") break;
      const { data: inviteHistory } = await supabase
        .from("workspace_invites")
        .select("*")
        .eq("workspace_id", workspace.id);
      loadInviteHistory(inviteHistory || [], container);
      break;
    }

    case "settings": {
      if (currentRole === "member") {
        await loadSettingsMember(container, workspace);
      } else {
        await loadSettingsAdmin(container, workspace, user.id);
      }
      break;
    }

    // ---------- MEMBER-ONLY ----------
    case "myTasks": {
      if (currentRole !== "member") break;
      const myTasks = allTasks.filter(
        (t) =>
          String(t.assigned_to) === String(user.id) &&
          t.status === "in progress",
      );
      loadAssignedTasks("My Tasks", myTasks, container);
      break;
    }

    case "allTasks": {
      if (currentRole !== "member") break;
      loadAllTasks(allTasks, container);
      break;
    }

    default:
      console.warn("Unknown section:", section);
  }
}
