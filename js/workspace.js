import { state } from "./data/state.js";
import {attachSidebarEvents} from "./components/sidebar.js"

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".navBtn");
    if (!btn) return;

    const params = new URLSearchParams(window.location.search);
    const workspaceId = params.get("ws");
    const workspace = state.workspaces.find((w) => w.id === workspaceId);

const container = document.getElementById("adminWorkspaceDashboardContent");
  if (!workspace || !container) return;

    const section = btn.dataset.section;

    renderSection(section, workspace, container);
  });

export async function initWorkspaceData() {
  //Get workspace url
  const params = new URLSearchParams(window.location.search);
  const workspaceId = params.get("ws");
  //Load data
  const workspace = state.workspaces.find((w) => w.id === workspaceId);

  const adminWorkspaceDashboardContent = document.getElementById(
    "adminWorkspaceDashboardContent",
  );


  if (!workspace) {
    window.location.href = "dashboard.html"
    return
  };

  const workspaceName = document.getElementById("workspaceName");

  if (workspace) {
    document.title = workspace.name;
  }

  if (workspace && workspaceName) {
    workspaceName.innerHTML = `${workspace.name} <span class="tag">Admin</span>`;
  }

  if (adminWorkspaceDashboardContent) {
    adminWorkspaceDashboardContent.innerHTML = "";
  }

  if (workspace && adminWorkspaceDashboardContent) {
    loadCreatedTasks(
      workspace.workspace_tasks || [],
      adminWorkspaceDashboardContent,
    );
  }

    attachSidebarEvents();

}

function renderSection(section, workspace, container) {
  container.innerHTML = ""
  switch (section) {
    case "createdTasks":
      loadCreatedTasks(workspace.workspace_tasks || [], container);
      break;

    case "members":
      loadMembers(workspace.members || [], container);
      break;

    case "activities":
      loadActivities(workspace.activity || [], container);
      break;
  }
}


function loadCreatedTasks(tasks, container) {
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<p class="placeholderText">No tasks created yet.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = "Created Tasks";

  const divGrid = document.createElement("div");
  divGrid.classList.add("grid");


  tasks.forEach((tsk) => {
    const taskCard = document.createElement("div");
    taskCard.classList.add("card", "taskCard");

    const taskTitle = document.createElement("h3");
    taskTitle.classList.add("taskTitle");
    taskTitle.textContent = tsk.title;

    const taskMeta = document.createElement("p");
    taskMeta.classList.add("taskMeta", "meta");
    taskMeta.textContent = `Assigned to: ${tsk.assigned_to}`;

    const assignToMemberBtn = document.createElement("button");
    assignToMemberBtn.classList.add(
      "btn",
      "btn-primary",
      "btn-sm",
      "assignToMemberBtn",
    );
    assignToMemberBtn.textContent = "Assign to Member";

    taskCard.append(taskTitle, taskMeta, assignToMemberBtn);

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
  memberName.textContent = mbr.name;
  const tag = document.createElement("span")
  tag.classList.add("tag")
  tag.textContent = mbr.role
memberName.append(tag)


  memberCard.append(memberName);

  divGrid.append(memberCard);
});

section.append(sectionTitle, divGrid);
container.append(section);
}


function formatDateTime(isoString) {
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

  /*
   let savedLogDetails = JSON.parse(localStorage.getItem("logDetails")) || [];
*/

    /*
     localStorage.setItem("logDetails", JSON.stringify(savedLogDetails));
     */

 const taskDetails = document.createElement("details");
 taskDetails.classList.add("loggedActivityContainer");
 taskDetails.dataset.id = log.id;

 const taskSummary = document.createElement("summary");
 taskSummary.title = "click to see details";
 taskSummary.innerHTML = `<span class="personalTaskName">${log.taskValue}</span> 
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
 taskTime.textContent = formatDateTime(log.timestamp);

 const taskNote = document.createElement("p");
 taskNote.textContent = log.noteValue;

 taskDetails.append(taskSummary, taskTime, taskNote);
 return taskDetails
}



function loadActivities(activities, container) {
if (!activities || activities.length === 0) {
  container.innerHTML = `<p class="placeholderText">No activity created yet.</p>`;
  return;
}
const section = document.createElement("section");
section.classList.add("section");

const sectionTitle = document.createElement("h2");
sectionTitle.classList.add("sectionTitle");
sectionTitle.textContent = "Activities";

const divGrid = document.createElement("div");
divGrid.classList.add("container");

activities.forEach((act) => {
  console.log(act.timestamp)
 const taskDetails = createLogElement(act)

 divGrid.append(taskDetails)
});

section.append(sectionTitle, divGrid);
container.append(section);
}



