// 1. SYSTEM & COMPONENT IMPORTS
import { supabase } from "../supabase.js";

import {
  fetchUserWorkspaces,
  fetchUserGlobalTasks,
} from "../data/workspaceDb.js";
import { sessionReady, sessionState } from "../session.js";

const closeWarningBtn = document.getElementById("closeWarning");
/*
// 2. DOM TARGET CACHING
const upperDashboardContainer = document.getElementById(
  "upperDashboardContainer",
);
const globalTasksContainer = document.getElementById("globalTasksContainer");

// 3. CENTRAL LOCAL STATE MANAGEMENT
let localState = {
  user: null,
  workspaces: [],
  tasks: [],
};

let isLoading = false;

// Handles toggling visual loading indicator state classes across containers
 
function setLoading(state) {
  isLoading = state;
  upperDashboardContainer?.classList.toggle("isLoading", state);
  globalTasksContainer?.classList.toggle("isLoading", state);
}

//Main Initialization Pipeline - Execution Orchestrator
 
export async function renderDashboard() {
  setLoading(true);

  // Await core authentication session resolution
  await sessionReady;
  localState.user = sessionState.user;

  if (!localState.user) return;

  // Render the current profile name cleanly into the header greeting text
  const userNameEl = document.querySelector(".userName");
  if (userNameEl) {
    userNameEl.textContent = sessionState.profile?.full_name || "Developer";
  }

  try {
    // Concurrent parallel background fetch across the workspaceDb pipelines
    const [workspaces, tasks] = await Promise.all([
      fetchUserWorkspaces(localState.user.id),
      fetchUserGlobalTasks(localState.user.id),
    ]);

    // Mutate state with fresh server values
    localState.workspaces = workspaces;
    localState.tasks = tasks;

    // Trigger explicit modular presentation layers
    renderWorkspaceCards();
    renderGlobalTasks();
    handleOnboardingWarning();
  } catch (err) {
    console.error("Dashboard engine rendering pipeline failure:", err);
    if (upperDashboardContainer) {
      upperDashboardContainer.innerHTML = `<p class="text-error">Failed to build system views.</p>`;
    }
  } finally {
    setLoading(false);
  }
}

// Renders the Workspaces Section using custom UI components
 
function renderWorkspaceCards() {
  if (!upperDashboardContainer) return;
  upperDashboardContainer.innerHTML = "";

  const activeWorkspaces = localState.workspaces.filter(
    (ws) => ws.status === "active",
  );

  // Modern action-oriented empty state container
  if (activeWorkspaces.length === 0) {
    upperDashboardContainer.innerHTML = `
      <div class="empty-state-card">
        <h3>No workspaces yet</h3>
        <p>Create your first workspace to start collaborating with your team.</p>
      </div>
    `;
    return;
  }

  // Restore your original layout double-grid wrapper structure
  const div = document.createElement("div");
  div.classList.add("recentContainer", "double-grid");

  // Loop through your full workspace data pool (No more artificial .slice truncation)
  activeWorkspaces.forEach((wsData) => {
    // Construct element via your core feature logic block
    const wsCard = createWorkspaceCardElement(wsData);
    div.append(wsCard);
  });

  // Prepend into container view target element
  upperDashboardContainer.prepend(div);

  // Re-bind click handlers, drop menus, and contextual action events safely
  dropdownClick();
}

//Renders the Cross-Workspace "My Tasks" Aggregator Layout
 
function renderGlobalTasks() {
  if (!globalTasksContainer) return;
  globalTasksContainer.innerHTML = "";

  if (localState.tasks.length === 0) {
    globalTasksContainer.innerHTML = `<p class="placeholderText">No tasks explicitly assigned to you right now.</p>`;
    return;
  }

  const taskList = document.createElement("ul");
  taskList.className = "global-tasks-list";


  localState.tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = "task-item-row";

const taskStatus = task.status.trim().replace(/\s+/g, "");

    item.innerHTML = `
    <a class="global-task-link" href="task-view?task=${task.id}">
    <div class="task-meta-left">
    <!--
    <input type="checkbox" data-task-id="${task.id}" class="task-checkbox">
    -->
    <span class="task-title-text">${escapeHTML(task.title)}</span>
    </div>
    <div>
    <span class="task-context-badge ${taskStatus}">${task.status || "active"}</span>
    <span class="task-context-badge">${escapeHTML(task.workspace?.name || "Workspace")}</span>
    </div>
    </a>
    `;
    taskList.append(item);
  });

  globalTasksContainer.append(taskList);
}
*/

//Handles Onboarding Prompt UI Text Adjustments dynamically

function handleOnboardingWarning() {
  if (sessionState.profile?.onboarded === false) {
    const warningText = document.querySelector(".warningText");
    if (warningText) {
      warningText.innerHTML = `Hi! You are recommended to get started by creating a workspace. <a href="create-workspace">Create workspace</a>`;
    }
  }
}

// Sticky dismiss handling for global notification layout alert boxes

function warningLogic() {
  const warningState = localStorage.getItem("removeWarning");
  const container = document.querySelector(".warningContainer");

  if (!closeWarningBtn || !container) return;

  closeWarningBtn.addEventListener("click", () => {
    localStorage.setItem("removeWarning", "removed");
    container.remove();
  });

  if (warningState) container.remove();
}

//Basic security string sanitizer helper function

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        tag
      ] || tag,
  );
}

// 4. MAIN GLOBAL SYNCHRONOUS RUNTIME INITIALIZATION
warningLogic();
initDashboard();

export async function initDashboard() {
  // Await core authentication session resolution
  await sessionReady;
  const user = sessionState.user;

  if (!user) return;

  // Render the current profile name cleanly into the header greeting text
  const userNameEl = document.querySelector(".userName");
  if (userNameEl) {
    userNameEl.textContent = sessionState.profile?.full_name || "Developer";
  }

  await dashboardSearch(user);

  // Trigger explicit modular presentation layers
  handleOnboardingWarning();
}

async function dashboardSearch(user) {
  const searchInput = document.getElementById("mainSearchInput");
  const resultsContainer = document.getElementById("MainSearchResults");
  const dashboardContainer = document.querySelector(".dashboard-section");
  const createNoteBtn = document.querySelector(".createNoteBtn");

  //HANDLE CREATE NOTE QUICK ACTION
  createNoteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    localStorage.setItem("createNote", "start typing...");

    window.location.href = "notes";
  });

  let isSlideUp = false;

  searchInput.addEventListener("input", async (e) => {
    const value = e.target.value.trim();

    if (!value || value.length < 3) {
      resultsContainer.innerHTML = "";
      if (isSlideUp) {
        dashboardContainer.classList.remove("slide-up");
        isSlideUp = false;
      }
      return;
    }

    if (!isSlideUp) {
      dashboardContainer.classList.add("slide-up");
      isSlideUp = true;
    }

    const { data: workspaceSearch, error: workspaceSearchError } =
      await supabase
        .from("workspace_members")
        .select(
          `
    role,
    workspaces: workspace_id (
      id,
      name
    )
  `,
        )
        .eq("user_id", user.id)
        .ilike("workspaces.name", `%${value}%`)
        .limit(10);

    if (workspaceSearchError) {
      console.error(workspaceSearchError);
      return;
    }

    const { data: tasksSearch, tasksSearchError } = await supabase
      .from("workspace_tasks")
      .select("id, title")
      .ilike("title", `%${value}%`)
      .limit(10);

    const { data: notesSearch, notesSearchError } = await supabase
      .from("personal_notes")
      .select("id, title")
      .ilike("title", `%${value}%`)
      .limit(10);

    if (workspaceSearchError || tasksSearchError || notesSearchError) {
      console.error(
        workspaceSearchError || tasksSearchError || notesSearchError,
      );
      return;
    }

    const workspaceSearchTagged = workspaceSearch
      .filter((w) => w.workspaces) // prevent undefined
      .map((w) => ({
        id: w.workspaces.id,
        name: w.workspaces.name,
        type: "workspace",
        role: w.role,
      }));

    const tasksSearchTagged = tasksSearch.map((t) => ({
      id: t.id,
      title: t.title,
      type: "task",
    }));

    const notesSearchTagged = notesSearch.map((n) => ({
      id: n.id,
      title: n.title,
      type: "note",
    }));

    const searchData = [
      ...workspaceSearchTagged,
      ...tasksSearchTagged,
      ...notesSearchTagged,
    ];

    if (tasksSearchError) {
      console.error(tasksSearchError);
      return;
    }

    renderResults(searchData);
  });

  function renderResults(results) {
    resultsContainer.innerHTML = "";

    const resultsHeader = document.createElement("h2");
    resultsHeader.textContent = "Results";
    resultsContainer.append(resultsHeader);

    if (results.length === 0) {
      resultsContainer.innerHTML = `<p class="tunedText">No results found for "${searchInput.value}"</p>`;
      return;
    }

    results.forEach((result) => {
      const link = searchLink(result);

      const div = document.createElement("div");
      div.classList.add("searchItem");

      const searchTypeLabel = searchType(result);

      div.innerHTML = `
  <a href="${link}">
    <div class="searchType ${result.type}">
      ${searchTypeLabel}
    </div>
    <p>${result.name || result.title}</p>
  </a>
`;

      resultsContainer.append(div);
    });
  }
}

function searchType(result) {
  let type;

  if (result.type === "workspace") {
    type = "Workspace";
  } else if (result.type === "task") {
    type = "Task";
  } else if (result.type === "note") {
    type = "Note";
  }

  return type;
}

function searchLink(result) {
  let link;

  if (
    (result.type === "workspace" && result.role === "admin") ||
    (result.type === "workspace" && result.role === "owner")
  ) {
    link = `workspace-dashboard-admin?ws=${result.id}`;
  } else if (result.type === "workspace" && result.role === "member") {
    link = `workspace-dashboard-member?ws=${result.id}`;
  } else if (result.type === "task") {
    link = `task-view?task=${result.id}`;
  } else if (result.type === "note") {
    link = `notes?note=${result.id}`;
  }

  return link;
}
