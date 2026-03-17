import { closeModal, loadComponent } from "../ui.js";
import {initWorkspaces} from "../features/workspaceData.js"
import { loginFuntion } from "../auth/auth.js";
import { attachCreateTaskEvent, attachAddMemberEvents } from "./modalEvents.js";

export function openCreateTaskModal(workspaceId) {
  const btn = document.getElementById("createTaskOpen");
  if (!btn) return;

if (!workspaceId) return;

    btn.addEventListener("click", async () => {

      await loadComponent(
        "https://loghue.com/components/modals/create-task",
        "modalContainer",
      );


      attachCreateTaskEvent(workspaceId);
    }, {once: true});
}

export function openAddMemeberModal(workspaceId) {
  const btn = document.getElementById("addMemberOpen");
  if (!btn) return;

  // Remove { once: true } so the button works every time
  btn.onclick = async () => {

    await loadComponent(
      "https://loghue.com/components/modals/add-member",
      "modalContainer",
    );

    // Give the DOM a tiny heartbeat to settle, then attach events
    setTimeout(() => {
      attachAddMemberEvents(workspaceId);
    }, 10);
  };
}

export function openLogTaskModal() {
  const btn = document.getElementById("logTaskOpen");
  if (btn) {
    btn.addEventListener("click", async () => {

      await loadComponent(
        "https://loghue.com/components/modals/log-entry",
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
        "https://loghue.com/components/modals/create-workspace",
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
           "https://loghue.com/components/modals/signup",
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
     await loadComponent("https://loghue.com/components/modals/login", "modalContainer");

     attachLoginModalEvents()
    });
  }

}


export function openLoginModal() {
  const openLoginModalBtn = document.getElementById("openLoginModal")
  if(openLoginModalBtn) {
    openLoginModalBtn.addEventListener("click", async () => {

      await loadComponent("https://loghue.com/components/modals/login", "modalContainer"); 

      attachLoginModalEvents()

    })
  }  
}

export async function confirmAction(message, actions = []) {
  // Load modal only when needed
  await loadComponent(
    "https://loghue.com/components/modals/confirm-action",
    "modalContainer",
  );

  const msg = document.querySelector(".modalMessage");
  const actionsBox = document.querySelector(".modalActions");

  msg.textContent = message;
  actionsBox.innerHTML = "";

  // Normalize single action into array
  const normalized = Array.isArray(actions) ? actions : [actions];

  normalized.forEach((a) => {
    const btn = document.createElement("button");
    btn.textContent = a.label;
    btn.id = a.type;
    btn.classList.add(
      "btn",
      "btn-sm",
      a.type === "confirm" ? "primary" : "secondary",
    );

    btn.onclick = () => {
      closeModal();
      a.onClick && a.onClick();
    };

    actionsBox.appendChild(btn);
  });
}

export async function actionMsg(message, typeClass) {
  // Load modal only when needed
  await loadComponent(
    "https://loghue.com/components/modals/action-message.html",
    "actionsMessage",
  );

  const msg = document.querySelector(".modalMessage");
const actionsMessage = document.getElementById("actionsMessage");

  msg.textContent = message;
actionsMessage.classList.add("slideIn", typeClass)

setTimeout(() => {
actionsMessage.classList.remove("slideIn");

}, 5000)
}