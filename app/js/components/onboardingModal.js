import {
  loadOnboardingState,
  shouldShowOnboarding,
  setUserType,
  dismissOnboarding,
  reopenOnboarding,
  markStepAttempted,
  getOnboardingState,
} from "./onboarding.js";
import { getStepsForUserType } from "./onboardingSteps.js";
import {
  openPersonalTaskModalDirect,
  openCreateWorkspaceModalDirect,
  openAddMemberModalDirect,
  openCreateTaskModalDirect,
  actionMsg,
} from "../utils/modals.js";

const MODAL_ID = "onboarding-modal";
// NOTE: confirm this route. Guessed to match the app's other query-param
// style routes (workspace?ws=, task-view?task=). Adjust if wrong.
const NOTES_PAGE_ROUTE = "notes?new=1";

let overlayHiddenForInnerModal = false;
let modalContainerObserver = null;

/**
 * Call once after auth resolves. Loads state, and mounts the modal
 * if the user hasn't finished or dismissed onboarding.
 */
export async function initOnboarding(userId) {
  await loadOnboardingState(userId);

  // A CTA that navigates (e.g. "write a note") sets this right before
  // leaving the page, so the destination page doesn't immediately show
  // the full-screen modal on top of what the user is trying to do.
  const suppressed = sessionStorage.getItem("onboarding:suppress_next_mount") === "true";
  sessionStorage.removeItem("onboarding:suppress_next_mount");

  if (shouldShowOnboarding() && !suppressed) {
    mountModal();
  } else {
    const { onboarded, dismissed } = getOnboardingState();
    if (!onboarded && dismissed) renderIncompleteIndicator();
  }

  document.addEventListener("onboarding:reopen", () => {
    removeIncompleteIndicator();
    mountModal();
  });

  document.addEventListener("onboarding:step_completed", (e) => {
    if (e.detail?.allDone) {
      removeIncompleteIndicator();
      unmountModal();
      actionMsg("You're all set! Onboarding complete.", "success");
      return;
    }

    if (document.getElementById(MODAL_ID)) {
      renderContent();
      return;
    }
    // No overlay mounted — most likely we're on a page (like notes.js)
    // that a CTA navigated to. Surface progress without blocking
    // whatever the user is actively doing on this page.
    actionMsg("Nice, that's done. Reopen onboarding anytime from settings.", "success");
  });
}

const INDICATOR_ID = "onboarding-indicator";

/**
 * A small persistent pill shown after skip, so "not finished" stays
 * visible instead of silently disappearing until settings is checked.
 * Default placement: fixed bottom-left. Swap for a sidebar/nav slot
 * once you tell me where it should actually live in your layout.
 */
function renderIncompleteIndicator() {
  if (document.getElementById(INDICATOR_ID)) return;

  const pill = document.createElement("button");
  pill.id = INDICATOR_ID;
  pill.className = "onboarding-indicator";
  pill.type = "button";
  pill.textContent = "Finish setup";
  pill.addEventListener("click", async () => {
    removeIncompleteIndicator();
    await reopenOnboarding();
  });

  document.body.appendChild(pill);
}

function removeIncompleteIndicator() {
  const pill = document.getElementById(INDICATOR_ID);
  if (pill) pill.remove();
}

function mountModal() {
  if (document.getElementById(MODAL_ID)) return; // already open

  const overlay = document.createElement("div");
  overlay.id = MODAL_ID;
  overlay.className = "onboarding-overlay";
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  renderContent();
  watchModalContainer();
}

function unmountModal() {
  const overlay = document.getElementById(MODAL_ID);
  if (overlay) overlay.remove();
  document.body.style.overflow = "";
  overlayHiddenForInnerModal = false;

  if (modalContainerObserver) {
    modalContainerObserver.disconnect();
    modalContainerObserver = null;
  }
}

function renderContent() {
  const overlay = document.getElementById(MODAL_ID);
  if (!overlay) return;

  const { userType } = getOnboardingState();
  overlay.innerHTML = userType ? renderStepsView() : renderUserTypeChoice();
  bindOverlayEvents(overlay);
}

function renderUserTypeChoice() {
  return `
    <div class="onboarding-panel onboarding-panel--choice">
      <button class="onboarding-skip" data-action="skip" aria-label="Skip onboarding">Skip</button>
      <h1>Welcome to LogHue</h1>
      <p class="onboarding-subtitle">How are you planning to use it?</p>
      <div class="onboarding-choice-grid">
        <button class="onboarding-choice-card" data-action="choose-solo">
          <span class="onboarding-choice-title">Just me</span>
          <span class="onboarding-choice-desc">Personal tasks and notes, share a workspace when you need to.</span>
        </button>
        <button class="onboarding-choice-card" data-action="choose-team">
          <span class="onboarding-choice-title">Me and a team</span>
          <span class="onboarding-choice-desc">Set up a workspace and start assigning work right away.</span>
        </button>
      </div>
    </div>
  `;
}

function renderStepsView() {
  const { userType, steps } = getOnboardingState();
  const stepDefs = getStepsForUserType(userType);
  const doneCount = stepDefs.filter((s) => steps[s.id]).length;
  const current = stepDefs.find((s) => !steps[s.id]) || stepDefs[stepDefs.length - 1];

  const asideItems = stepDefs.map((step) => `
    <li class="onboarding-aside-item ${steps[step.id] ? "is-done" : ""} ${step.id === current.id ? "is-current" : ""}">
      <span class="onboarding-aside-check">${steps[step.id] ? "&#10003;" : ""}</span>
      <span>${step.label}</span>
    </li>
  `).join("");

  return `
    <div class="onboarding-panel">
      <button class="onboarding-skip" data-action="skip" aria-label="Skip onboarding">Skip</button>
      <aside class="onboarding-aside">
        <p class="onboarding-aside-progress">${doneCount} of ${stepDefs.length} done</p>
        <ul>${asideItems}</ul>
      </aside>
      <div class="onboarding-main">
        <h1>${current.label}</h1>
        <p class="onboarding-subtitle">${current.description}</p>
        <button class="onboarding-cta" data-action="${current.cta.action}" data-step-id="${current.id}">${current.cta.label}</button>
      </div>
    </div>
  `;
}

function bindOverlayEvents(overlay) {
  overlay.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", async (e) => {
      const action = e.currentTarget.dataset.action;

      if (action === "skip") {
        await dismissOnboarding();
        unmountModal();
        renderIncompleteIndicator();
        return;
      }

      if (action === "choose-solo") {
        await setUserType("solo");
        renderContent();
        return;
      }

      if (action === "choose-team") {
        await setUserType("team");
        renderContent();
        return;
      }

      const stepId = e.currentTarget.dataset.stepId;
      if (stepId) {
        const { userType } = getOnboardingState();
        const stepDef = getStepsForUserType(userType).find((s) => s.id === stepId);
        // Optional steps finish onboarding on the first attempt, even
        // before (or regardless of) the underlying action actually
        // succeeding — see markStepAttempted for why.
        if (stepDef?.optional) {
          await markStepAttempted(stepId);
        }
      }

      await runCta(action);
    });
  });
}

/**
 * Runs the actual CTA. Modal-based steps hide this overlay first so the
 * real app modal is visible, then rely on watchModalContainer() to bring
 * it back once that modal closes (success or cancel, either way).
 */
async function runCta(action) {
  const { activeWorkspaceId } = getOnboardingState();

  if (action === "go_to_notes") {
    // Full page, not a modal — navigate directly, but suppress the
    // overlay from immediately remounting on top of the editor.
    sessionStorage.setItem("onboarding:suppress_next_mount", "true");
    window.location.href = NOTES_PAGE_ROUTE;
    return;
  }

  hideOverlayForInnerModal();

  if (action === "open_personal_task_modal") {
    await openPersonalTaskModalDirect();
    return;
  }

  if (action === "open_workspace_modal") {
    await openCreateWorkspaceModalDirect();
    return;
  }

  if (action === "open_invite_modal") {
    if (!activeWorkspaceId) {
      showOverlayAfterInnerModal();
      console.error("No active workspace id — create a workspace before inviting a member.");
      return;
    }
    await openAddMemberModalDirect(activeWorkspaceId);
    return;
  }

  if (action === "open_task_modal") {
    if (!activeWorkspaceId) {
      showOverlayAfterInnerModal();
      console.error("No active workspace id — create a workspace before assigning a task.");
      return;
    }
    await openCreateTaskModalDirect(activeWorkspaceId);
    return;
  }
}

function hideOverlayForInnerModal() {
  const overlay = document.getElementById(MODAL_ID);
  if (!overlay) return;
  overlay.style.display = "none";
  overlayHiddenForInnerModal = true;
}

function showOverlayAfterInnerModal() {
  const overlay = document.getElementById(MODAL_ID);
  if (!overlay || !overlayHiddenForInnerModal) return;

  overlayHiddenForInnerModal = false;

  // Onboarding may have finished while the overlay was hidden behind
  // the inner modal (e.g. inviting a member completed the required
  // team steps) — don't resurrect it in that case.
  if (getOnboardingState().onboarded) {
    unmountModal();
    return;
  }

  overlay.style.display = "flex";
  renderContent(); // pick up whatever step actually completed
}

/**
 * Watches #modalContainer for the inner app modal closing (success OR
 * cancel) and brings the onboarding overlay back either way.
 */
function watchModalContainer() {
  const modalContainer = document.getElementById("modalContainer");
  if (!modalContainer) return;

  modalContainerObserver = new MutationObserver(() => {
    if (modalContainer.children.length === 0 && overlayHiddenForInnerModal) {
      showOverlayAfterInnerModal();
    }
  });
  modalContainerObserver.observe(modalContainer, { childList: true });
}

export { unmountModal };