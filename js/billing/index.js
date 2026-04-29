import { sessionState, sessionReady } from "../session.js";

async function loadBilling() {
  await sessionReady;

  const user = sessionState.user;
  if (!user) {
    window.location.href = "../auth?redirect=/billing";
    return;
  }

  
  // PLAN SETUP
  
  const planNameRaw = sessionState.plan?.name || "Free";
  const planName =
    planNameRaw.charAt(0).toUpperCase() + planNameRaw.slice(1).toLowerCase();

  const planBadge = document.getElementById("current-plan");
  if (planBadge) planBadge.textContent = planName;

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

  
  // CURRENT FEATURES
  
  const currentList = document.getElementById("current-features");
  if (currentList) {
    currentList.innerHTML = "";

    (FEATURES[planName] || FEATURES.Free).forEach((f) => {
      const li = document.createElement("li");
      li.className = f.unlocked ? "" : "locked";
      li.textContent = (f.unlocked ? "✔️ " : "🔒 ") + f.text;
      currentList.appendChild(li);
    });
  }

  
  // NEXT PLAN PREVIEW
  
  const higherFeaturesList = document.getElementById("higherFeatures");
  const nextPlanEl = document.getElementById("nextPlan");

  let nextPlan = null;

  if (planName === "Free") nextPlan = "Pro";
  else if (planName === "Pro") nextPlan = "Team";

  if (nextPlanEl) nextPlanEl.textContent = nextPlan || "—";

  if (higherFeaturesList) {
    higherFeaturesList.innerHTML = "";

    if (nextPlan && FEATURES[nextPlan]) {
      FEATURES[nextPlan].forEach((f) => {
        const li = document.createElement("li");
        li.textContent = "✨ " + f.text;
        higherFeaturesList.appendChild(li);
      });
    }
  }

  
  // ADDONS
  const addonsList = document.getElementById("current-addons");

  if (addonsList) {
    addonsList.innerHTML = "";

    const addons = sessionState.addons ?? [];

    if (!addons.length) {
      const li = document.createElement("li");
      li.textContent = "No active addons";
      li.style.opacity = "0.6";
      addonsList.appendChild(li);
    } else {
      addons.forEach((addon) => {
        const li = document.createElement("li");
        li.textContent = `🧩 ${addon.name}`;
        addonsList.appendChild(li);
      });
    }
  }
  
  // BUTTONS
  
  const upgradeToProBtn = document.getElementById("upgradeToProBtn");
  const upgradeToTeamBtn = document.getElementById("upgradeToTeamBtn");

  const planKey = planName.toLowerCase();

  if (planKey === "free") {
    upgradeToTeamBtn?.remove();
  }

  if (planKey === "pro") {
    upgradeToProBtn?.remove();
  }

  if (planKey === "team") {
    upgradeToProBtn?.remove();
    upgradeToTeamBtn?.remove();

    const title = document.getElementById("section-title");
    if (title) title.textContent = "You’ve reached the top.";
  }

  
  // NAVIGATION
  
  if (upgradeToProBtn) {
    upgradeToProBtn.onclick = () => {
      window.location.href =
        "/billing/upgrade?plan=dee55ec9-ae01-40f3-b297-fe9faa8485d6";
    };
  }

  if (upgradeToTeamBtn) {
    upgradeToTeamBtn.onclick = () => {
      window.location.href =
        "/billing/upgrade?plan=e06ed82b-037b-4fac-bbec-94d761f1cdd5";
    };
  }

  
  // MANAGE SUB
  
  const manageBtn = document.getElementById("manage-btn");
  if (manageBtn) {
    manageBtn.onclick = () => {
      window.location.href = "/billing/manage";
    };
  }
}

loadBilling();
