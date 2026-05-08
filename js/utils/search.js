import { supabase } from "../supabase.js";
import {sessionReady, sessionState} from "../session.js"

await sessionReady;

const user = sessionState.user;

const searchInput = document.getElementById("searchInput");
const resultsContainer = document.getElementById("searchResults");

searchInput.addEventListener("input", async (e) => {
  const value = e.target.value.trim();

  // Prevent empty searches
  if (!value || value.length < 3) {
    resultsContainer.innerHTML = "";
    return;
  }

const { data: workspaceSearch, error: workspaceSearchError } = await supabase
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

        if (workspaceSearchError || tasksSearchError) {
          console.error(workspaceSearchError || tasksSearchError);
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


     const searchData = [
  ...workspaceSearchTagged,
  ...tasksSearchTagged
];


  if (tasksSearchError) {
    console.error(tasksSearchError);
    return;
  }


  renderResults(searchData);
});

function renderResults(results) {
  resultsContainer.innerHTML = "";

  if (results.length === 0) {
    resultsContainer.innerHTML = `<p>No results found</p>`;
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
    <h4>${result.name || result.title}</h4>
  </a>
`;


    resultsContainer.appendChild(div);
  });
}
