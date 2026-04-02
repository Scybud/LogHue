import { attachSidebarEvents } from "./../components/sidebar.js";
import { supabase } from "../supabase.js";
import { closeModal } from "../ui.js";
import { openLogTaskModal,   openStartDiscussionModal
 } from "../utils/modals.js";
import { sessionState } from "../session.js";

export let currentWorkspace = null;
export let loadedMembers = [];
let currentUser = null;

// -----------------------------
// NAVIGATION
// -----------------------------
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".navBtn");
  if (!btn) return;

  const container = document.getElementById("memberWorkspaceDashboardContent");
  const section = btn.dataset.section;

  renderSection(section, currentWorkspace, container);
});

// -----------------------------
// MEMBER ACCESS CHECK
// -----------------------------
async function checkMemberAccess(workspaceId) {
  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", (await supabase.auth.getUser()).data.user.id)
    .single();

  if (error || membership.role !== "member") {
    alert("Access Denied: You cannot access this workspace.");
    window.location.href = "/index";
  }
}

// -----------------------------
// INITIALIZATION
// -----------------------------
export async function initMemberWorkspaceData() {
  const params = new URLSearchParams(window.location.search);
  const workspaceId = params.get("ws");

  if (!workspaceId) {
    window.location.href = "/index";
    return;
  }

  await checkMemberAccess(workspaceId);

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      `*, 
       workspace_tasks(*, profiles:assigned_to (id, full_name, avatar_url)), 
       workspace_members(role, profiles (id, full_name, avatar_url))`,
    )
    .eq("id", workspaceId)
    .single();

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  currentWorkspace = workspace;

  const container = document.getElementById("memberWorkspaceDashboardContent");
  const workspaceName = document.getElementById("workspaceName");

  if (workspaceName) {
    workspaceName.innerHTML = `${workspace.name} <span class="tag">Member</span>`;
  }
document.title = `${workspace.name} | LogHue` ;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (container) {
    container.innerHTML = "";

    //LOAD ASSIGNED TASKS BY DEFAULT

    const myTasks = workspace.workspace_tasks.filter(
      (t) => String(t.assigned_to) === String(user.id),
    );
    loadAssignedTasks(myTasks || [], container);
  }

  
  attachSidebarEvents();
  
  loadedMembers = Array.isArray(workspace.workspace_members)
  ? workspace.workspace_members
  : [workspace.workspace_members];
  
  workspace.workspace_tasks = workspace.workspace_tasks || [];

    openStartDiscussionModal(currentWorkspace, user);
  openLogTaskModal(supabase, workspaceId, user.id);
}

// -----------------------------
// SECTION RENDERER
// -----------------------------
async function renderSection(section, workspace, container) {
  if(!container) return;
  container.innerHTML = "";

 const { data: userData } = await supabase.auth.getUser();
 if (!userData?.user) return null;

 currentUser = userData;

  switch (section) {
    case "myTasks":
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const myTasks = workspace.workspace_tasks.filter(
        (t) => String(t.assigned_to) === String(user.id),
      );

      loadAssignedTasks(myTasks, container);
      break;

    case "allTasks":
      loadAllTasks(workspace.workspace_tasks || [], container);
      break;

    case "members":
      loadMembers(loadedMembers, container);
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

      loadActivities(activities || [], container);
      break;

    case "discussions":
         //Load data
            const { data: discussions, dcnError } = await supabase
              .from("discussions")
              .select(`*, profiles:created_by (full_name, avatar_url)`)
              .eq("workspace_id", workspace.id)
      
            loadDiscussions(discussions || [], container);
      break;
  }
}

export function loadDiscussions(discussions, container) {
  if (!discussions || discussions.length === 0) {
    container.innerHTML = `<p class="placeholderText">No discussions started yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = "Discussions";

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
    viewBtn.classList.add("btn", "btn-sm", "btn-primary");
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

// -----------------------------
// MY TASKS LIST
// -----------------------------
export function loadAssignedTasks(tasks, container) {
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<p class="placeholderText">No tasks assigned yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "My Tasks";

  const grid = document.createElement("div");
  grid.classList.add("container");

  tasks.forEach((tsk) => {
    const card = document.createElement("div");
    card.classList.add("card", "taskCard");

    const taskTitle = document.createElement("h3");
    taskTitle.textContent = tsk.title;

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Description";

    const desc = document.createElement("p");
    desc.textContent = tsk.description;

    details.append(summary, desc);

    const meta = document.createElement("div");
    meta.classList.add("taskMeta");

    const assignee = document.createElement("p");
    assignee.classList.add("meta");
    assignee.textContent = tsk.assigned_to
      ? `Assigned to: Me`
      : "Unassigned";

    const assignedOn = document.createElement("p");
    assignedOn.classList.add("meta");
    assignedOn.textContent = `Assigned on: ${formatDateTime(tsk.created_at)}`;

    meta.append(assignee, assignedOn);

    const viewBtn = document.createElement("button");
    viewBtn.classList.add("btn", "btn-sm", "btn-primary");
    viewBtn.textContent = "View Task";

    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `https://app.loghue.com/task-view?task=${tsk.id}`;
    });

    details.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    card.append(taskTitle, meta, details, viewBtn);
    grid.append(card);
  });

  section.append(title, grid);
  container.append(section);
}

// -----------------------------
// TASK LIST (READ‑ONLY)
// -----------------------------
export function loadAllTasks(tasks, container) {
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<p class="placeholderText">No tasks created yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "All Tasks";

  const grid = document.createElement("div");
  grid.classList.add("container");

  tasks.forEach((tsk) => {
    const card = document.createElement("div");
    card.classList.add("card", "taskCard");

    const taskTitle = document.createElement("h3");
    taskTitle.textContent = tsk.title;

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Description";

    const desc = document.createElement("p");
    desc.textContent = tsk.description;

    details.append(summary, desc);

    const meta = document.createElement("div");
    meta.classList.add("taskMeta");

    const assignee = document.createElement("p");
    assignee.classList.add("meta");
    assignee.textContent = tsk.assigned_to
      ? `Assigned to: ${tsk.profiles.full_name}`
      : "Unassigned";

    const assignedOn = document.createElement("p");
    assignedOn.classList.add("meta");
    assignedOn.textContent = `Assigned on: ${formatDateTime(tsk.created_at)}`;

    meta.append(assignee, assignedOn);

    card.append(taskTitle, meta, details);
    grid.append(card);
  });

  section.append(title, grid);
  container.append(section);
}

// -----------------------------
// MEMBERS LIST (READ‑ONLY)
// -----------------------------
function loadMembers(members, container) {
  if (!members || members.length === 0) {
    container.innerHTML = `<p class="placeholderText">No members found.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "Workspace Members";

  const grid = document.createElement("div");
  grid.classList.add("grid");

  members.forEach((mbr) => {
    const card = document.createElement("div");
    card.classList.add("card", "memberCard");

    const name = document.createElement("h3");
    name.classList.add("memberName");
    name.textContent = mbr.profiles.full_name;

    const tag = document.createElement("span");
    tag.classList.add("tag");
    tag.textContent = mbr.role;

    const avatar = document.createElement("img");
    avatar.classList.add("profileImg");
    avatar.src = mbr.profiles.avatar_url;

    const header = document.createElement("div");
    header.classList.add("cardHeader");
    header.append(tag, avatar, name);

    card.append(header);
    grid.append(card);
  });

  section.append(title, grid);
  container.append(section);
}

// -----------------------------
// ACTIVITIES (READ‑ONLY)
// -----------------------------
export function loadActivities(activities, container) {
  if(sessionState.plan.name === "free" || "Free") {
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
    const avatar = actor?.avatar_url || "https://loghue.com/assets/default-avatar.png";
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
        <a class="btn pageOpenLink btn-sm btn-secondary"
           href="https://app.loghue.com/discussion-view?dcn=${item.id}">
           Open
        </a>
      `
        : "";

    const div = document.createElement("div");
    div.classList.add("activityItem");

    div.innerHTML = `
    <div class="activityHeader">
      <img class="profileImg" src="${avatar}" />
      <span class="actorName">${name} ${label}</span>
    </div>

    <div class="activityBody">${body}</div>

    <div class="activityTime">
      ${new Date(item.created_at).toLocaleString()}
      ${openBtn}
    </div>
  `;

    list.appendChild(div);
  });

  section.append(title, list);
  container.append(section);
}


// -----------------------------
// UTIL
// -----------------------------
export function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


