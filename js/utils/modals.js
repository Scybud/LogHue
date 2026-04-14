import { closeModal, loadComponent } from "../ui.js";
import {initWorkspaces} from "../features/workspaceData.js"
import { loginFuntion } from "../auth/auth.js";
import {
  attachCreateTaskEvent,
  attachAddMemberEvents,
  attachCreateLogEvent,
  insertTaskLogUpdate,
  populateTaskList,
  attachCreateApiKeyEvents,
} from "./modalEvents.js";
import { supabase } from "../supabase.js";
import { currentWorkspace } from "../features/workspace-member.js";
import { attachStartDiscussionEvent } from "../features/discussions.js";

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
    });
}

export function openLogPersonalTaskModal() {
   const btn = document.getElementById("personalLogTaskOpen");

 if (!btn) return;
 

 btn.addEventListener(
   "click",
   async () => {
     await loadComponent(
       "https://loghue.com/components/modals/personal-log-entry",
       "modalContainer",
     );

     attachCreateLogEvent();
   }
 );
}

export function openAddMemeberModal(workspaceId) {
  const btn = document.getElementById("addMemberOpen");
  if (!btn) return;

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

export function openLogTaskModal(supabase, workspaceId, userId) {
  const btn = document.getElementById("logTaskOpen");
  if (!btn) return;

  btn.addEventListener("click", async () => {
  if (!currentWorkspace || !currentWorkspace.workspace_tasks) {
    console.error("Workspace not loaded yet");
    return;
  }

  
  
  await loadComponent(
    "https://loghue.com/components/modals/log-entry",
    "modalContainer",
  );
  
  // populate using workspace + user.id
  populateTaskList(currentWorkspace, userId);

    const submitBtn = document.getElementById("logTaskUpdate");
    submitBtn.addEventListener("click", () => {
insertTaskLogUpdate(supabase, workspaceId);

    })

  });
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

export function openStartDiscussionModal(currentWorkspace, user) {
  const btn = document.getElementById("startDiscussionOpen");
  if (btn) {
    btn.addEventListener("click", async () => {
      await loadComponent(
        "https://loghue.com/components/modals/start-discussion",
        "modalContainer",
      );

  attachStartDiscussionEvent(currentWorkspace, user)
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

export async function openTransferOwnershipModal(workspace) {
    await loadComponent(
      "https://loghue.com/components/modals/transfer-ownership",
      "modalContainer",
    );
    attachTransferOwnershipEvents(workspace);
  };

  export async function openApiKeyModal(workspace) {
    await loadComponent(
        "https://loghue.com/components/modals/create-api-key",
        "modalContainer",
      );
      attachCreateApiKeyEvents(workspace.id);
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
      a.label === "Delete" || "Remove" ? "danger" : "primary",
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
    "https://loghue.com/components/modals/action-message",
    "actionsMessage",
  );

  const msg = document.querySelector(".modalMessage");
  const actionsMessage = document.getElementById("actionsMessage");

  actionsMessage.classList.remove("success", "error", "warning", "info");

  actionsMessage.classList.add(typeClass);

 actionsMessage.classList.remove("slideIn");
 void actionsMessage.offsetWidth; // <-- reflow trick
 actionsMessage.classList.add("slideIn");
 
  msg.textContent = message;

  if (actionsMessage._timeout) {
    clearTimeout(actionsMessage._timeout);
  }

  // Set new timeout
  actionsMessage._timeout = setTimeout(() => {
    actionsMessage.classList.remove("slideIn");
  }, 5000);
}