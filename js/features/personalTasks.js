import { personalLogInputContainerPanelToggle } from "../utils/toggle.js";
import {dataCount} from "../utils.js"
import { state } from "../data/state.js";

let taskEl
let timeEl
let noteEl
let personalCreatedLogs
let logTaskBtn
let loggedTasksCount

let savedLogDetails = []


export function initPersonalTasks() {

    taskEl = document.getElementById("task");
    timeEl = document.getElementById("taskTime");
   noteEl = document.getElementById("note");
   
   personalCreatedLogs = document.getElementById("personalCreatedLogs");
   logTaskBtn = document.getElementById("logTask");
   
    loggedTasksCount = document.getElementById("loggedTasksCount");

    savedLogDetails = state.tasks || [];

     renderExistingLogs()
     updateTaskCount()
     attachCreateLogEvent()
     attachDeleteLogEvent()
     checkIfEmpty()
}


function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "long", // February
    day: "numeric", // 11
    year: "numeric", // 2026
    hour: "2-digit", // 12
    minute: "2-digit", // 27
   });
}

function updateTaskCount() {
   //Count number of created tasks
   if(!loggedTasksCount) return
   dataCount(loggedTasksCount, savedLogDetails);
}

function checkIfEmpty() {
  if (savedLogDetails.length === 0) {
    if(personalCreatedLogs) {
      personalCreatedLogs.innerHTML = `<p class="placeholderText">No task logged yet. Add one by using the "Open Input Panel" button in the sidebar.</p>`;
    }
  } else {
    const placeholder = document.querySelector(".placeholderText");
   if(placeholder) placeholder.remove()
  }
}

function createLogElement(log) {   
  /*
   let savedLogDetails = JSON.parse(localStorage.getItem("logDetails")) || [];
*/

    /*
     localStorage.setItem("logDetails", JSON.stringify(savedLogDetails));
     */

 const taskDetails = document.createElement("details");
 taskDetails.classList.add("taskContainer");
 taskDetails.dataset.id = log.id;

 const taskSummary = document.createElement("summary");
 taskSummary.title = "click to see details";
 taskSummary.innerHTML = `<span class="personalTaskName">${log.taskValue}</span> <button data-title="delete Task" type="button" class="deleteBtn tooltip"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6" />
  <path d="M19 6l-1 14H6L5 6" />
  <path d="M10 11v6" />
  <path d="M14 11v6" />
  <path d="M9 6V4h6v2" />
</svg>
</button>`;

 const taskTime = document.createElement("span");
 taskTime.textContent = formatDateTime(log.timeValue);

 const taskNote = document.createElement("p");
 taskNote.textContent = log.noteValue;

 taskDetails.append(taskSummary, taskTime, taskNote);
 return taskDetails
}


function renderExistingLogs() {
  if (personalCreatedLogs) personalCreatedLogs.innerHTML = "";


   savedLogDetails.forEach(log => {
      
      const el = createLogElement(log);
      if(!personalCreatedLogs)  return
        personalCreatedLogs.append(el);
      
      requestAnimationFrame(() => {
         el.classList.add("show");
      });
   });
}

function attachCreateLogEvent() {
  if (!logTaskBtn) return;

  //When log task button is clicked to create new log
  logTaskBtn.addEventListener("click", () => {
    const taskValue = taskEl.value.trim();
    const timeValue = timeEl.value.trim();
    const noteValue = noteEl.value.trim();

    if (!taskValue || !timeValue || !noteValue) {
      alert("Input field must not be empty");
      return;
    }
    
    
    const logData = {
      id: crypto.randomUUID(),
      taskValue,
      timeValue,
      noteValue,
    };
    
    savedLogDetails.unshift(logData);
    state.tasks = savedLogDetails;
    
    /*
    localStorage.setItem("logDetails", JSON.stringify(savedLogDetails));
    */
   
   const el = createLogElement(logData);

   personalCreatedLogs.prepend(el);
    
   updateTaskCount()
   checkIfEmpty();
   
   requestAnimationFrame(() => {
     el.classList.add("show");
    });
    
    taskEl.value = "";
    timeEl.value = "";
    noteEl.value = "";

    document.querySelector(".personalLogInputContainer").classList.toggle("expand");
document.getElementById("upperDashboardContainer").classList.toggle("hide")
  });
}


//For Delete Button
function attachDeleteLogEvent() {
  if(!personalCreatedLogs) return
  personalCreatedLogs.addEventListener("click", (e) => {
    const btn = e.target.closest(".deleteBtn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Delete this task log?")) return;

    const logToDelete = btn.closest(".taskContainer");
    const id = logToDelete.dataset.id;

    const index = savedLogDetails.findIndex((log) => log.id === id);
    if (index === -1) return;

    savedLogDetails.splice(index, 1);
    state.tasks = savedLogDetails;

    /*
                     localStorage.setItem(
                       "logDetails",
                       JSON.stringify(savedLogDetails),
                     );
*/

    // Add animation class
    logToDelete.classList.add("removing");

    // Remove after animation ends
    setTimeout(() => {
      logToDelete.remove();

      //update count
      updateTaskCount()
      //check if task log conatiner is empty
      checkIfEmpty();
    }, 250); // matches CSS transition time
  });
}
