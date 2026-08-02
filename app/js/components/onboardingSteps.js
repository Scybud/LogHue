// Onboarding step definitions.
// `event` must match the CustomEvent name dispatched in the real
// creation/assignment/invite code paths (see integration notes in README).
// `cta.action` maps to a handler wired in onboarding-modal.js.

export const ONBOARDING_STEPS = {
  solo: [
    {
      id: "create_task",
      label: "Create a task",
      description:
        "Add your first task to keep track of what you're working on.",
      event: "onboarding:task_created",
      cta: { label: "Create a task", action: "open_personal_task_modal" },
    },
    {
      id: "write_note",
      label: "Write a note",
      description: "Capture an idea, a link, or anything you want to remember.",
      event: "onboarding:note_created",
      cta: { label: "Write a note", action: "go_to_notes" },
    },
  ],
  team: [
    {
      id: "create_workspace",
      label: "Create a workspace",
      description: "Workspaces are where you and your team collaborate.",
      event: "onboarding:workspace_created",
      cta: { label: "Create a workspace", action: "open_workspace_modal" },
    },
    {
      id: "add_member",
      label: "Add a member",
      description: "Invite someone to join your workspace.",
      event: "onboarding:member_invited",
      cta: { label: "Invite a member", action: "open_invite_modal" },
    },
    {
      id: "assign_task",
      label: "Assign a task",
      description: "Create a task and assign it to a member.",
      event: "onboarding:task_assigned",
      cta: { label: "Assign a task", action: "open_task_modal" },
      optional: true,
    },
  ],
};

export function getStepsForUserType(userType) {
  return ONBOARDING_STEPS[userType] || [];
}
