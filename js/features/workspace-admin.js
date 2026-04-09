import { attachSidebarEvents } from "./../components/sidebar.js";
import { openCreateTaskModal, openAddMemeberModal, confirmAction, actionMsg } from "./../utils/modals.js";
import { supabase } from "../supabase.js";
import { loadComponent, closeModal } from "../ui.js";
import { openStartDiscussionModal } from "../utils/modals.js";
import { sessionState } from "../session.js";
import { createDropdown } from "../ui.js";
import {navDropdowns} from "../components/sidebar.js"

export let currentWorkspace = null;
export let loadedMembers = [];
let user = null;

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".navBtn");
  if (!btn) return;

  const container = document.getElementById("adminWorkspaceDashboardContent");

  const section = btn.dataset.section;

  renderSection(section, currentWorkspace, container);
});

//CHECK ADMIN ACCESS
async function checkAdminAccess(workspaceId, user) {
  const { data: membership, error } = await supabase
  .from("workspace_members")
  .select("role")
  .eq("workspace_id", workspaceId)
  .eq("user_id", user.id)
    .single();
    
    if (error || (membership.role !== "admin" && membership.role !== "owner")) {
      actionMsg(
        "Access Denied: You do not have admin permissions for this workspace.", "error"
      );
    window.location.href = "/index"; // Send them to their main list
  }
}

export async function initAdminWorkspaceData() {
  //Get workspace url
  const params = new URLSearchParams(window.location.search);
  const workspaceId = params.get("ws");
  
  const { data, userError } = await supabase.auth.getUser();
  
  if (userError) {
    console.error(userError);
    return;
  }
   user = data.user;

  if (!workspaceId) {
    window.location.href = "index";
    return;
  }

  //SECURE ADMIN WORKSPACE BY CHECKING FOR ADMIN ROLE
  checkAdminAccess(workspaceId, user);

  //Load data
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      `*, workspace_tasks(*, profiles:assigned_to (id, full_name, avatar_url)), workspace_members(role, profiles (id, full_name, avatar_url))`,
    )
    .eq("id", workspaceId)
    .single();

  currentWorkspace = workspace;

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  const adminWorkspaceDashboardContent = document.getElementById(
    "adminWorkspaceDashboardContent",
  );

  if (!workspace || workspaceId.length < 10) {
    window.location.href = "index";
    return;
  }

  const workspaceName = document.getElementById("workspaceName");

  if (workspace) {
    document.title = workspace.name + "" + "| LogHue";
  }

  if (workspace && workspaceName) {
    workspaceName.innerHTML = `${workspace.name} <span class="tag">Admin</span>`;
  }

  if (adminWorkspaceDashboardContent) {
    adminWorkspaceDashboardContent.innerHTML = "";
  }

  if (workspace && adminWorkspaceDashboardContent) {
    const allTasks = workspace.workspace_tasks;
    //OPEN TASKS
    const tasks = allTasks.filter((ts) => ts.status === "in progress");
    loadTasks("Created Tasks",
      tasks || [],
      adminWorkspaceDashboardContent,
    );
  }

  attachSidebarEvents();
navDropdowns();

  const members = Array.isArray(workspace.workspace_members)
    ? workspace.workspace_members
    : [workspace.workspace_members];

  loadedMembers = members;

  workspace.workspace_tasks = workspace.workspace_tasks || [];

  openStartDiscussionModal(currentWorkspace, user);
  openCreateTaskModal(currentWorkspace.id);
  openAddMemeberModal(currentWorkspace.id);
}

 function assignMemberTask() {
   const btns = document.querySelectorAll(".assignTaskBtn");

   btns.forEach((btn) => {
     btn.addEventListener("click", async () => {
       // Load modal
       await loadComponent(
         "https://loghue.com/components/modals/create-task",
         "modalContainer",
       );

       // Wait for DOM to render
       await new Promise(requestAnimationFrame);

       const assignedTo = document.getElementById("assignToDropdown");
       const createTaskBtn = document.getElementById("createTaskBtn");

  if (!assignedTo || !createTaskBtn) {
    console.error("Modal not fully loaded");
    return;
  }

       // Find the member object
       const memberId = btn.id;
       const member = loadedMembers.find(
         (m) => String(m.profiles.id) === String(memberId),
       );

       // Populate dropdown with ONLY this member
       assignedTo.innerHTML = "";
       if (member) {
         const option = document.createElement("option");
         option.value = member.profiles.id;
         option.textContent = member.profiles.full_name;
         assignedTo.append(option);
       }

       // Remove old listeners to prevent duplicates
       createTaskBtn.replaceWith(createTaskBtn.cloneNode(true));
       const newCreateTaskBtn = document.getElementById("createTaskBtn");

       newCreateTaskBtn.addEventListener("click", async () => {
         const taskTitle = document.getElementById("taskTitle").value.trim();
         const taskDescription = document
           .getElementById("taskDescription")
           .value.trim();
         const assignedToValue = assignedTo.value;

         if (!taskTitle || !taskDescription) {
           alert("Input fields must not be empty");
           return;
         }

           checkAdminAccess(currentWorkspace.id, user);

         const taskData = {
           workspace_id: currentWorkspace.id,
           created_by: user.id,
           title: taskTitle,
           status: "in progress",
           assigned_to: assignedToValue,
           description: taskDescription,
         };

         const { data, error } = await supabase
           .from("workspace_tasks")
           .insert(taskData)
           .select();

         if (error) {
           console.error(error);
           alert("Failed to create task.");
           return;
         }

         // Render new task
         const createdTask = data[0];
         const container = document.querySelector(".grid");

         if (container) {
           const taskCard = document.createElement("div");
           taskCard.classList.add("card", "taskCard");

           const titleEl = document.createElement("h3");
           titleEl.textContent = createdTask.title;

           const meta = document.createElement("p");
           const assignee = loadedMembers.find(
             (m) => m.profiles.id === createdTask.assigned_to,
           );
           meta.textContent = assignee
             ? `Assigned to: ${assignee.profiles.full_name}`
             : "Unassigned";

           taskCard.append(titleEl, meta);
           container.prepend(taskCard);
         }

         closeModal();
       });
     });
   });
 }

 async function removeMember() {
  const btns = document.querySelectorAll(".removeMemberBtn");

   const {
           data: { user },
         } = await supabase.auth.getUser();

  btns.forEach((btn) => {
if(!btn) return;
       const id = btn.id;

btn.addEventListener("click", () => {
  confirmAction(
    "Are you sure? Removing this member from your workspace cannot be undone. All actions related to the user might also be deleted.",
    [
      { label: "Cancel", type: "cancel" },
      {
        label: "Remove",
        type: "confirm",
        onClick: () => performMemberRemoval( id, currentWorkspace.id, user),
      },
    ],
  );
})
  })
 }
async function performMemberRemoval(id, workspaceId, user) {

             checkAdminAccess(currentWorkspace.id, user);

const { error } = await supabase.from("workspace_members").delete().eq("user_id", id).eq("workspace_id", workspaceId);

    if (error) {
      console.error(error);
      actionMsg("Failed to remove member from workspace", "error");
      return;
    }

    actionMsg("Member removed!", "success");

       setTimeout(() => {
         // Refresh UI
         window.location.reload();
   
       }, 2000);
}

async function renderSection(section, workspace, container) {
  if(!container) return;
  container.innerHTML = "";

  //GET TASKS DATA GLOBALLY
  const allTasks = Array.isArray(workspace.workspace_tasks)
    ? workspace.workspace_tasks
    : [workspace.workspace_tasks];
    
    //Load data
    const { data: allDiscussions, dcnError } = await supabase
      .from("discussions")
      .select(`*, profiles:created_by (full_name, avatar_url)`)
      .eq("workspace_id", workspace.id);

  switch (section) {
    case "createdTasks":
      //OPEN TASKS
      const tasks = allTasks.filter((ts) => ts.status === "in progress");
      loadTasks("Created Tasks", tasks || [], container);
      break;

    case "members":
      const members = Array.isArray(workspace.workspace_members)
        ? workspace.workspace_members
        : [workspace.workspace_members];

      loadedMembers = members;

      loadMembers(members, container);
      break;

    case "activities":
      const { data: logs, error } = await supabase
        .from("workspace_task_logs")
        .select(
          `
    *,
    profiles:created_by (full_name, avatar_url),
    workspace_tasks:task_id (title)
  `,
        )
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      const { data: actDcns, actDcnsError } = await supabase
        .from("discussions")
        .select(
          `
    *,
    profiles:created_by (full_name, avatar_url)
  `,
        )
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      const normalizedLogs = (logs || []).map((log) => ({
        id: log.id,
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

    case "discussions":
      const discussions = allDiscussions.filter(
        (dcns) => dcns.status === "open",
      );
      loadDiscussions("Discussions", discussions || [], container);
      break;

    case "inviteHistory":
      //Load data
      const { data: inviteHistory, inviteHistoryError } = await supabase
        .from("workspace_invites")
        .select("*")
        .eq("workspace_id", workspace.id);

      loadInviteHistory(inviteHistory || [], container);
      break;

    case "taskHistory":
      //Load data
      const taskHistory = allTasks.filter((ts) => ts.status === "completed");

      loadTasks("Tasks History", taskHistory || [], container);
      break;

    case "discussionHistory":
      //Load data
      const discussionHistory = allDiscussions.filter((dcns) => dcns.status === "closed");

      loadDiscussions("Discussions History", discussionHistory || [], container);
      break;
  }
}


function loadInviteHistory(invites, container) {
  const table = document.createElement("table")
  
  table.classList.add("inviteTable");
table.innerHTML = `
    <thead>
      <tr>
        <th>Invite Method</th>
        <th>Invite Target</th>
        <th>Created</th>
        <th>Uses</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="invite-body"></tbody>
`;

const tbody = table.querySelector("#invite-body");

const inviteTemplate = document.getElementById("invite-row-template");
if(!inviteTemplate) return;

invites.forEach((inv) => {
  const row = inviteTemplate.content.cloneNode(true);
    const tr = row.querySelector("tr");

  const method = inv.email ? "Email" : "Link";

  const target = inv.email
    ? inv.email
    : `https://app.loghue.com/invite?token=${inv.token}`;

  const created = inv.created_at;

  const count = inv.accepted_count ?? 0;

  let status = "Active";
  let statusClass = "active";
  if (count >= inv.max_invite_count) {
    status = "Full";
    statusClass = "full";
  } else if (inv.accepted) {
    status = "Used";
    statusClass = "used";
  }


  // Fill row
  row.querySelector(".method").textContent = method;

  const urlText = row.querySelector(".urlText");
  urlText.textContent = target;
  urlText.title = target;

  row.querySelector(".created").textContent = formatDateTime(created);
  row.querySelector(".uses").textContent = `${count} / ${inv.max_invite_count}`;

  const statusCell = row.querySelector(".status");
  statusCell.textContent = status;
statusCell.classList.add(statusClass)

  // Copy button
  row.querySelector(".copyBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(target);
    actionMsg("URL copied to clipboard!", "success")
  });

  // Actions
  row.querySelector(".actions").innerHTML = `
      <button class="revokeInviteBtn revoke" id="${inv.id}" type="button">Revoke</button>
    `;
    // Mobile labels
    row.querySelector(".method").dataset.label = "Invite Method";
    row.querySelector(".urlCell").dataset.label = "Invite Target";
    row.querySelector(".created").dataset.label = "Created";
    row.querySelector(".uses").dataset.label = "Uses";
    row.querySelector(".status").dataset.label = "Status";
    row.querySelector(".actions").dataset.label = "Actions";
    
    // Append row
    if(!tbody) console.log("body not found");
    tbody.prepend(row);
    
        //Revoke invite
    const revokeInviteBtn = tr.querySelector(".revokeInviteBtn");
    if (!revokeInviteBtn) return console.log("no button");
    
    revokeInviteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
     const id = e.currentTarget.id
       const { error } = await supabase.from("workspace_invites").delete().eq("id", id).eq("created_by", user.id);
    
        if (error) {
          console.error(error);
          actionMsg("Failed to delete workspace.", "error");
          return;
        }
    
    tr.remove();
        actionMsg("Invite revoked!", "success")
    })

  });

// Append table into the REAL container
container.appendChild(table);
}

export function loadDiscussions(title, discussions, container) {
  if (!discussions || discussions.length === 0) {
    container.innerHTML = `<p class="placeholderText">No discussions started yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = title;

  const divGrid = document.createElement("div");
  divGrid.classList.add("container");

  discussions.forEach((dcn) => {
    const discussionCard = document.createElement("div");
    discussionCard.classList.add("card", "discussionCard");
    discussionCard.dataset.id = dcn.id; // IMPORTANT

    // Make card clickable
    discussionCard.addEventListener("click", () => {
      window.location.href = `discussion-view?dcn=${dcn.id}`;
    });

    const dcnHeader = document.createElement("div");
    dcnHeader.classList.add("discussionHeader");

    const img = document.createElement("img");
    img.classList.add("profileImg");
    img.src = discussions.profiles?.avatar_url || "https://loghue.com/assets/images/default_profile.png";

    const span = document.createElement("span")
    span.classList.add("actorName");
    span.textContent = dcn.profiles?.full_name || "Unknown User";

dcnHeader.append(img, span);

    const dcnTitle = document.createElement("h3");
    dcnTitle.classList.add("taskTitle");
    dcnTitle.textContent = dcn.title;

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Content";

    const descriptionText = document.createElement("p");
    descriptionText.textContent = dcn.content;

    details.append(summary, descriptionText);

    const creator = document.createElement("p");
    creator.classList.add("meta");
    creator.textContent = dcn.profiles.full_name;

    const createdOn = document.createElement("p");
    createdOn.classList.add("meta");
    createdOn.textContent = formatDateTime(dcn.created_at);

    const dcnMeta = document.createElement("div");
    dcnMeta.classList.add("dcnMeta");
    dcnMeta.append(createdOn);

    const viewBtn = document.createElement("button");
    viewBtn.classList.add("btn", "btn-primary");
    viewBtn.textContent = "Open";

    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `discussion-view?dcn=${dcn.id}`;
    });

    details.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    discussionCard.append(dcnHeader, dcnMeta, dcnTitle, details, viewBtn);
    divGrid.append(discussionCard);
  });

  section.append(sectionTitle, divGrid);
  container.append(section);
}


export function loadTasks(title, tasks, container) {
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<p class="placeholderText">No tasks yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = title;

  const divGrid = document.createElement("div");
  divGrid.classList.add("container", "double-grid");

  tasks.forEach((tsk) => {
    const taskCard = document.createElement("div");
    taskCard.classList.add("card", "taskCard");
    taskCard.dataset.id = tsk.id; // IMPORTANT

    // Make card clickable
    taskCard.addEventListener("click", () => {
      window.location.href = `task-view?task=${tsk.id}`;
    });

    const taskTitle = document.createElement("h3");
    taskTitle.classList.add("taskTitle");
    taskTitle.textContent = tsk.title;

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Description";

    const descriptionText = document.createElement("p");
    descriptionText.textContent = tsk.description;

    details.append(summary, descriptionText);

    const assignee = document.createElement("p");
    assignee.classList.add("meta");
    assignee.textContent = tsk.profiles
      ? `Assigned to: ${tsk.profiles.full_name}`
      : "Unassigned";

    const assignedOn = document.createElement("p");
    assignedOn.classList.add("meta");
    assignedOn.textContent = `Assigned on: ${formatDateTime(tsk.created_at)}`;

    const taskMeta = document.createElement("div");
    taskMeta.classList.add("taskMeta");
    taskMeta.append(assignee, assignedOn);

    const viewBtn = document.createElement("button");
    viewBtn.classList.add("btn", "btn-primary");
    viewBtn.textContent = "View Task";

    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `task-view?task=${tsk.id}`;
    });

details.addEventListener("click", (e) => {
  e.stopPropagation();
});


    taskCard.append(taskTitle, taskMeta, details, viewBtn);
    divGrid.append(taskCard);
  });

  section.append(sectionTitle, divGrid);
  container.append(section);
}


function loadMembers(members, container) {
  if (!members || members.length === 0) {
    container.innerHTML = `<p class="placeholderText">No members found.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = "Workspace Members";

  const divGrid = document.createElement("div");
  divGrid.classList.add("grid");

  members.forEach((mbr) => {
    const memberCard = document.createElement("div");
    memberCard.classList.add("card", "memberCard");

    const memberName = document.createElement("h3");
    memberName.classList.add("memberName");
    memberName.textContent = mbr.profiles.full_name;

    const tag = document.createElement("span");
    tag.classList.add("tag");
    tag.textContent = mbr.role;
    memberName.append(tag);

    const avatar = document.createElement("img");
    avatar.classList.add("profileImg");
    avatar.src = mbr.profiles.avatar_url;

    const cardHeader = document.createElement("div");
    cardHeader.classList.add("cardHeader");
    cardHeader.append(tag, avatar, memberName);

    const assignTaskBtn = document.createElement("button");
    assignTaskBtn.type = "button";
    assignTaskBtn.id = mbr.profiles.id;
    assignTaskBtn.classList.add(
      "btn",
      "btn-sm",
      "btn-primary",
      "assignTaskBtn",
    );
    assignTaskBtn.textContent = "Assign Task";

    const removeMemberBtn = document.createElement("button")
    removeMemberBtn.type = "button"
removeMemberBtn.id = mbr.profiles.id;
 removeMemberBtn.classList.add(
   "btn",
   "btn-sm",
   "btn-primary",
   "danger",
   "removeMemberBtn",
 );
    removeMemberBtn.textContent = "Remove member";

    const adminActions = document.createElement("div");
    adminActions.classList.add("adminActions");
    `${mbr.role === "admin" ? adminActions.append(assignTaskBtn) : adminActions.append(assignTaskBtn, removeMemberBtn)}`;

    memberCard.append(cardHeader, adminActions);
    divGrid.append(memberCard);
  });

  section.append(sectionTitle, divGrid);
  container.append(section);

  //ATTACH TASK CREATION LOGIC FOR EACH MEMBER CARD
        assignMemberTask();
//ATTACH MEMBER REMOVAL LOGIC FOR EACH MEMBER CARD'
removeMember();
}

export function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "long", // February
    day: "numeric", // 11
    year: "numeric", // 2026
    hour: "2-digit", // 12
    minute: "2-digit", // 27
  });
}

function createLogElement(log) {
  const taskDetails = document.createElement("details");
  taskDetails.classList.add("loggedActivityContainer");
  taskDetails.dataset.id = log.id;

  const taskSummary = document.createElement("summary");
  taskSummary.title = "click to see details";
  taskSummary.innerHTML = `<span class="personalTaskName">${log.note}</span> 
 <div class="actionConatiner">
 <button data-title="Comment" type="button" class="commentBtn tooltip">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>
</svg>
</button>
 <button data-title="Mark as reviewed" type="button" class="markAsReviwedBtn tooltip">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="20 6 9 17 4 12" />
</svg>
 </button>
 </div>
 `;

  const taskTime = document.createElement("span");
  taskTime.classList.add("meta", "taskTime");
  taskTime.textContent = formatDateTime(log.date);

  const taskName = document.createElement("span");
  taskName.classList.add("meta", "taskName");
  taskName.textContent = `Task: ${log.task_title}`;

  const taskProgress = document.createElement("span");
  taskProgress.classList.add("meta", "taskProgress");
  taskProgress.textContent = log.progress;

  const meta = document.createElement("div");
  meta.classList.add("metaRow");
  meta.append(taskName, taskTime, taskProgress);

  taskDetails.append(taskSummary, meta);
  return taskDetails;
}

// -----------------------------
// ACTIVITIES (READ‑ONLY)
// -----------------------------
export function loadActivities(activities, container) {
  if (sessionState.plan.name === "free" || sessionState.plan.name === "Free") {
    container.innerHTML = `<p class="placeholderText">Workspace activities overview is not available on your current plan. <a href="https://loghue.com/pricing" target="_blank" rel="noopener">Upgrade</a> to see what is happening in your workspace at a glance.</p>`;
    return;
  }

  if (!activities || activities.length === 0) {
    container.innerHTML = `<p class="placeholderText">No activity in this workspace yet.</p>`;
    return;
  }
  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "Activities";

  const list = document.createElement("div");
  list.classList.add("activityList");

  activities.forEach((item) => {
    const actor = item.actor;
    const avatar = actor?.avatar_url || "/assets/default-avatar.png";
    const name = actor?.full_name || "Unknown User";

    const label =
      item.type === "task_log"
        ? `gave an update on "${item.title || "Unknown Task"}"`
        : `started a discussion "${item.title || "Untitled"}"`;

    const body =
      item.type === "task_log"
        ? `
        <p><strong>Note:</strong> ${item.note}</p>
        <p><strong>Status:</strong> ${item.status}</p>
      `
        : `
        <p><strong>Message:</strong> ${item.note}</p>
      `;

    const openBtn =
      item.type === "discussion"
        ? `
           window.location.href = 'https://app.loghue.com/discussion-view?dcn=${item.id}'
      `
        : "";

    const div = document.createElement("div");
    div.classList.add("activityItem");

    //ACTIVITY HEADER
    const activityHeader = document.createElement("div")
    activityHeader.classList.add("activityHeader")

    const profileImg = document.createElement("img");
    profileImg.classList.add("profileImg");
    profileImg.src = avatar;

    const actorName = document.createElement("span");
    actorName.classList.add("actorName");
    actorName.textContent = `${name} ${label}`;

    activityHeader.append(profileImg, actorName);
    
//ACTIVITY BODY
const activityBody = document.createElement("div")
activityBody.classList.add("activityBody")
activityBody.innerHTML = `${body}`

//ACTIVITY TIME
const activityTime = document.createElement("div")
activityTime.classList.add("activityTime");
activityTime.textContent = formatDateTime(item.created_at);

//BUTTON
const btn = document.createElement("button")
btn.type = "button"
btn.classList.add("btn", "pageOpenLink", "btn-secondary")
btn.textContent = "Open"
if (item.type === "discussion") {
  btn.onclick = () => {
    window.location.href = `https://app.loghue.com/discussion-view?dcn=${item.id}`
  }
}


div.append(activityHeader, activityBody, activityTime, btn);

    list.appendChild(div);
  });


  section.append(title, list);
  container.append(section);
}


export async function createWorkspaceInvite({
  workspaceId,
  role,
  email = null,
}) {
  // 1. Get the user FIRST
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    throw new Error("Authentication required to create invites");

  const token = crypto.randomUUID();

  const { data, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      role,
      email,
      token,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase Insert Error:", error);
    throw error;
  }
  return data;
}
