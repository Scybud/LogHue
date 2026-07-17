import { supabase } from "../supabase.js";
import { sessionReady, sessionState } from "../session.js";
import { fetchUserNotes } from "../data/notesDb.js";
import { fetchUserTasks } from "../data/tasksDb.js";
import { fetchWorkspaceFromMember } from "../data/workspaceDb.js";
import { escapeHTML } from "./escapeHTML.js";

await sessionReady;

// Simple debounce helper
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

const user = sessionState.user;

// --- Simple search (existing #searchInput feature) ---
// Only wires up if this page actually has the elements — otherwise pages
// without #searchInput (e.g. the command palette) would throw on import.
const searchInput = document.getElementById("searchInput");
const resultsContainer = document.getElementById("searchResults");

if (searchInput && resultsContainer) {
  searchInput.addEventListener("input", async (e) => {
    const value = e.target.value.trim();

    // Prevent empty searches
    if (!value || value.length < 3) {
      resultsContainer.innerHTML = "";
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

    if (workspaceSearchError) {
      console.error(workspaceSearchError);
      return;
    }

    const { data: tasksSearch, error: tasksSearchError } = await supabase
      .from("workspace_tasks")
      .select("id, title")
      .ilike("title", `%${value}%`)
      .limit(10);

    if (tasksSearchError) {
      console.error(tasksSearchError);
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

    const searchData = [...workspaceSearchTagged, ...tasksSearchTagged];

    renderSimpleResults(searchData);
  });
}

function renderSimpleResults(results) {
  resultsContainer.innerHTML = "";

  if (results.length === 0) {
    resultsContainer.innerHTML = `<p class="tunedText">No results found for "${searchInput.value}"</p>`;
    return;
  }

  results.forEach((result) => {
    const link =
      result.type === "workspace"
        ? result.role === "admin" || result.role === "owner"
          ? `workspace-dashboard-admin?ws=${result.id}`
          : `workspace-dashboard-member?ws=${result.id}`
        : `task-view?task=${result.id}`;

    const div = document.createElement("div");
    div.classList.add("searchItem");

    div.innerHTML = `
  <a href="${link}">
    <div class="searchType ${result.type}">
      ${result.type === "workspace" ? "Workspace" : "Task"}
    </div>
    <p>${result.name || result.title}</p>
  </a>
`;

    resultsContainer.appendChild(div);
  });
}
// --- End simple search ---

export async function initSmartSearch() {
  // Support the palette's textarea and the dashboard's input — both use .mainSearchInput
  const searchInputs = document.querySelectorAll(".mainSearchInput");
  const resultsContainer = document.getElementById("MainSearchResults");
  const dashboardContainer = document.querySelector(".dashboard-section"); // null on the palette — guarded below
  const createNoteBtn = document.querySelector(".createNoteBtn");

  if (!resultsContainer) {
    console.warn(
      "initSmartSearch: #MainSearchResults not found on this page — aborting init.",
    );
    return;
  }

  // HANDLE CREATE NOTE QUICK ACTION
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
      if (isSlideUp && dashboardContainer) {
        dashboardContainer.classList.remove("slide-up");
        isSlideUp = false;
      }
      return;
    }

    if (!isSlideUp && dashboardContainer) {
      dashboardContainer.classList.add("slide-up");
      isSlideUp = true;
    }

    const ALL_HANDLERS = {
      "all notes": { fetcher: fetchUserNotes, type: "note" },
      notes: { fetcher: fetchUserNotes, type: "note" },
      "all tasks": { fetcher: fetchUserTasks, type: "task" },
      tasks: { fetcher: fetchUserTasks, type: "task" },
      "all workspaces": {
        fetcher: fetchWorkspaceFromMember,
        type: "workspace",
      },
      workspaces: { fetcher: fetchWorkspaceFromMember, type: "workspace" },
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

  // Bind to every .mainSearchInput on the page (dashboard has one, palette has one —
  // never both at once today, but this doesn't assume that).
  searchInputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      debouncedSearch(e.target.value);
    });
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
