// 1. SYSTEM & COMPONENT IMPORTS
import { supabase } from "../supabase.js";
import {
  fetchUserWorkspaces,
  fetchUserGlobalTasks,
  fetchWorkspaceFromMember,
} from "../data/workspaceDb.js";
import { sessionReady, sessionState } from "../session.js";
import { fetchUserNotes } from "../data/notesDb.js";
import { fetchUserTasks } from "../data/tasksDb.js";
import { escapeHTML } from "../utils/escapeHTML.js";

const closeWarningBtn = document.getElementById("closeWarning");

// Simple debounce helper
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

//Handles Onboarding Prompt UI Text Adjustments dynamically
function handleOnboardingWarning() {
  if (sessionState.profile?.onboarded === false) {
    const warningText = document.querySelector(".warningText");
    if (warningText) {
      warningText.innerHTML = `Hi! Get started by creating a workspace. <a href="create-workspace">Create workspace</a>`;
    }
  }
}

const searchInput = document.getElementById("mainSearchInput");

const hints = [
  "Search workspaces...",
  "Search notes...",
  "Search tasks...",
  'Try "all workspaces"',
  'Try "all notes"',
  'Try "all tasks"',
  "Press Ctrl + K anywhere",
];

let hintIndex = 0;
let hintInterval;

function changePlaceholder(text) {
  searchInput.classList.add("searchHintFade");

  setTimeout(() => {
    searchInput.placeholder = text;
    searchInput.classList.remove("searchHintFade");
  }, 250);
}

function startHintAnimation() {
  searchInput.placeholder = hints[hintIndex];

  hintInterval = setInterval(() => {
    if (document.activeElement === searchInput) return;
    if (searchInput.value.trim() !== "") return;

    hintIndex = (hintIndex + 1) % hints.length;
    changePlaceholder(hints[hintIndex]);
  }, 3000);
}

startHintAnimation();

// MAIN GLOBAL SYNCHRONOUS RUNTIME INITIALIZATION
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

}

async function dashboardSearch(user) {
  const searchInput = document.getElementById("mainSearchInput");
  const resultsContainer = document.getElementById("MainSearchResults");
  const dashboardContainer = document.querySelector(".dashboard-section");
  const createNoteBtn = document.querySelector(".createNoteBtn");

  //HANDLE CREATE NOTE QUICK ACTION
  if (createNoteBtn) {
    createNoteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      localStorage.setItem("createNote", "start typing...");
      window.location.href = "notes";
    });
  }

  let isSlideUp = false;
  // Guards against out-of-order async responses overwriting newer results
  let searchToken = 0;

  const runSearch = async (rawValue) => {
    const value = rawValue.trim();
    const myToken = ++searchToken;

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

    const ALL_HANDLERS = {
      "all notes": { fetcher: fetchUserNotes, type: "note" },
      "notes": { fetcher: fetchUserNotes, type: "note" },
      "all tasks": { fetcher: fetchUserTasks, type: "task" },
      "tasks": { fetcher: fetchUserTasks, type: "task" },
      "all workspaces": { fetcher: fetchWorkspaceFromMember, type: "workspace" },
      "workspaces": { fetcher: fetchWorkspaceFromMember, type: "workspace" },
    };
 
    const allHandler = ALL_HANDLERS[value];
    if (allHandler) {
      const items = await allHandler.fetcher(user.id);
      if (myToken !== searchToken) return;

      const tagged = items.map((item) => {
        if (allHandler.type === "workspace") {
          return {
            id: item.workspaces.id,
            name: item.workspaces.name,
            role: item.role,
            type: "workspace",
          };
        }
        return {
          id: item.id,
          title: item.title || item.name,
          type: allHandler.type,
        };
      });

      renderResults(tagged, value);
      return;
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

    const { data: tasksSearch, error: tasksSearchError } = await supabase
      .from("workspace_tasks")
      .select("id, title")
      .ilike("title", `%${value}%`)
      .limit(10);

    const { data: notesSearch, error: notesSearchError } = await supabase
      .from("personal_notes")
      .select("id, title")
      .ilike("title", `%${value}%`)
      .limit(10);

    if (myToken !== searchToken) return; // a newer keystroke's search has since started

    if (workspaceSearchError || tasksSearchError || notesSearchError) {
      console.error(
        workspaceSearchError || tasksSearchError || notesSearchError,
      );
      return;
    }

    const workspaceSearchTagged = (workspaceSearch || [])
      .filter((w) => w.workspaces) // prevent undefined
      .map((w) => ({
        id: w.workspaces.id,
        name: w.workspaces.name,
        type: "workspace",
        role: w.role,
      }));

    const tasksSearchTagged = (tasksSearch || []).map((t) => ({
      id: t.id,
      title: t.title,
      type: "task",
    }));

    const notesSearchTagged = (notesSearch || []).map((n) => ({
      id: n.id,
      title: n.title,
      type: "note",
    }));

    const searchData = [
      ...workspaceSearchTagged,
      ...tasksSearchTagged,
      ...notesSearchTagged,
    ];

    renderResults(searchData, value);
  };

  const debouncedSearch = debounce(runSearch, 200);

  searchInput.addEventListener("input", (e) => {
    debouncedSearch(e.target.value);
  });

  function renderResults(results, queryValue) {
    resultsContainer.innerHTML = "";

    const resultsHeader = document.createElement("h2");
    resultsHeader.textContent = "Results";
    resultsContainer.append(resultsHeader);

    if (results.length === 0) {
      const noResults = document.createElement("p");
      noResults.classList.add("tunedText");
      noResults.textContent = `No results found for "${queryValue}"`;
      resultsContainer.append(noResults);
      return;
    }

    results.forEach((result) => {
      const link = searchLink(result);
      const label = escapeHTML(result.name || result.title);
      const searchTypeLabel = searchType(result);

      const div = document.createElement("div");
      div.classList.add("searchItem");

      div.innerHTML = `
  <a href="${escapeHTML(link)}">
    <div class="searchType ${result.type}">
      ${searchTypeLabel}
    </div>
    <p>${label}</p>
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

   if (result.type === "workspace") {
    link = `workspace?ws=${result.id}`;
  } else if (result.type === "task") {
    link = `task-view?task=${result.id}`;
  } else if (result.type === "note") {
    link = `notes?note=${result.id}`;
  }

  return link;
}
