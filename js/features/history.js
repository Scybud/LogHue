import {
  savedWorkspaceData,
  workspacesReady,
  formatDateTime,
  
} from "./workspaceData.js";
import {
  supabase
} from "../supabase.js"

export async function renderHistory() {
  await workspacesReady;

  
 const historyContainer = document.querySelector("#historyContainer");
 
 historyContainer.innerHTML = savedWorkspaceData
 .filter((ws) => ws.status === "closed")
 .map(
   (ws) => {
    const formattedTDate = formatDateTime(ws.closed_at);

  
  return `
          <div title="Workspace can only be accessed after restore"  class="workspaceCard card ${ws.status}" data-id="${ws.id}">
  <div class="workspaceCardHeader">
  <div class="workspaceCardHeaderLeft">
  <h3>
  ${ws.name} 
  <span class="tag ${ws.role}">
  ${ws.role}
  </span>
  </h3> 
  <p>
  <span class="meta">Created on: ${formattedTDate}</span>
  </p>
  </div>
  
  </div>
  <details>
           <summary>Description</summary>
           <p>${ws.description}</p>
           </details>
           <button class="btn btn-secondary restoreWorkspaceBtn">Restore</button> 
           </div>`;
 })
   .join("");

   restoreWorkspaceEvent()
}
renderHistory()


//RESTORE WORKSPACE
function restoreWorkspaceEvent() {
  document.addEventListener("click", async (e) => {
const btn = e.target.closest(".restoreWorkspaceBtn");

if(!btn) return;

const ok = confirm("Restore workspace?")
if(!ok) return;

 const workspaceToRestore = btn.closest(".workspaceCard");
    const id = workspaceToRestore.dataset.id;

    const {error} = await supabase.from("workspaces").update({
      status: "active"
    }).eq("id", id);

    if(error) {
      console.error(error)
      alert(error.message)
      return;
    }
  })
}