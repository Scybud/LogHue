// Core onboarding state logic: load/save progress, listen for real app
// events, expose an API for the modal to use.
import { supabase } from "../supabase.js";
import { getStepsForUserType } from "./onboardingSteps.js";

const state = {
  userId: null,
  userType: null,
  steps: {},
  dismissed: false,
  onboarded: false,
  activeWorkspaceId: null,
  listenersBound: false,
};

/**
 * Loads onboarding state for the current user from `profiles`.
 * Call once on app init, before deciding whether to show the modal.
 */
export async function loadOnboardingState(userId) {
  state.userId = userId;

  const { data, error } = await supabase
    .from("profiles")
    .select("onboarded, onboarding_progress")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Failed to load onboarding state:", error);
    return state;
  }

  state.onboarded = data.onboarded;
  state.userType = data.onboarding_progress?.user_type ?? null;
  state.steps = data.onboarding_progress?.steps ?? {};
  state.dismissed = data.onboarding_progress?.dismissed ?? false;
  state.activeWorkspaceId =
    data.onboarding_progress?.active_workspace_id ?? null;

  bindStepListeners();
  return state;
}

/** Whether the modal should render right now. */
export function shouldShowOnboarding() {
  return !state.onboarded && !state.dismissed;
}

/** Sets the user's explicit solo/team choice (onboarding step 1). */
export async function setUserType(userType) {
  state.userType = userType;
  state.steps = {};
  getStepsForUserType(userType).forEach((step) => {
    state.steps[step.id] = false;
  });
  await persist();
  bindStepListeners();
}

/**
 * Marks a step complete. `detail` is the CustomEvent's detail payload —
 * used to capture things like the workspaceId once it exists, so later
 * steps (add member, assign task) know which workspace to act on.
 */
async function markStepComplete(stepId, detail = {}) {
  if (state.steps[stepId]) return; // already done, avoid redundant writes
  state.steps[stepId] = true;

  if (detail.workspaceId) {
    state.activeWorkspaceId = detail.workspaceId;
  }

  const allDone = getStepsForUserType(state.userType)
    .filter((step) => !step.optional)
    .every((step) => state.steps[step.id]);

  if (allDone) state.onboarded = true;

  await persist();
  document.dispatchEvent(
    new CustomEvent("onboarding:step_completed", {
      detail: { stepId, allDone },
    }),
  );
}

/** Skip — hides the modal without marking anything complete. Resumable. */
export async function dismissOnboarding() {
  state.dismissed = true;
  await persist();
}

/** "Finish onboarding" — reopens the modal at current progress. */
export async function reopenOnboarding() {
  state.dismissed = false;
  await persist();
  document.dispatchEvent(new CustomEvent("onboarding:reopen"));
}

/**
 * Listens for the real app events defined in steps.js and marks the
 * matching onboarding step complete when they fire — whether or not
 * the user is currently looking at the modal.
 */
function bindStepListeners() {
  if (state.listenersBound || !state.userType) return;

  getStepsForUserType(state.userType).forEach((step) => {
    document.addEventListener(step.event, (e) =>
      markStepComplete(step.id, e.detail || {}),
    );
  });

  state.listenersBound = true;
}

async function persist() {
  const { error } = await supabase
    .from("profiles")
    .update({
      onboarded: state.onboarded,
      onboarding_progress: {
        user_type: state.userType,
        steps: state.steps,
        dismissed: state.dismissed,
        active_workspace_id: state.activeWorkspaceId,
      },
    })
    .eq("id", state.userId);

  if (error) console.error("Failed to persist onboarding state:", error);
}

export function getOnboardingState() {
  return { ...state };
}