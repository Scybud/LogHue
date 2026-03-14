import { closeModal } from "../ui.js";
import {
  formatDateTime,
  loadCreatedTasks,
  loadedMembers,
} from "../features/workspace-admin.js";
import { supabase } from "../supabase.js";

export function attachCreateTaskEvent(tasksArr) {
  tasksArr = tasksArr || [];

  const createTaskBtn = document.getElementById("createTaskBtn");
  if (!createTaskBtn) return;

  const assignedTo = document.getElementById("assignToDropdown");
console.log(loadedMembers)
  loadedMembers.forEach((lm) => {
    const options = document.createElement("option")
options.value = lm.id;
options.textContent = lm.name;

assignedTo.prepend(options)
  })

  // When create task button is clicked to create a new task
  createTaskBtn.addEventListener("click", async () => {
    const taskTitle = document.getElementById("taskTitle").value.trim();
    const taskDescription = document
      .getElementById("taskDescription")
      .value.trim();
const assignedToValue = assignedTo.value;

    if (!taskTitle || !taskDescription) {
      alert("Input fields must not be empty");
      return;
    }

    const formattedTDate = formatDateTime(Date.now());

    const taskData = {
      title: taskTitle,
      created_at: formattedTDate,
      status: "in-progress",
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

    if (createdTask.assigned_to === "") {
      taskMeta.textContent = "Unassigned";
      taskCard.append(taskTitleElem, taskMeta, assignToMemberBtn);
    } else {
      taskMeta.textContent = `Assigned to: ${createdTask.assigned_to}`;
      taskCard.append(taskTitleElem, taskMeta);
    }

    // Prepend the new task card to the grid
    const container = document.querySelector(".grid");
    if (container) {
      container.prepend(taskCard);
    }

    // Close the modal after task creation
    closeModal();
  });
}
