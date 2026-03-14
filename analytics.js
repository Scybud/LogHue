import { loadComponent, closeModal as closeConsentModal } from "./js/ui.js";

function loadAnalytics() {
  if (window.__analyticsLoaded) return;
  window.__analyticsLoaded = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=G-3VZMDG49GJ";
  document.head.appendChild(script);

  script.onload = () => {
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      dataLayer.push(arguments);
    }
    window.gtag = gtag;

    gtag("js", new Date());
    gtag("config", "G-3VZMDG49GJ");
  };
}

export function handleConcentEvents() {
  const actionsMessage = document.getElementById("actionsMessage");

  const customizeBtn = document.getElementById("customize");
  const saveBtn = document.getElementById("save-preferences");

  // These will be assigned after modal loads
  let analyticsToggle;
  let marketingToggle;

  // OPEN CUSTOMIZE MODAL
  customizeBtn.addEventListener("click", async () => {
    await loadComponent(
      "https://loghue.com/components/modals/cookies-customize.html",
      "modalContainer",
    );

    // Now the modal exists — bind its elements
    analyticsToggle = document.getElementById("toggle-analytics");
    marketingToggle = document.getElementById("toggle-marketing");

    const closeBtn = document.getElementById("close-modal");
    closeBtn.addEventListener("click", () => {
      closeConsentModal();
    });
  });

  // SAVE PREFERENCES
  saveBtn.addEventListener("click", () => {
    const prefs = {
      analytics: analyticsToggle?.checked ?? false,
      marketing: marketingToggle?.checked ?? false,
    };

    localStorage.setItem("consent-preferences", JSON.stringify(prefs));

    if (prefs.analytics) {
      loadAnalytics();
    }

    closeConsentModal();
    actionsMessage.innerHTML = "";
  });
}
