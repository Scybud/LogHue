import { initPersonalTasks } from "./personalTasks.js";

const tasksSkeleton = document.getElementById("tasksSkeleton");
const personalCreatedTasks = document.getElementById("personalCreatedTasks");

function showTasksSkeleton() {
  tasksSkeleton?.removeAttribute("hidden");
  personalCreatedTasks?.setAttribute("hidden", "");
}

function hideTasksSkeleton() {
  tasksSkeleton?.setAttribute("hidden", "");
  personalCreatedTasks?.removeAttribute("hidden");
}

initPersonalTasks();

hideTasksSkeleton();