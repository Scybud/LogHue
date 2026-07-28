import { actionMsg, confirmAction } from "../../utils/modals.js";
import { loadComponent, closeModal } from "../../ui.js";
import { setButtonLoading } from "https://scybud.github.io/scybud-ui/js/ui.js";
import { supabase } from "../../supabase.js";
import { notifyUser } from "../../utils/notifications.js";
import {
  currentWorkspace,
  loadedMembers,
  user,
} from "./state.js";

/**
 * Admin / Owner members list with Assign Task + Remove actions.
 */
export function loadMembersAdmin(members, container) {
  if (!members || members.length === 0) {
    container.innerHTML = `<p class="placeholderText">No members found.</p>`;
    return;
  }

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

    const avatar = document.createElement("img");
    avatar.classList.add("profileImg");
    avatar.src = mbr.profiles.avatar_url;

    const profileAvatarContainer = document.createElement("div");
    profileAvatarContainer.classList.add(
      "profileAvatarContainer",
      `${mbr.profiles.plan?.name || ""}`,
    );
    profileAvatarContainer.append(avatar);

    const cardHeader = document.createElement("div");
    cardHeader.classList.add("cardHeader");
    cardHeader.append(tag, profileAvatarContainer, memberName);
    cardHeader.title = `${mbr.profiles.plan?.name || ""} plan member`;

    const assignTaskBtn = document.createElement("button");
    assignTaskBtn.type = "button";
    assignTaskBtn.id = mbr.profiles.id;
    assignTaskBtn.classList.add(
      "btn",
      "btn-sm",
      "btn-primary",
      "assignTaskBtn",
    );
    assignTaskBtn.textContent = "Assign Task";

    const removeMemberBtn = document.createElement("button");
    removeMemberBtn.type = "button";
    removeMemberBtn.id = mbr.profiles.id;
    removeMemberBtn.classList.add(
      "btn",
      "btn-sm",
      "btn-primary",
      "danger",
      "removeMemberBtn",
    );
    removeMemberBtn.textContent = "Remove member";

    const adminActions = document.createElement("div");
    adminActions.classList.add("adminActions");

    canRemoveMember(mbr, adminActions, assignTaskBtn, removeMemberBtn);

    memberCard.append(cardHeader, adminActions);
    divGrid.append(memberCard);
  });

  section.append(sectionHeader, divGrid);
  container.append(section);

  assignMemberTask();
  removeMember();
}

/**
 * Member view – read-only members list.
 */
export function loadMembersMember(members, container) {
  if (!members || members.length === 0) {
    container.innerHTML = `<p class="placeholderText">No members found.</p>`;
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "Workspace Members";

  const grid = document.createElement("div");
  grid.classList.add("grid");

  members.forEach((mbr) => {
    const card = document.createElement("div");
    card.classList.add("card", "memberCard");

    const name = document.createElement("h3");
    name.classList.add("memberName");
    name.textContent = mbr.profiles.full_name;

    const tag = document.createElement("span");
    tag.classList.add("tag");
    tag.textContent = mbr.role;

    const avatar = document.createElement("img");
    avatar.classList.add("profileImg");
    avatar.src = mbr.profiles.avatar_url;

    const profileAvatarContainer = document.createElement("div");
    profileAvatarContainer.classList.add(
      "profileAvatarContainer",
      `${mbr.profiles.plan?.name || ""}`,
    );
    profileAvatarContainer.append(avatar);

    const header = document.createElement("div");
    header.classList.add("cardHeader");
    header.append(tag, profileAvatarContainer, name);
    header.title = `${mbr.profiles.plan?.name || ""} plan member`;

    card.append(header);
    grid.append(card);
  });

  section.append(title, grid);
  container.append(section);
}

function canRemoveMember(mbr, adminActions, assignTaskBtn, removeMemberBtn) {
  const isSelf = mbr.user_id === user.id || mbr.profiles?.id === user.id;
  const isOwner = mbr.role === "owner";
  const isMember = mbr.role === "member";

  const currentUser = loadedMembers.find(
    (m) => String(m.profiles.id) === String(user.id),
  );
  const currentUserRole = currentUser?.role;
  const currentUserIsOwner = currentUserRole === "owner";
  const currentUserIsAdmin = currentUserRole === "admin";

  let canRemove = false;

  if (!isSelf && !isOwner) {
    if (currentUserIsOwner) {
      canRemove = true;
    } else if (currentUserIsAdmin && isMember) {
      canRemove = true;
    }
  }

  if (canRemove) {
    adminActions.append(assignTaskBtn, removeMemberBtn);
  } else {
    adminActions.append(assignTaskBtn);
  }
}

function assignMemberTask() {
  const btns = document.querySelectorAll(".assignTaskBtn");

  btns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      await loadComponent("../components/modals/create-task", "modalContainer");
      await new Promise(requestAnimationFrame);

      const assignedTo = document.getElementById("assignToDropdown");
      const createTaskBtn = document.getElementById("createTaskBtn");

      if (!assignedTo || !createTaskBtn) {
        console.error("Modal not fully loaded");
        return;
      }

      const memberId = btn.id;
      const member = loadedMembers.find(
        (m) => String(m.profiles.id) === String(memberId),
      );

      assignedTo.innerHTML = "";
      if (member) {
        const option = document.createElement("option");
        option.value = member.profiles.id;
        option.textContent = member.profiles.full_name;
        assignedTo.append(option);
      }

      createTaskBtn.replaceWith(createTaskBtn.cloneNode(true));
      const newCreateTaskBtn = document.getElementById("createTaskBtn");

      newCreateTaskBtn.addEventListener("click", async () => {
        setButtonLoading(newCreateTaskBtn, true);

        const taskTitle = document.getElementById("taskTitle").value.trim();
        const taskDescription = document
          .getElementById("taskDescription")
          .value.trim();
        const assignedToValue = assignedTo.value;

        if (!taskTitle || !taskDescription) {
          alert("Input fields must not be empty");
          setButtonLoading(newCreateTaskBtn, false);
          return;
        }

        const taskData = {
          workspace_id: currentWorkspace.id,
          created_by: user.id,
          title: taskTitle,
          status: "in progress",
          assigned_to: assignedToValue,
          description: taskDescription,
        };

        const { data, error } = await supabase
          .from("workspace_tasks")
          .insert(taskData)
          .select();

        if (error) {
          console.error(error);
          alert("Failed to create task.");
          setButtonLoading(newCreateTaskBtn, false);
          return;
        }

        const createdTask = data[0];

        notifyUser({
          workspaceId: currentWorkspace.id,
          receiverUserId: assignedToValue,
          actorId: user.id,
          type: "task_assigned",
          entityId: createdTask.id,
          entityType: "task",
        });

        // Keep in-memory list in sync
        if (Array.isArray(currentWorkspace.workspace_tasks)) {
          currentWorkspace.workspace_tasks.unshift(createdTask);
        }

        closeModal();
        setButtonLoading(newCreateTaskBtn, false);
        actionMsg("Task created and assigned!", "success");
      });
    });
  });
}

async function removeMember() {
  const btns = document.querySelectorAll(".removeMemberBtn");
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  btns.forEach((btn) => {
    if (!btn) return;
    const id = btn.id;

    btn.addEventListener("click", () => {
      confirmAction(
        "Remove Member",
        "Are you sure? Removing this member from your workspace cannot be undone. All actions related to the user might also be deleted.",
        [
          { label: "Cancel", type: "cancel" },
          {
            label: "Remove",
            type: "confirm",
            onClick: () =>
              performMemberRemoval(id, currentWorkspace.id, authUser),
          },
        ],
      );
    });
  });
}

async function performMemberRemoval(id, workspaceId, authUser) {
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("user_id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error(error);
    actionMsg("Failed to remove member from workspace", "error");
    return;
  }

  actionMsg("Member removed!", "success");
  setTimeout(() => window.location.reload(), 2000);
}
