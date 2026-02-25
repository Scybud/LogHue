import { loadComponent } from "../ui.js";
import {initWorkspaces} from "../features/workspaceData.js"
import { loginFuntion } from "../auth.js";

export function openCreateTaskModal() {
  const btn = document.getElementById("createTaskOpen");

  if (btn) {
    btn.addEventListener("click", async () => {

      await loadComponent(
        "../components/modals/create-task.html",
        "modalContainer",
      );
    });
  }
}

export function openLogTaskModal() {
  const btn = document.getElementById("logTaskOpen");
  if (btn) {
    btn.addEventListener("click", async () => {

      await loadComponent(
        "../components/modals/log-entry.html",
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
        "../components/modals/create-workspace.html",
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
           "components/modals/signup.html",
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
     await loadComponent("components/modals/login.html", "modalContainer");

     attachLoginModalEvents()
    });
  }

}


export function openLoginModal() {
  const openLoginModalBtn = document.getElementById("openLoginModal")
  if(openLoginModalBtn) {
    openLoginModalBtn.addEventListener("click", async () => {

      await loadComponent("components/modals/login.html", "modalContainer"); 

      attachLoginModalEvents()

    })
  }  
}