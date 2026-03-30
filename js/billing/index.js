import { sessionState, sessionReady } from "../session.js";

async function loadBilling() {
  await sessionReady;
  const user = sessionState.user;
  if (!user) {
    window.location.href = "../auth?redirect=/billing";
    return;
  }

  const plan = sessionState.plan;
  const planName = plan?.name
    ? plan.name.charAt(0).toUpperCase() + plan.name.slice(1)
    : "Free";

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

  const higherFeaturesList = document.getElementById("higherFeatures");
  higherFeaturesList.innerHTML = "";

  let nextPlanName = null;

  if (planName === "Free") nextPlanName = "Pro";
  else if (planName === "Pro") nextPlanName = "Team";
  else nextPlanName = null; // Team has no higher plan

  document.getElementById("nextPlan").textContent = nextPlanName;
  if(nextPlanName) {
    FEATURES[nextPlanName].forEach((f) => {
      const li = document.createElement("li");
      li.innerHTML = "✨ " + f.text;
      higherFeaturesList.appendChild(li);
    });
  }

  const upgradeToProBtn = document.getElementById("upgradeToProBtn");
  const upgradeToTeamBtn = document.getElementById("upgradeToTeamBtn");

  if (planName === "Free") {
    upgradeToTeamBtn.remove();
  }

  // Hide upgrade button if already Pro or Team
  if (planName === "Pro") {
    upgradeToProBtn.remove();
  } else if (planName === "Team") {
    upgradeToProBtn.remove();
    upgradeToTeamBtn.remove();

    document.getElementById("section-title").textContent =
      "You’ve reached the top.";
    document.querySelector(".upgrade-section-subtitle").textContent =
      "You’re on LogHue’s highest plan. Everything we offer is already yours.";
  }
}

// Upgrade button → redirect to upgrade page
upgradeToProBtn.onclick = () => {
  window.location.href = `upgrade?plan=dee55ec9-ae01-40f3-b297-fe9faa8485d6`;
};

upgradeToTeamBtn.onclick = () => {
  window.location.href = `upgrade?plan=e06ed82b-037b-4fac-bbec-94d761f1cdd5`;
};

// Manage subscription
document.getElementById("manage-btn").onclick = () => {
  window.location.href = "/billing/manage";
};

loadBilling();
