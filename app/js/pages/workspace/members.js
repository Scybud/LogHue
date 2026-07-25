import { confirmAction, actionMsg } from "../../utils/modals.js";
import { supabase } from "../../supabase.js";
import {
  PERMISSIONS,
  canRemoveMember as canRemoveMemberPermission,
} from "../../shared/workspace/permissions.js";
import { getUser, getCurrentUserRole, getCurrentWorkspace } from "./state.js";
import { assignMemberTask } from "./tasks.js";

// -------------------------------------------------------------------
// MEMBERS LIST (read only for members, actions for admins/owners)
// -------------------------------------------------------------------
export function loadMembers(members, container) {
  if (!members || members.length === 0) {
    container.innerHTML = `<p class="placeholderText">No members found.</p>`;
    return;
  }

  const currentUserRole = getCurrentUserRole();
  const user = getUser();
  const myPermissions = PERMISSIONS[currentUserRole] || {};

  const section = document.createElement("section");
  section.classList.add("section");
  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = "Workspace Members";
  const docLink = document.createElement("a");
  docLink.classList.add("docLink");
  docLink.href = "https://docs.loghue.com/roles";
  docLink.target = "_blank";
  docLink.rel = "noopener";
  docLink.textContent = "Docs";
  const sectionHeader = document.createElement("div");
  sectionHeader.classList.add("sectionHeader");
  sectionHeader.append(sectionTitle, docLink);

  const divGrid = document.createElement("div");
  divGrid.classList.add("grid");

  members.forEach((mbr) => {
    const memberCard = document.createElement("div");
    memberCard.classList.add("card", "memberCard");

    const memberName = document.createElement("h3");
    memberName.classList.add("memberName");
    memberName.textContent = mbr.profiles.full_name;
    const tag = document.createElement("span");
    tag.classList.add("tag");
    tag.textContent = mbr.role;
    memberName.append(tag);

    const avatar = document.createElement("img");
    avatar.classList.add("profileImg");
    avatar.src = mbr.profiles.avatar_url;
    const profileAvatarContainer = document.createElement("div");
    profileAvatarContainer.classList.add(
      "profileAvatarContainer",
      mbr.profiles.plan.name,
    );
    profileAvatarContainer.append(avatar);

    const cardHeader = document.createElement("div");
    cardHeader.classList.add("cardHeader");
    cardHeader.append(tag, profileAvatarContainer, memberName);
    cardHeader.title = `${mbr.profiles.plan.name} plan member`;

    const adminActions = document.createElement("div");
    adminActions.classList.add("adminActions");

    // Only admins/owners see assignment / removal buttons
    if (myPermissions.assignTasks) {
      const assignBtn = document.createElement("button");
      assignBtn.type = "button";
      assignBtn.id = mbr.profiles.id;
      assignBtn.classList.add("btn", "btn-sm", "btn-primary", "assignTaskBtn");
      assignBtn.textContent = "Assign Task";
      adminActions.appendChild(assignBtn);
    }

    const canRemove = canRemoveMemberPermission(
      currentUserRole,
      mbr.role,
      mbr.user_id === user.id,
    );
    if (canRemove) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.id = mbr.profiles.id;
      removeBtn.classList.add(
        "btn",
        "btn-sm",
        "btn-primary",
        "danger",
        "removeMemberBtn",
      );
      removeBtn.textContent = "Remove member";
      adminActions.appendChild(removeBtn);
    }

    memberCard.append(cardHeader, adminActions);
    divGrid.appendChild(memberCard);
  });

  section.append(sectionHeader, divGrid);
  container.append(section);

  // Attach event listeners only if the buttons exist
  if (myPermissions.assignTasks) assignMemberTask();
  if (document.querySelector(".removeMemberBtn")) removeMember();
}

function removeMember() {
  const btns = document.querySelectorAll(".removeMemberBtn");
  btns.forEach((btn) => {
    if (!btn) return;
    const id = btn.id;
    btn.addEventListener("click", () => {
      confirmAction("Are you sure? Removing this member cannot be undone.", [
        { label: "Cancel", type: "cancel" },
        {
          label: "Remove",
          type: "confirm",
          onClick: () =>
            performMemberRemoval(id, getCurrentWorkspace().id, getUser()),
        },
      ]);
    });
  });
}

async function performMemberRemoval(id, workspaceId, user) {
  if (!PERMISSIONS[getCurrentUserRole()]?.manageMembers) {
    actionMsg("You do not have permission to remove members.", "error");
    return;
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("user_id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error(error);
    actionMsg("Failed to remove member.", "error");
    return;
  }

  actionMsg("Member removed!", "success");
  setTimeout(() => window.location.reload(), 2000);
}
