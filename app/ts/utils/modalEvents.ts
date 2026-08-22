import { closeModal } from "../ui.js";
import { setButtonLoading } from "https://ui.scybud.com/js/ui.js";
import { createWorkspaceInvite } from "../pages/workspace/invite.js";
import { loadedMembers } from "../pages/workspace/state.js";
import { supabase } from "../supabase.js";
import {
  createTaskElement,
  checkIfEmpty,
  savedTaskDetails,
  renderExistingTasks,
} from "../pages/personalTasks.js";
import { actionMsg, openUpgradeModal } from "./modals.js";
import { sessionState } from "../session.js";
import { notifyUser } from "./notifications.js";
import bcrypt from "./bcrypt.js";


type Member = {
  user_id: string | null;
  role: string;
  profiles: {
    id: string;
    full_name: string;
  };
};

type Task = {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  status: string;
  is_completed: boolean;
  task_deadline: string | null;
  created_at: string;
  is_recurring: boolean | null;
};

type Workspace = {
    id: string;
    workspace_tasks: Task[];
  workspace_members: Member[];
};

declare var QRCode: any;


export function attachCreateTaskEvent(workspaceId: string) {
  const createTaskBtn = document.getElementById("createTaskBtn");
  if (!createTaskBtn) return;

  const assignedTo = document.getElementById("assignToDropdown") as HTMLInputElement;
  populateAssignDropdown(assignedTo);

  // When create task button is clicked to create a new task
  createTaskBtn.addEventListener("click", async () => {
    setButtonLoading(createTaskBtn, true);

    const taskTitleEl = document.getElementById("taskTitle") as HTMLInputElement;
    const taskTitle = taskTitleEl.value.trim() || null;

     const taskDueDateEl = document.getElementById("taskDueDate") as HTMLInputElement
     const taskDueDate = taskDueDateEl.value
       ? new Date(taskDueDateEl.value).toISOString()
       : null;

    const taskDescriptionEl = document
      .getElementById("taskDescription") as HTMLInputElement;
      const taskDescription = taskDescriptionEl.value.trim() || null;

    const assignedToValue = assignedTo.value || null;

    if (!taskTitle) {
      actionMsg("Title required", "error");
      setButtonLoading(createTaskBtn, false);
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
      task_deadline: taskDueDate,
      status: "in progress",
      assigned_to: assignedToValue || null, // Assign to empty if no one is selected
      description: taskDescription || "",
    };

    // Insert task into the database
    const { data, error } = await supabase
      .from("workspace_tasks")
      .insert(taskData)
      .select()
      .single();

    if (error) {
      console.error(error);
      actionMsg("Failed to create task!", "error");
      setButtonLoading(createTaskBtn, false);
      return;
    }

    setButtonLoading(createTaskBtn, false);

    await actionMsg("Task created!", "success");

    // Only one task is created, use the first item
    const createdTask = data;

    if (createdTask?.assigned_to != null) {
      await notifyUser({
        workspaceId,
        receiverUserId: createdTask.assigned_to,
        actorId: user.id,
        type: "task_assigned",
        entityId: createdTask.id,
        entityType: "task",
      });

      // Onboarding: assigning at creation time satisfies the
      // "assign a task" step, same event as reassigning an
      // existing task later (see performTaskAssign in tasks.js).
      document.dispatchEvent(
        new CustomEvent("onboarding:task_assigned", {
          detail: { taskId: createdTask.id, workspaceId },
        }),
      );
    }

    // Render the task in the UI
    const taskCard = document.createElement("div");
    taskCard.classList.add("card", "taskCard");

    const taskTitleElem = document.createElement("h3");
    taskTitleElem.classList.add("taskTitle");
    taskTitleElem.textContent = createdTask?.title;

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
      (m: Member) => m.profiles.id === createdTask.assigned_to,
    );
    taskMeta.textContent = assignee
      ? `Assigned to: ${assignee.profiles.full_name}`
      : "Unassigned";

    taskCard.append(taskTitleElem, taskMeta);
    if (!assignee) taskCard.append(assignToMemberBtn);

    // Prepend the new task card to the grid
    const container = document.querySelector(".grid") as HTMLElement;
    if (container) {
      container.prepend(taskCard);
    }

    // Close the modal after task creation
    closeModal();
  });
}

export function populateAssignDropdown(selectEl: HTMLElement) {
  if (!selectEl || !loadedMembers || !Array.isArray(loadedMembers)) return;

  selectEl.innerHTML = `<option value="">Unassigned</option>`;

  loadedMembers.forEach((lm) => {
    if (!lm.profiles) return;
    const option = document.createElement("option");
    option.value = lm.profiles.id;
    option.textContent = lm.profiles.full_name;
    selectEl.append(option);
  });
}

// TRANSFER WORKSPACE OWNERSHIP EVENTS
export function attachTransferOwnershipEvents(workspace: Workspace) {
  const modal = document.querySelector(".transfer-ownership-modal");
  if (!modal) return;

  const select = modal.querySelector("#transfer-owner-select") as HTMLInputElement;
  const confirmBtn = modal.querySelector("#confirm-transfer-btn") as HTMLButtonElement;

  // Populate dropdown with all NON‑owners
  workspace.workspace_members.forEach((m) => {
    if (m.role !== "owner") {
      const opt = document.createElement("option") as HTMLOptionElement;
      opt.value = m.user_id || m.profiles.id;
      opt.textContent = m.profiles.full_name;
      select.append(opt);
    }
  });

  confirmBtn.onclick = async () => {
    const newOwnerId = select.value;

    if (!newOwnerId) {
      actionMsg("Please select a new user.", "error");
      return;
    }

    // Find current owner in workspace_members
    const currentOwner = workspace.workspace_members.find(
      (m) => m.role === "owner",
    );
    if (!currentOwner) {
      actionMsg("No current owner found for this workspace.", "error");
      return;
    }
    const currentOwnerId = currentOwner.user_id || currentOwner.profiles?.id;

    const { data: ownerUpdateData, error: ownerColumnError } = await supabase
  .from("workspaces")
  .update({ created_by: newOwnerId })
  .eq("id", workspace.id)
  .select();

if (ownerColumnError) {
  console.error(ownerColumnError);
  actionMsg("Ownership transfer failed.", "error");
  return;
}
if (!ownerUpdateData || ownerUpdateData.length === 0) {
  actionMsg("Ownership transfer failed: permission denied.", "error");
  console.error("created_by update affected 0 rows, likely blocked by RLS");
  return;
}

    // 2. Assign owner role to the selected user
    const { error: assignError } = await supabase
      .from("workspace_members")
      .update({ role: "owner" })
      .eq("workspace_id", workspace.id)
      .eq("user_id", newOwnerId);

    if (assignError) {
      console.error(assignError);
      actionMsg("Ownership transfer failed.", "error");
      return;
    }

    // 3. Demote previous owner to admin (target by user_id, not role)
    const { error: removeError } = await supabase
      .from("workspace_members")
      .update({ role: "admin" })
      .eq("workspace_id", workspace.id)
      .eq("user_id", currentOwnerId);

    if (removeError) {
      console.error(removeError);
      actionMsg("Ownership transfer failed.", "error");
      return;
    }

    actionMsg("Ownership transfer successful!", "success");
    closeModal();
  };
}

//CREATE API EVENTS
export function attachCreateApiKeyEvents(workspaceId: string) {
  const modal = document.querySelector(".api-key-modal");
  if (!modal) return;

  // Generate button
  const generateBtn = modal.querySelector("#generate-api-key-btn") as HTMLButtonElement;
  if (!generateBtn) return;

  generateBtn.onclick = async () => {
    const nameInput = modal.querySelector("#api-key-name") as HTMLInputElement;
    const name = nameInput.value.trim();

    if (!name) {
      actionMsg("Please enter a name for the API key.", "error");
      return;
    }

    // Collect permissions
const permissionsEl = modal.querySelectorAll(
  'input[type="checkbox"]:checked"',
) as NodeListOf<HTMLInputElement>;

const permissions = [
      ...permissionsEl,
    ].map((c) => c.value);

    // 1. Generate raw key
    const rawKey = `lh_live_${crypto.randomUUID().replace(/-/g, "")}`;

    // 2. Hash key
    const hash = await bcrypt.hash(rawKey, 10);

    // 3. Store in DB
    const { error } = await supabase.from("api_keys").insert({
      workspace_id: workspaceId,
      name,
      key_hash: hash,
      prefix: rawKey.slice(0, 8),
      permissions,
    });

    if (error) {
      console.error(error);
      actionMsg("Failed to create API key.", "error");
      return;
    }

    // 4. Replace modal with "copy key" screen
    modal.innerHTML = `
      <svg class="closeModalBtn" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3.5" y="3.5" width="17" height="17" rx="6" ry="6" fill="currentColor" opacity="0.06"/>
        <path d="M9 9l6 6M15 9l-6 6"/>
      </svg>

      <h2>Your API Key</h2>
      <p class="mutedText">Copy this key now. You will not see it again.</p>

      <input class="inputField" id="raw-api-key" value="${rawKey}" readonly />

      <button type="button" class="btn" id="copy-api-key-btn">Copy</button>
    `;

    // Copy button
    const copyApiKeyBtn = modal.querySelector("#copy-api-key-btn") as HTMLButtonElement;

    copyApiKeyBtn.onclick = async () => {
      await navigator.clipboard.writeText(rawKey);
      actionMsg("API key copied!", "success");
    };
  };
}

//ADD MEMEBR EVENTS
export async function attachAddMemberEvents(workspaceId: string) {
  const emailSection = document.getElementById("invite-email-section") as HTMLElement;
  const qrSection = document.getElementById("invite-qr-section") as HTMLElement;

  // SWITCH TO EMAIL MODE
  const inviteByEmailBtn = document.getElementById("invite-email-btn") as HTMLButtonElement;

  inviteByEmailBtn.onclick = () => {
    emailSection.style.display = "block";
    qrSection.style.display = "none";
  };

  // SWITCH TO QR MODE
  const inviteByQrCodeBtn = document.getElementById("invite-qr-btn")as HTMLElement;
  inviteByQrCodeBtn.onclick = () => {
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
  const sendEmailInviteBtn = document.getElementById("send-email-invite-btn") as HTMLButtonElement;
  sendEmailInviteBtn.onclick = async () => {
    const inviteBtn = document.getElementById("send-email-invite-btn") as HTMLButtonElement;
    setButtonLoading(inviteBtn, true);

    const emailEl = document.getElementById("invite-email-input") as HTMLInputElement;
    const email = emailEl.value || null;

    const roleEl = document.getElementById("invite-role-email") as HTMLInputElement
    const role = roleEl.value || null;

    if (!email) {
      setButtonLoading(inviteBtn, false);
      return actionMsg("Please enter an email.", "error");
    }
    if (!email.includes("@")) {
      setButtonLoading(inviteBtn, false);
      return actionMsg("Please enter a valid email.", "error");
    }

    if (
      count >= sessionState.plan.max_members &&
      sessionState.plan.max_members !== null
    ) {
      await openUpgradeModal("memberLimit");
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
      setButtonLoading(inviteBtn, false);
      return;
    }

    const inviteUrl = `${window.location.origin}/pages/invite?token=${invite.token}`;

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
      setButtonLoading(inviteBtn, false);
      return;
    }

    actionMsg("Invite sent!", "success");
    setButtonLoading(inviteBtn, false);

    document.dispatchEvent(
      new CustomEvent("onboarding:member_invited", {
        detail: { workspaceId },
      }),
    );
  };

  // GENERATE QR INVITE
  const generateQrBtn = document.getElementById("generate-qr-btn") as HTMLButtonElement;
  generateQrBtn.onclick = async () => {

    setButtonLoading(generateQrBtn, true);

    const roleEl = document.getElementById("invite-role-qr") as HTMLInputElement;
    const role = roleEl.value;

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
    const invite = await createWorkspaceInvite({ workspaceId, role });
    if (!invite || !invite.token) {
      actionMsg("Error: Invite token was not generated.", "error");
      setButtonLoading(generateQrBtn, false);
      return;
    }

    const baseUrl = window.location.origin; // Automatically uses localhost or app.loghue.com
    const inviteUrl = `${baseUrl}/pages/invite?token=${invite.token}`;

    const inviteLinkInput = document.getElementById("invite-link-input") as HTMLInputElement;
    inviteLinkInput.value = inviteUrl;

    const qrContainer = document.getElementById("qr-container") as HTMLElement;
    qrContainer.innerHTML = "";

    new QRCode(qrContainer, {
      text: inviteUrl,
      width: 180,
      height: 180,
    });

    setButtonLoading(generateQrBtn, false);

    document.dispatchEvent(
      new CustomEvent("onboarding:member_invited", {
        detail: { workspaceId },
      }),
    );
  };

  // COPY INVITE LINK
  const copyInviteLinkBtn = document.getElementById("copy-invite-link-btn") as HTMLButtonElement
  copyInviteLinkBtn.onclick = async () => {
    setButtonLoading(copyInviteLinkBtn, true);

    const linkEl = document.getElementById("invite-link-input") as HTMLInputElement;
    const link = linkEl.value;

    try {
      await navigator.clipboard.writeText(link);
      actionMsg("Invite link copied!", "success");
    } catch (err) {
      console.error("Copy failed", err);
      actionMsg("Failed to copy link.", "error");
    } finally {
      setButtonLoading(copyInviteLinkBtn, false);
    }
  };

  //SHARE INVITE LINK
  const shareInviteLinkBtn = document
    .getElementById("share-invite-link-btn") as HTMLButtonElement;

    shareInviteLinkBtn.addEventListener("click", async () => {
      const shareBtn = document.getElementById("share-invite-link-btn");
      setButtonLoading(shareBtn, true);

      const linkEl = document.getElementById("invite-link-input") as HTMLInputElement;
      const link = linkEl.value;
      const data = {
        title: "Special invite to join my workspace",
        text: "Click this invite link to join my workspace on LogHue:",
        url: link,
      };

      try {
        if (navigator.share) {
          await navigator.share(data);
          actionMsg("Shared successfully", "success");
        } else {
          actionMsg("Sharing is not supported on this browser.");
        }
      } catch (err) {
        console.error("Share failed:", err);
        actionMsg("Failed to share", "error");
      } finally {
        setButtonLoading(shareBtn, false);
      }
    });
}

export async function attachCreatePersonalTaskEvent() {
  const taskEl = document.getElementById("task") as HTMLInputElement;
  const timeEl = document.getElementById("taskTime") as HTMLInputElement;
  const noteEl = document.getElementById("note") as HTMLInputElement;
  const recurringEl = document.getElementById("isRecurring") as HTMLInputElement;
  const logTaskBtn = document.getElementById("logTask") as HTMLInputElement;

  if (!logTaskBtn || !taskEl || !timeEl || !noteEl || !recurringEl) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session.user;

  logTaskBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    setButtonLoading(logTaskBtn, true);

    const taskValue = taskEl.value.trim();
    const timeValue = timeEl.value
      ? new Date(timeEl.value).toISOString()
      : null;
    const noteValue = noteEl.value.trim();
const recurringValue = recurringEl.checked ? true : false;

    if (!taskValue || !timeValue) {
      actionMsg("Task and time are required.", "error");
      setButtonLoading(logTaskBtn, false);
      return;
    }

    // Insert into Supabase FIRST (strict UI)
    const { data, error } = await supabase
      .from("personal_tasks")
      .insert({
        name: taskValue,
        description: noteValue || "",
        task_deadline: timeValue,
        user_id: user.id,
        is_recurring: recurringValue,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      actionMsg("Failed to create Task.", "error");
      setButtonLoading(logTaskBtn, false);
      return;
    }

    // Update in-memory state
    savedTaskDetails.unshift(data);

    document.dispatchEvent(
      new CustomEvent("onboarding:task_created", {
        detail: { taskId: data.id },
      }),
    );

    // Re-render UI
    await renderExistingTasks();
    checkIfEmpty();

    // Clear inputs
    taskEl.value = "";
    timeEl.value = "";
    noteEl.value = "";

    // Close modal
    closeModal();

    actionMsg("Task created successfully.", "success");
    setButtonLoading(logTaskBtn, false);
  });
}

//POPULATE TASK LIST
export async function populateTaskList(workspace: Workspace, userId: string) {
  const taskLists = document.getElementById("taskLists") as HTMLInputElement;
  if (!taskLists) return;

  const tasks = workspace?.workspace_tasks || [];

  const myTasks = tasks.filter(
    (t) => t.assigned_to === userId && t.status === "in progress",
  );

  taskLists.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a task";
  placeholder.disabled = true;
  placeholder.selected = true;
  taskLists.append(placeholder);

  myTasks.forEach((task: Task) => {
    taskLists.disabled = false;
    taskLists.classList.remove("disabled");

    const option = document.createElement("option");
    option.value = task.id;
    option.textContent = task.title || "Untitled Task";
    taskLists.append(option);
  });
}

//LOG TASK UPDATE
export async function insertTaskLogUpdate(supabase: any, workspaceId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("User not authenticated", userError);
    return;
  }

  const taskIdEl = document.getElementById("taskLists") as HTMLInputElement;
  const taskId = taskIdEl.value;

  const statusEl = document.getElementById("taskLogUpdateStatus") as HTMLInputElement;
  const status = statusEl.value;

  const noteEl = document.getElementById("taskLogUpdateNote") as HTMLInputElement;
  let note = noteEl.value;

  if (!note) {
    actionMsg("Please add a note about what you finished");
    return;
  }

  const { data, error } = await supabase.from("workspace_task_logs").insert([
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
  //push notif
  const { pushNotifData, pushNotifError } = await supabase.functions.invoke(
    "trigger-push",
    {
      body: {
        workspace_id: workspaceId,
        payload: {
          title: "New log just logged",
          body: "Someone logged an update on a task!",
          url: "https://app.loghue.com/",
        },
      },
    },
  );
  if (pushNotifError) {
    console.error(pushNotifError);
    actionMsg("Error sending push notification.", "error");
  }
  note = "";

  closeModal();
  console.log("Log inserted:", data);
}
