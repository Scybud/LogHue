import { closeModal } from "../ui.js";
import {
  createWorkspaceInvite,
  loadedMembers,
} from "../features/workspace-admin.js";
import { supabase } from "../supabase.js";

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
      alert("Input fields must not be empty");
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
      status: "todo",
      assigned_to: assignedToValue || "", // Assign to empty if no one is selected
      description: taskDescription,
    };

    // Insert task into the database
    const { data, error } = await supabase
      .from("workspace_tasks")
      .insert(taskData)
      .select();

    if (error) {
      console.error(error);
      alert("Failed to create task.");
      return;
    }

    createTaskBtn.disabled = false;

    // Assuming only one task is created, use the first item
    const createdTask = data[0];

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

  // SEND EMAIL INVITE
  document.getElementById("send-email-invite-btn").onclick = async () => {
    const email = document.getElementById("invite-email-input").value;
    const role = document.getElementById("invite-role-email").value;

    if (!email) return alert("Please enter an email");

    const invite = await createWorkspaceInvite({
      workspaceId,
      role,
      email,
    });

    if (!invite?.token) {
      console.error("Invite creation failed - no token returned");
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
      alert("Failed to send invite");
      return;
    }

    alert("Invite sent!");
  };

  // GENERATE QR INVITE
  document.getElementById("generate-qr-btn").onclick = async () => {
    const role = document.getElementById("invite-role-qr").value;

    const invite = await createWorkspaceInvite({ workspaceId, role });
    if (!invite || !invite.token) {
      alert("Error: Invite token was not generated.");
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
      alert("Invite link copied!");
    } catch (err) {
      console.error("Copy failed", err);
      alert("Failed to copy link");
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

  //When log task button is clicked to create new log
  logTaskBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const taskValue = taskEl.value.trim();
    const timeValue = timeEl.value.trim();
    const noteValue = noteEl.value.trim();

    if (!taskValue || !timeValue || !noteValue) {
      alert("Input field must not be empty");
      return;
    }

    const logData = {
      name: taskValue,
      description: noteValue,
      created_at: timeValue,
      user_id: user.id,
    };

    // optimistic UI: update state + DOM immediately
    savedLogDetails.unshift(logData);
    const el = createLogElement(logData);
    personalCreatedLogs.prepend(el);

    requestAnimationFrame(() => {
      el.classList.add("show");
    });

    updateTaskCount();
    checkIfEmpty();

    // clear inputs + close panel
    taskEl.value = "";
    timeEl.value = "";
    noteEl.value = "";

    // send to Supabase
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
      alert("Failed to create task.");

      // rollback optimistic UI
      const index = savedLogDetails.findIndex((log) => log.id === tempId);
      if (index !== -1) savedLogDetails.splice(index, 1);

      el.classList.add("removing");
      setTimeout(() => {
        el.remove();
        updateTaskCount();
        checkIfEmpty();
      }, 300);

      return;
    }

    // replace temp id with real id
    const index = savedLogDetails.findIndex((log) => log.id === tempId);
    if (index !== -1) {
      savedLogDetails[index] = data;
    }
    el.dataset.id = data.id;
  });
}