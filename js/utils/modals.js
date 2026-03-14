import { loadComponent } from "../ui.js";
import {initWorkspaces} from "../features/workspaceData.js"
import { loginFuntion } from "../auth/auth.js";
import {attachCreateTaskEvent} from "./modalEvents.js"

export function openCreateTaskModal(workspaceId) {
  const btn = document.getElementById("createTaskOpen");
  if (!btn) return;

if (!workspaceId) return;

    btn.addEventListener("click", async () => {

      await loadComponent(
        "https://loghue.com/components/modals/create-task.html",
        "modalContainer",
      );


      attachCreateTaskEvent(workspaceId);
    }, {once: true});
}

export function openLogTaskModal() {
  const btn = document.getElementById("logTaskOpen");
  if (btn) {
    btn.addEventListener("click", async () => {

      await loadComponent(
        "https://loghue.com/components/modals/log-entry.html",
        "modalContainer",
      );

    });
  }
}

export function openCreateWorkspaceModal() {
  const btn = document.getElementById("createWorkspaceOpen");
  if (btn) {
    btn.addEventListener("click", async () => {

      await loadComponent(
        "https://loghue.com/components/modals/create-workspace.html",
        "modalContainer"
      );

      initWorkspaces();
    
    });
  }
}


function attachLoginModalEvents() {

     const openSignupModalBtn = document.getElementById("openSignupModal");
     if (openSignupModalBtn) {
       openSignupModalBtn.addEventListener("click", async () => {
         await loadComponent(
           "https://loghue.com/components/modals/signup.html",
           "modalContainer",
         );

         attachSignupModalEvents();
         loginFuntion();
       });
     }
}
function attachSignupModalEvents() {
 const openLoginModal = document.getElementById("openLoginModal");
 if (openLoginModal) {
   openLoginModal.addEventListener("click", async () => {
     await loadComponent("https://loghue.com/components/modals/login.html", "modalContainer");

     attachLoginModalEvents()
    });
  }

}


export function openLoginModal() {
  const openLoginModalBtn = document.getElementById("openLoginModal")
  if(openLoginModalBtn) {
    openLoginModalBtn.addEventListener("click", async () => {

      await loadComponent("https://loghue.com/components/modals/login.html", "modalContainer"); 

      attachLoginModalEvents()

    })
  }  
}