import { supabase } from "../supabase.js";

const searchInput = document.getElementById("searchInput");
const resultsContainer = document.getElementById("searchResults");

searchInput.addEventListener("input", async (e) => {
  const value = e.target.value.trim();

  // Prevent empty searches
  if (!value) {
    resultsContainer.innerHTML = "";
    return;
  }

  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name")
    .ilike("name", `%${value}%`)
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }

  renderResults(data);
});

function renderResults(results) {
  resultsContainer.innerHTML = "";

  if (results.length === 0) {
    resultsContainer.innerHTML = `<p>No results found</p>`;
    return;
  }

  results.forEach((workspace) => {
    const div = document.createElement("div");
div.classList.add("searchItem");

    div.innerHTML = `
            <h4>${workspace.name}</h4>
    `;

    resultsContainer.appendChild(div);
  });
}
