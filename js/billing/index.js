import { sessionState, sessionReady } from "../session.js";



async function loadBilling() {
   await sessionReady; // wait for session to finish loading
   
   console.log("here")
   const user = sessionState.user;
   if (!user) {
      window.location.href = "/login?redirect=/billing";
      return;
   }
   // Ensure plan exists
  const plan = sessionState.plan;
  if (!plan || !plan.name) {
    document.getElementById("current-plan").textContent = "Free";
    return;
  }
  const planName = plan.name.charAt(0).toUpperCase() + plan.name.slice(1);

  document.getElementById("current-plan").textContent = planName;

  const FEATURES = {
    Free: [
      { text: "Create 1 workspace", unlocked: true },
      { text: "Join unlimited workspaces", unlocked: true },
      { text: "Basic workspace tools", unlocked: true },
      { text: "Activity overview", unlocked: false },
      { text: "Priority support", unlocked: false },
    ],
    Pro: [
      { text: "Create up to 10 workspaces", unlocked: true },
      { text: "Join unlimited workspaces", unlocked: true },
      { text: "Activity overview", unlocked: true },
      { text: "Priority support", unlocked: true },
    ],
    Team: [
      { text: "Create unlimited workspaces", unlocked: true },
      { text: "Join unlimited workspaces", unlocked: true },
      { text: "Activity overview", unlocked: true },
      { text: "Priority support", unlocked: true },
    ],
  };
  
  const currentList = document.getElementById("current-features");
  currentList.innerHTML = "";

  (FEATURES[planName] || FEATURES["Free"]).forEach((f) => {
    const li = document.createElement("li");
    li.className = f.unlocked ? "" : "locked";
    li.innerHTML = f.unlocked ? "✔️ " + f.text : "🔒 " + f.text;
    currentList.appendChild(li);
  });

  const proList = document.getElementById("pro-features");
  proList.innerHTML = "";
  FEATURES["Pro"].forEach((f) => {
    const li = document.createElement("li");
    li.innerHTML = "✨ " + f.text;
    proList.appendChild(li);
   });

  // Hide upgrade button if already Pro
  if (planName === "Pro" || planName === "Team") {
    document.getElementById("upgrade-btn").style.display = "none";
  }
}

document.getElementById("upgrade-btn").onclick = () => {
  window.location.href = `/upgrade?plan=${sessionState.plan.id}`;
};

document.getElementById("manage-btn").onclick = () => {
  window.location.href = "/billing/manage";
};

   await loadBilling();