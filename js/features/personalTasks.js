import { personalLogInputContainerPanelToggle } from "../utils/toggle.js";
import {dataCount} from "../utils.js"
import { supabase } from "../supabase.js";
import { sessionState, sessionReady } from "../session.js";


let taskEl
let timeEl
let noteEl
let personalCreatedLogs
let logTaskBtn
let loggedTasksCount

let savedLogDetails = []


export async function initPersonalTasks() {
    await sessionReady;
  
  const user = sessionState.user;

    //GET CREATED PERSONAL TASKS
    const { data: createdPersonalTasks, error: createdError } = await supabase
      .from("personal_tasks")
      .select("*")
      .eq("user_id", user.id)
  
    if (createdError) {
      console.error(createdError);
      alert(createdError);
    }

    taskEl = document.getElementById("task");
    timeEl = document.getElementById("taskTime");
   noteEl = document.getElementById("note");
   
   personalCreatedLogs = document.getElementById("personalCreatedLogs");
   logTaskBtn = document.getElementById("logTask");
   
    loggedTasksCount = document.getElementById("loggedTasksCount");

    savedLogDetails = createdPersonalTasks || [];

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
      personalCreatedLogs.innerHTML = `<svg
class="emptyStateImg"
  viewBox="0 0 480 320"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-labelledby="title desc"
>
  <title id="title">No tasks logged</title>
  <desc id="desc">
    Clipboard illustration with message: No tasks logged yet. Use the sidebar to open the input panel and add your first task.
  </desc>

  <rect width="100%" height="100%" fill="none" />

  <!-- Clipboard icon -->
  <g transform="translate(190,40)" fill="none" stroke="#777" stroke-width="2">
    <!-- Shadow -->
    <ellipse cx="50" cy="120" rx="46" ry="6" fill="#000" opacity="0.06" stroke="none" />

    <!-- Clipboard body -->
    <rect x="10" y="10" width="80" height="100" rx="6" ry="6" fill="#f5f5f5" />
    <!-- Paper -->
    <rect x="18" y="18" width="64" height="84" rx="4" ry="4" fill="#ffffff" />

    <!-- Clip -->
    <rect x="36" y="4" width="32" height="12" rx="3" ry="3" fill="#e0e0e0" stroke="none" />
    <rect x="42" y="2" width="20" height="8" rx="2" ry="2" fill="#d0d0d0" stroke="none" />

    <!-- Plus sign -->
    <g stroke="#777" stroke-width="2" stroke-linecap="round">
      <line x1="30" y1="30" x2="30" y2="38" />
      <line x1="26" y1="34" x2="34" y2="34" />
    </g>

    <!-- First checkbox (empty) -->
    <rect x="26" y="46" width="10" height="10" rx="2" ry="2" />
    <line x1="40" y1="51" x2="72" y2="51" />

    <!-- Second checkbox (checked) -->
    <rect x="26" y="64" width="10" height="10" rx="2" ry="2" />
    <polyline points="28,69 31,73 36,66" stroke-linecap="round" stroke-linejoin="round" />
    <line x1="40" y1="69" x2="72" y2="69" />

    <!-- Small star -->
    <path
      d="M82 30 l2 4 4 1 -3 3 1 4 -4-2 -4 2 1-4 -3-3 4-1z"
      fill="#999"
      stroke="none"
    />
  </g>

  <!-- Main text: 4rem equivalent -->
  <!-- 4rem ~ 64px (assuming 16px base) -->
  <text
    x="50%"
    y="190"
    text-anchor="middle"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    font-size="44"
    font-weight="700"
    fill="#4e4e4e"
  >
    No tasks logged yet.
  </text>

  <!-- Divider line -->
  <line
    x1="120"
    y1="205"
    x2="360"
    y2="205"
    stroke="#ccc"
    stroke-width="1"
  />

  <!-- Secondary text -->
  <text
    x="50%"
    y="235"
    text-anchor="middle"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    font-size="26"
    fill="#666"
  >
    Use the sidebar to open the input panel
  </text>
  <text
    x="50%"
    y="255"
    text-anchor="middle"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    font-size="26"
    fill="#666"
  >
    and add your first task.
  </text>
</svg>
`;
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
 taskSummary.innerHTML = `<span class="personalTaskName">${log.name}</span> <button data-title="delete Task" type="button" class="deleteBtn tooltip"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6" />
  <path d="M19 6l-1 14H6L5 6" />
  <path d="M10 11v6" />
  <path d="M14 11v6" />
  <path d="M9 6V4h6v2" />
</svg>
</button>`;

 const taskTime = document.createElement("span");
 taskTime.textContent = formatDateTime(log.created_at);

 const taskNote = document.createElement("p");
 taskNote.textContent = log.description;

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

async function attachCreateLogEvent() {
  if (!logTaskBtn) return;
  
    const user = sessionState.user;

  //When log task button is clicked to create new log
  logTaskBtn.addEventListener("click", async () => {
    const taskValue = taskEl.value.trim();
    const timeValue = timeEl.value.trim();
    const noteValue = noteEl.value.trim();
    
    if (!taskValue || !timeValue || !noteValue) {
      alert("Input field must not be empty");
      return;
    }
      //DEFINE DATA CONTENT
      const logData = {
        name: taskValue,
        description: noteValue,
        created_at: timeValue,
        user_id: user.id,
      };
  
      //INSERT INTO SUPABASE
      const { data, error } = await supabase
        .from("personal_tasks")
        .insert(logData)
        .select();
  
      if (error) {
        console.error(error);
        alert("Failed to create task.");
        return;
      }
  
      const newLog = data[0];

    
    savedLogDetails.unshift(logData);
    
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
  personalCreatedLogs.addEventListener("click", async (e) => {
    const btn = e.target.closest(".deleteBtn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Delete this task log?")) return;

    const logToDelete = btn.closest(".taskContainer");
    const id = logToDelete.dataset.id;

    const {error} = await supabase.from("personal_tasks").delete().eq("id", id);

    if(error) {
      console.error(error)
      alert(error.message)
      return;
    }

    const index = savedLogDetails.findIndex((log) => log.id === id);
    if (!index !== -1) savedLogDetails.splice(index, 1);

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
