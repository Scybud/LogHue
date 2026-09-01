import { supabase } from "../supabase.js";
import { sessionReady, sessionState } from "../session.js";
import { fetchUserNotes } from "../data/notesDb.js";
import { fetchUserTasks } from "../data/tasksDb.js";
import { fetchWorkspaceFromMember } from "../data/workspaceDb.js";
import { escapeHTML } from "./escapeHTML.js";
import { logEvent } from "./logEvent.js";

await sessionReady;

// Simple debounce helper, with cancel so a pending call can be discarded
// (needed so Enter-triggered command handling can't be stomped by a
// debounced search that was already queued from the prior keystroke)
function debounce(fn, delay) {
  let timeoutId;
  const debounced = (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timeoutId);
  return debounced;
}

const user = sessionState.user;

// --- Simple search (existing #searchInput feature) ---
// unchanged, omitted here for length, keep as-is
// --- End simple search ---

const PAGE_ROUTES = {
  home: "dashboard",
  dashboard: "dashboard",
  notes: "notes",
  tasks: "tasks",
  scanhue: "ScanHue",
  settings: "settings",
  workspaces: "my-workspaces",
  archive: "archive",
  billing: "billing",
  docs: "https://docs.loghue.com",
};

function resolveCommand(rawValue) {
  const command = rawValue.trim().slice(1).toLowerCase();
  return PAGE_ROUTES[command] ?? null;
}

export async function initSmartSearch(container = document) {
  const searchInputs = container.querySelectorAll(".mainSearchInput");
  const resultsContainer =
    container.querySelector("#MainSearchResults") ??
    container.querySelector(".mainSearchResultContainer");

  // Scoped to container now, not document, so this only exists (and only
  // gets touched) when the search actually lives inside the dashboard section
  const dashboardContainer = document.querySelector(".dashboard-section");
  const isDashboardScope =
    dashboardContainer && container.contains(dashboardContainer);

  // Scoped to container so repeated Ctrl+K opens don't keep re-attaching
  // listeners to the dashboard's button from inside the palette's init call
  const createNoteBtn = container.querySelector(".createNoteBtn");

  if (!resultsContainer) {
    console.warn(
      "initSmartSearch: results container not found in this scope — aborting init.",
    );
    return;
  }

  if (createNoteBtn) {
    createNoteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      localStorage.setItem("createNote", ".");
      window.location.href = "notes";
    });
  }

  let isSlideUp = false;
  let searchToken = 0;

  const runSearch = async (rawValue) => {
    const value = rawValue.trim();
    const myToken = ++searchToken;

    if (!value || value.length < 3) {
      resultsContainer.innerHTML = "";
      if (isSlideUp && isDashboardScope) {
        dashboardContainer.classList.remove("slide-up");
        isSlideUp = false;
      }
      return;
    }

    if (value.startsWith("/")) {
      resultsContainer.innerHTML = "";
      return;
    }

    if (!isSlideUp && isDashboardScope) {
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

    // .toLowerCase() applied here, the fix that was missing
    const allHandler = ALL_HANDLERS[value.toLowerCase()];
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

      renderResults(tagged, value, true);
      return;
    }

    const { data: workspaceSearch, error: workspaceSearchError } =
      await supabase
        .from("workspace_members")
        .select(`role, workspaces: workspace_id ( id, name )`)
        .eq("user_id", user.id)
        .ilike("workspaces.name", `%${value}%`)
        .limit(10);

    const { data: tasksSearch, error: tasksSearchError } = await supabase
      .from("workspace_tasks")
      .select("id, title")
      .ilike("title", `%${value}%`)
      .limit(10);

    const { data: discussionSearch, error: discussionSearchError } =
      await supabase
        .from("discussions")
        .select("id, title")
        .ilike("title", `%${value}%`)
        .limit(10);

    const { data: notesSearch, error: notesSearchError } = await supabase
      .from("personal_notes")
      .select("id, title")
      .ilike("title", `%${value}%`)
      .limit(10);

    if (myToken !== searchToken) return;

    if (workspaceSearchError || tasksSearchError || notesSearchError) {
      console.error(
        workspaceSearchError || tasksSearchError || notesSearchError,
      );
      return;
    }

    const workspaceSearchTagged = (workspaceSearch || [])
      .filter((w) => w.workspaces)
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

    const discussionSearchTagged = (discussionSearch || []).map((t) => ({
      id: t.id,
      title: t.title,
      type: "discussion",
    }));

    const notesSearchTagged = (notesSearch || []).map((n) => ({
      id: n.id,
      title: n.title,
      type: "note",
    }));

    renderResults(
      [
        ...workspaceSearchTagged,
        ...tasksSearchTagged,
        ...discussionSearchTagged,
        ...notesSearchTagged,
      ],
      value,
      false,
    );
  };

  const debouncedSearch = debounce(runSearch, 200);

  searchInputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      debouncedSearch(e.target.value);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey) return;

      const value = input.value.trim();
      if (!value.startsWith("/")) return;

      e.preventDefault();
      debouncedSearch.cancel(); // stop a pending stale search from wiping what we're about to render

      const route = resolveCommand(value);
      if (route) {
        window.location.href = route;
        return;
      }

      resultsContainer.innerHTML = "";
      const errorMsg = document.createElement("p");
      errorMsg.classList.add("am-text-error", "text-center");
      errorMsg.textContent = `No page named "${value.slice(1)}"`;
      resultsContainer.append(errorMsg);
    });
  });

  function renderResults(results, queryValue, shortcutUsed = false) {
    resultsContainer.innerHTML = "";

    logEvent("search_query_run", {
      query: queryValue,
      result_count: results.length,
      result_types: [...new Set(results.map((r) => r.type))],
      shortcut_used: shortcutUsed,
    });

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
    <div class="searchType ${result.type}">${searchTypeLabel}</div>
    <p>${label}</p>
  </a>
`;
      const linkEl = div.querySelector("a");
      linkEl.addEventListener("click", () => {
        logEvent("search_result_clicked", {
          query: queryValue,
          result_type: result.type,
        });
      });

      resultsContainer.append(div);
    });
  }
}

function searchType(result) {
  if (result.type === "workspace") return "Workspace";
  if (result.type === "task") return "Task";
  if (result.type === "discussion") return "Discussion";
  if (result.type === "note") return "Note";
}

function searchLink(result) {
  if (result.type === "workspace") return `workspace?ws=${result.id}`;
  if (result.type === "task") return `task-view?task=${result.id}`;
  if (result.type === "discussion") return `discussion-view?dcn=${result.id}`;
  if (result.type === "note") return `notes?note=${result.id}`;
}
