import { closeModal } from "../ui.js";
import {
  createWorkspaceInvite,
  loadedMembers,
} from "../features/workspace-admin.js";
import { supabase } from "../supabase.js";
import {
  createLogElement,
  updateTaskCount,
  checkIfEmpty,
  savedLogDetails,
  renderExistingLogs,
} from "../features/personalTasks.js";
import { actionMsg } from "./modals.js";
import { renderRecentLogs } from "../dashboard.js";
import { sessionState } from "../session.js";
import {notifyUser} from "./notifications.js"

export function attachCreateTaskEvent(workspaceId) {
  const createTaskBtn = document.getElementById("createTaskBtn");
  if (!createTaskBtn) return;

  const assignedTo = document.getElementById("assignToDropdown");
  if (loadedMembers && Array.isArray(loadedMembers)) {
    loadedMembers.forEach((lm) => {
      if (lm.profiles) {
        const option = document.createElement("option");
        option.value = lm.profiles.id;
        option.textContent = lm.profiles.full_name;
        assignedTo.append(option);
      }
    });
  }

  // When create task button is clicked to create a new task
  createTaskBtn.addEventListener("click", async () => {
    createTaskBtn.disabled = true;

    const taskTitle = document.getElementById("taskTitle").value.trim();
    const taskDescription = document
      .getElementById("taskDescription")
      .value.trim();
    const assignedToValue = assignedTo.value;

    if (!taskTitle || !taskDescription) {
          actionMsg(" Title and description required!", "error");
      return;
    }

    // Get the authenticated user ID
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const taskData = {
      workspace_id: workspaceId,
      created_by: user.id,
      title: taskTitle,
      status: "in progress",
      assigned_to: assignedToValue || null, // Assign to empty if no one is selected
      description: taskDescription,
    };

    // Insert task into the database
    const { data, error } = await supabase
      .from("workspace_tasks")
      .insert(taskData)
      .select();

    if (error) {
      console.error(error);
         actionMsg("Failed to create task!", "error");
             createTaskBtn.disabled = false;

      return;
    }

    createTaskBtn.disabled = false;

    // Only one task is created, use the first item
    const createdTask = data[0];

if(createdTask.assigned_to != null) {
  await notifyUser({
    workspaceId, receiverUserId: createdTask.assigned_to, actorId: user.id, type: "task_assigned", entityId: createdTask.id, entityType: "task",
  })
}
    // Render the task in the UI
    const taskCard = document.createElement("div");
    taskCard.classList.add("card", "taskCard");

    const taskTitleElem = document.createElement("h3");
    taskTitleElem.classList.add("taskTitle");
    taskTitleElem.textContent = createdTask.title;

    const taskMeta = document.createElement("p");
    taskMeta.classList.add("taskMeta", "meta");

    const assignToMemberBtn = document.createElement("button");
    assignToMemberBtn.classList.add(
      "btn",
      "btn-primary",
      "btn-sm",
      "assignToMemberBtn",
    );
    assignToMemberBtn.textContent = "Assign to Member";

    const assignee = loadedMembers.find(
      (m) => m.profiles.id === createdTask.assigned_to,
    );
    taskMeta.textContent = assignee
      ? `Assigned to: ${assignee.profiles.full_name}`
      : "Unassigned";

    taskCard.append(taskTitleElem, taskMeta);
    if (!assignee) taskCard.append(assignToMemberBtn);

    // Prepend the new task card to the grid
    const container = document.querySelector(".grid");
    if (container) {
      container.prepend(taskCard);
    }

    // Close the modal after task creation
    closeModal();
  });
}

//ADD MEMEBR EVENTS
export async function attachAddMemberEvents(workspaceId) {
  const emailSection = document.getElementById("invite-email-section");
  const qrSection = document.getElementById("invite-qr-section");

  // SWITCH TO EMAIL MODE
  document.getElementById("invite-email-btn").onclick = () => {
    emailSection.style.display = "block";
    qrSection.style.display = "none";
  };

  // SWITCH TO QR MODE
  document.getElementById("invite-qr-btn").onclick = () => {
    emailSection.style.display = "none";
    qrSection.style.display = "block";
  };

  //GET WORKSPACE MEMBER COUNT
   const { count, error } = await supabase
    .from("workspace_members")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error(error);
    return null;
  }

  // SEND EMAIL INVITE
  document.getElementById("send-email-invite-btn").onclick = async () => {
    const email = document.getElementById("invite-email-input").value;
    const role = document.getElementById("invite-role-email").value;

    if (!email) return actionMsg("Please enter an email.", "error");

    if (
      count >= sessionState.plan.max_members &&
      sessionState.plan.max_members !== null
    ) {
      actionMsg(
        "You have exceeded the limit for adding members to this workspace on your current plan. Upgrade to a new plan to add more members!",
        "error",
      );
      return;
    }
    const invite = await createWorkspaceInvite({
      workspaceId,
      role,
      email,
    });

    if (!invite?.token) {
          actionMsg("Invite creation failed. No token returned.", "error");
      console.error("Invite creation failed. No token returned");
      return;
    }

    const inviteUrl = `${window.location.origin}/invite?token=${invite.token}`;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data, error } = await supabase.functions.invoke("send-invite", {
      body: { email, inviteUrl },
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    if (error) {
      console.error(error);
                actionMsg("Failed to send invite.", "error");
      return;
    }

              actionMsg("Invite sent!", "success");

  };

  // GENERATE QR INVITE
  document.getElementById("generate-qr-btn").onclick = async () => {
    const role = document.getElementById("invite-role-qr").value;

    if (
      count >= sessionState.plan.max_members &&
      sessionState.plan.max_members !== null) {
      actionMsg(
        "You have exceeded the limit for adding members to this workspace on your current plan. Upgrade to a new plan to add more members!",
        "error",
      );
      return;
    }
    const invite = await createWorkspaceInvite({ workspaceId, role });
    if (!invite || !invite.token) {
                actionMsg("Error: Invite token was not generated.", "error");
      return;
    }

    const baseUrl = window.location.origin; // Automatically uses localhost or app.loghue.com
    const inviteUrl = `${baseUrl}/invite?token=${invite.token}`;

    document.getElementById("invite-link-input").value = inviteUrl;

    const qrContainer = document.getElementById("qr-container");
    qrContainer.innerHTML = "";

    new QRCode(qrContainer, {
      text: inviteUrl,
      width: 180,
      height: 180,
    });
  };

  // COPY INVITE LINK
  document.getElementById("copy-invite-link-btn").onclick = async () => {
    const link = document.getElementById("invite-link-input").value;

    try {
      await navigator.clipboard.writeText(link);
                actionMsg(
                  "Invite link copied!",
                  "success",
                );

    } catch (err) {
      console.error("Copy failed", err);
                actionMsg("Failed to copy link.", "error");

    }
  };
}

export async function attachCreateLogEvent() {
  const taskEl = document.getElementById("task");
  const timeEl = document.getElementById("taskTime");
  const noteEl = document.getElementById("note");
  const logTaskBtn = document.getElementById("logTask");

  if (!logTaskBtn || !taskEl || !timeEl || !noteEl) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session.user;

  logTaskBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const taskValue = taskEl.value.trim();
    const timeValue = timeEl.value.trim();
    const noteValue = noteEl.value.trim();

    if (!taskValue || !timeValue || !noteValue) {
 actionMsg("Input fields must not be empty.", "error");
       return;
    }

    // Insert into Supabase FIRST (strict UI)
    const { data, error } = await supabase
      .from("personal_tasks")
      .insert({
        name: taskValue,
        description: noteValue,
        created_at: timeValue,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
 actionMsg("Failed to create log.", "error");
       return;
    }

    // Update in-memory state
    savedLogDetails.unshift(data);

    // Re-render UI
    renderExistingLogs();
    renderRecentLogs();
    updateTaskCount();
    checkIfEmpty();

    // Clear inputs
    taskEl.value = "";
    timeEl.value = "";
    noteEl.value = "";

    // Close modal
    closeModal();

     actionMsg("Log created successfully.", "success");
  });
}



//POPULATE TASK LIST
export function populateTaskList(workspace, userId) {
  const taskLists = document.getElementById("taskLists");
  if (!taskLists) return;

  const myTasks = workspace.workspace_tasks.filter(
    (t) => String(t.assigned_to) === String(userId),
  );

  taskLists.innerHTML = "";

  myTasks.forEach((task) => {
    const option = document.createElement("option");
    option.value = task.id;
    option.textContent = task.title;
    taskLists.append(option);
  });
}



//LOG TASK UPDATE
export async function insertTaskLogUpdate(supabase, workspaceId) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("User not authenticated", userError);
    return;
  }

  const taskId = document.getElementById("taskLists").value;
  const status = document.getElementById("taskLogUpdateStatus").value;
  let note = document.getElementById("taskLogUpdateNote").value;
 
  if(!note) {
alert("Please add a note about what you finished");
   return;
  } 

  const { data, error } = await supabase
    .from("workspace_task_logs")
    .insert([
      {
        workspace_id: workspaceId,
        task_id: taskId,
        created_by: user.id,
        task_status: status,
        log_note: note,
      },
    ]);

  if (error) {
    console.error("Insert error:", error);
    return;
  }

  note = "";

  closeModal();
  console.log("Log inserted:", data);
}

