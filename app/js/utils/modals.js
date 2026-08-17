import { closeModal, loadComponent } from "../ui.js";
import { initWorkspaces } from "../features/workspaceData.js";
import { loginFuntion } from "../auth/auth.js";
import {
  attachCreateTaskEvent,
  attachAddMemberEvents,
  attachCreatePersonalTaskEvent,
  insertTaskLogUpdate,
  populateTaskList,
  attachCreateApiKeyEvents,
  attachTransferOwnershipEvents,
} from "./modalEvents.js";
import { supabase } from "../supabase.js";
import { workspace } from "../pages/workspace/index.js";
import { attachStartDiscussionEvent } from "../pages/workspace/discussions.js";
import { sessionState } from "../session.js";

// ---------------------------------------------------------------------------
// Direct-invoke versions — load the component and attach its events
// immediately, without requiring a pre-existing DOM trigger button.
// Used by onboarding CTAs, and reused internally by the button-bound
// open* functions below so there's one source of truth per modal.
// ---------------------------------------------------------------------------

export async function openCreateTaskModalDirect(workspaceId) {
  if (!workspaceId) return;
  await loadComponent("../components/modals/create-task", "modalContainer");
  attachCreateTaskEvent(workspaceId);
}

export async function openPersonalTaskModalDirect() {
  await loadComponent(
    "../components/modals/personal-task-entry",
    "modalContainer",
  );
  await attachCreatePersonalTaskEvent();
}

export async function openAddMemberModalDirect(workspaceId) {
  if (!workspaceId) return;
  await loadComponent("../components/modals/add-member", "modalContainer");
  setTimeout(() => {
    attachAddMemberEvents(workspaceId);
  }, 10);
}

export async function openCreateWorkspaceModalDirect() {
  await loadComponent(
    "../components/modals/create-workspace",
    "modalContainer",
  );
  await initWorkspaces();
}

// ---------------------------------------------------------------------------
// Button-bound versions — unchanged behavior, now delegating to the
// Direct versions above instead of duplicating the load+attach logic.
// ---------------------------------------------------------------------------

export function openCreateTaskModal(workspaceId) {
  const btn = document.getElementById("createTaskOpen");
  if (!btn) return;
  if (!workspaceId) return;

  btn.addEventListener("click", () => openCreateTaskModalDirect(workspaceId));
}

export function openLogPersonalTaskModal() {
  const btn = document.getElementById("personalLogTaskOpen");
  if (!btn) return;

  btn.addEventListener("click", () => openPersonalTaskModalDirect());
}

export function openAddMemeberModal(workspaceId) {
  const btn = document.getElementById("addMemberOpen");
  if (!btn) return;

  btn.onclick = () => openAddMemberModalDirect(workspaceId);
}

export function openLogTaskModal(supabase, workspaceId, userId) {
  const btn = document.getElementById("logTaskOpen");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (!workspace || !workspace.workspace_tasks) {
      console.error("Workspace not loaded yet");
      return;
    }

    await loadComponent("../components/modals/log-entry", "modalContainer");

    // populate using workspace + user.id
    await populateTaskList(workspace, userId);

    const submitBtn = document.getElementById("logTaskUpdate");
    submitBtn.addEventListener("click", () => {
      insertTaskLogUpdate(supabase, workspaceId);
    });
  });
}

export function openCreateWorkspaceModal() {
  const btns = document.querySelectorAll(".createWorkspaceOpen");
  btns.forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", () => openCreateWorkspaceModalDirect());
    }
  });
}

export function openStartDiscussionModal(workspace, user) {
  const btn = document.getElementById("startDiscussionOpen");
  if (btn) {
    btn.addEventListener("click", async () => {

        const planName = (sessionState?.plan?.name || "").toLowerCase();
        if (planName === "free") {
          openUpgradeModal("discussions");
          return;
        }

      await loadComponent(
        "../components/modals/start-discussion",
        "modalContainer",
      );

      attachStartDiscussionEvent(workspace, user);
    });
  }
}

function attachLoginModalEvents() {
  const openSignupModalBtn = document.getElementById("openSignupModal");
  if (openSignupModalBtn) {
    openSignupModalBtn.addEventListener("click", async () => {
      await loadComponent("../components/modals/signup", "modalContainer");

      attachSignupModalEvents();
      loginFuntion();
    });
  }
}
function attachSignupModalEvents() {
  const openLoginModal = document.getElementById("openLoginModal");
  if (openLoginModal) {
    openLoginModal.addEventListener("click", async () => {
      await loadComponent("../components/modals/login", "modalContainer");

      attachLoginModalEvents();
    });
  }
}

export function openLoginModal() {
  const openLoginModalBtn = document.getElementById("openLoginModal");
  if (openLoginModalBtn) {
    openLoginModalBtn.addEventListener("click", async () => {
      await loadComponent("../components/modals/login", "modalContainer");

      attachLoginModalEvents();
    });
  }
}

export async function openTransferOwnershipModal(workspace) {
  await loadComponent(
    "../components/modals/transfer-ownership",
    "modalContainer",
  );
  attachTransferOwnershipEvents(workspace);
}

export async function openApiKeyModal(workspace) {
  await loadComponent("../components/modals/create-api-key", "modalContainer");
  attachCreateApiKeyEvents(workspace.id);
}

export async function confirmAction(header, message, actions = []) {
  // Load modal only when needed
  await loadComponent("../components/modals/confirm-action", "modalContainer");

  const msg = document.querySelector(".modalMessage");
  const msgHeader = document.querySelector(".modalHeader");
  const actionsBox = document.querySelector(".modalActions");

  msgHeader.textContent = header || "";
  msg.textContent = message || "";
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
      a.label === "Delete" || a.label === "Remove"
        ? "danger"
        : a.type === "confirm"
          ? "btn-primary"
          : "secondary",
    );

   btn.onclick = () => {
     closeModal();

     if (a.type === "cancel") {
       return;
     }

     a.onClick && a.onClick();
   };

    actionsBox.appendChild(btn);
  });
}

export async function actionMsg(message, typeClass) {
  // Load modal only when needed
  await loadComponent("/components/modals/action-message", "actionsMessage");

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


const UPGRADE_URL =
  "/pages/billing/upgrade?plan=e06ed82b-037b-4fac-bbec-94d761f1cdd5";

const PRO_FEATURE_COPY = {
  discussions: {
    title: "Workspace discussions are a Pro feature",
    description:
      "Start threaded discussions with your team, keep context attached to the work.",
    features: ["Unlimited workspace discussions", "Full history retained"],
  },
  exportDocx: {
    title: "DOCX export is a Pro features",
    description: "Export notes as PDF, HTML or DOCX to share outside LogHue.",
    features: ["PDF export", "DOCX export", "HTML rxport"],
  },
  exportPdf: {
    title: "PDF export is a Pro features",
    description: "Export notes as PDF, HTML or DOCX to share outside LogHue.",
    features: ["PDF export", "DOCX export", "HTML rxport"],
  },
  exportHtml: {
    title: "HTML export is a Pro features",
    description: "Export notes as PDF, HTML or DOCX to share outside LogHue.",
    features: ["PDF export", "DOCX export", "HTML rxport"],
  },
  workspaceReminders: {
    title: "Workspace task reminders are a Pro feature",
    description:
      "Get email and push reminders before workspace task deadlines.",
    features: ["Email reminders", "Push notifications"],
  },
  unlimitedWorkspaces: {
    title: "You've hit the Free plan workspace limit",
    description: "Upgrade to Pro for unlimited workspaces.",
    features: ["Unlimited workspaces", "Unlimited members per workspace"],
  },
  memberLimit: {
    title: "You've hit the Free plan member limit",
    description: "Upgrade to Pro to add more members to this workspace.",
    features: ["Unlimited members per workspace"],
  },
  docStorage: {
    title: "File size too large for your Free plan storage limit",
    description: "Upgrade to Pro for more document upload space.",
    features: ["10MB per account", "200MB shared workspace cap"],
  },
  activityLogs: {
    title: "Activity logs are a Pro feature",
    description:
      "See a full history of changes and actions across your workspace.",
    features: ["Full workspace activity history"],
  },
};

export async function openUpgradeModal(featureKey, customCopy = null) {
  await loadComponent("../components/modals/upgrade-modal", "modalContainer");

  const copy = customCopy ||
    PRO_FEATURE_COPY[featureKey] || {
      title: "This is a Pro feature",
      description: "Upgrade to Pro to unlock this and more.",
      features: [],
    };

  document.getElementById("upgradeModalTitle").textContent = copy.title;
  document.getElementById("upgradeModalDescription").textContent =
    copy.description;

  const featuresList = document.getElementById("upgradeModalFeatures");
  featuresList.innerHTML = "";
  copy.features.forEach((f) => {
    const li = document.createElement("li");
    li.textContent = f;
    featuresList.appendChild(li);
  });


  document
    .getElementById("upgradeModalDismiss")
    .addEventListener("click", closeModal, { once: true });
  document.getElementById("upgradeModalUpgrade").addEventListener(
    "click",
    () => {
      window.location.href = UPGRADE_URL;
    },
    { once: true },
  );
}