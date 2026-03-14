import { closeModal } from "../ui.js";
import {
  loadCreatedTasks,
  loadedMembers,
} from "../features/workspace-admin.js";
import { supabase } from "../supabase.js";

export function attachCreateTaskEvent(workspaceId) {

  const createTaskBtn = document.getElementById("createTaskBtn");
  if (!createTaskBtn) return;

  const assignedTo = document.getElementById("assignToDropdown");
 if (loadedMembers && Array.isArray(loadedMembers)) {
  loadedMembers.forEach((lm) => {
    if (lm.profiles) {
      const option = document.createElement("option");
      option.value = lm.profiles.id;
      option.textContent = lm.profiles.full_name;
      assignedTo.append(option);
    }
  });
}

  // When create task button is clicked to create a new task
  createTaskBtn.addEventListener("click", async () => {
    createTaskBtn.disabled = true;

    const taskTitle = document.getElementById("taskTitle").value.trim();
    const taskDescription = document
      .getElementById("taskDescription")
      .value.trim();
const assignedToValue = assignedTo.value;

    if (!taskTitle || !taskDescription) {
      alert("Input fields must not be empty");
      return;
    }

     // Get the authenticated user ID
    const { data: { user } } = await supabase.auth.getUser();

    const taskData = {
        workspace_id: workspaceId,
        created_by: user.id,
      title: taskTitle,
      status: "created",
      assigned_to: assignedToValue || "", // Assign to empty if no one is selected
      description: taskDescription,
    };

    // Insert task into the database
    const { data, error } = await supabase
      .from("workspace_tasks")
      .insert(taskData)
      .select();

    if (error) {
      console.error(error);
      alert("Failed to create task.");
      return;
    }

    createTaskBtn.disabled = false;

    // Assuming only one task is created, use the first item
    const createdTask = data[0];

    // Render the task in the UI
    const taskCard = document.createElement("div");
    taskCard.classList.add("card", "taskCard");

    const taskTitleElem = document.createElement("h3");
    taskTitleElem.classList.add("taskTitle");
    taskTitleElem.textContent = createdTask.title;

    const taskMeta = document.createElement("p");
    taskMeta.classList.add("taskMeta", "meta");

    const assignToMemberBtn = document.createElement("button");
    assignToMemberBtn.classList.add(
      "btn",
      "btn-primary",
      "btn-sm",
      "assignToMemberBtn",
    );
    assignToMemberBtn.textContent = "Assign to Member";

    const assignee = loadedMembers.find(
      (m) => m.profiles.id === createdTask.assigned_to,
    );
    taskMeta.textContent = assignee
      ? `Assigned to: ${assignee.profiles.full_name}`
      : "Unassigned";

      taskCard.append(taskTitleElem, taskMeta);
if (!assignee) taskCard.append(assignToMemberBtn);

    // Prepend the new task card to the grid
    const container = document.querySelector(".grid");
    if (container) {
      container.prepend(taskCard);
    }

    // Close the modal after task creation
    closeModal();
  });
}
