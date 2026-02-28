import { closeModal } from "../ui.js";
import { formatDateTime, loadCreatedTasks } from "../workspace.js";

export function attachCreateTaskEvent(tasksArr) {
  tasksArr = tasksArr || [];

  const createTaskBtn = document.getElementById("createTaskBtn");
  if (!createTaskBtn) return;

  //When create task button is clicked to create new task
  createTaskBtn.addEventListener("click", () => {
    const taskTitle = document.getElementById("taskTitle").value.trim();
    const taskDescription = document
      .getElementById("taskDescription")
      .value.trim();
    const perasonAssigned = document.getElementById("assignToDropdown").value;

    if (!taskTitle || !taskDescription) {
      alert("Input field must not be empty");
      return;
    }

    const formattedTDate = formatDateTime(Date.now());

    const taskData = {
      id: crypto.randomUUID(),
      title: taskTitle,
      created_at: formattedTDate,
      status: "in-progress",
      assigned_to: perasonAssigned,
      description: taskDescription,
    };

    tasksArr.unshift(taskData);

//RENDER TASK IN THE UI
     tasksArr.forEach((tsk) => {
       const taskCard = document.createElement("div");
       taskCard.classList.add("card", "taskCard");

       const taskTitle = document.createElement("h3");
       taskTitle.classList.add("taskTitle");
       taskTitle.textContent = tsk.title;

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

       if (tsk.assigned_to === "") {
         taskMeta.textContent = `Unassigned`;
         taskCard.append(taskTitle, taskMeta, assignToMemberBtn);
       } else {
         taskMeta.textContent = `Assigned to: ${tsk.assigned_to}`;
         taskCard.append(taskTitle, taskMeta);
       }

       document.querySelector(".grid").prepend(taskCard);
     });


    closeModal();
  });
}
