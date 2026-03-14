import { loadComponent, closeModal as closeConsentModal } from "./js/ui.js";

export function loadAnalytics() {
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

  // Banner buttons (now guaranteed to exist)
  const acceptBtn = document.getElementById("accept-all");
  const rejectBtn = document.getElementById("reject-all");
  const customizeBtn = document.getElementById("customize");

  // Accept All
  if(!acceptBtn) return;
  acceptBtn.addEventListener("click", () => {
    localStorage.setItem("consent-preferences", JSON.stringify({
      analytics: true,
      marketing: true
    }));

    loadAnalytics();
    actionsMessage.innerHTML = "";
  });

  // Reject All
    if (!rejectBtn) return;
  rejectBtn.addEventListener("click", () => {
    localStorage.setItem("consent-preferences", JSON.stringify({
      analytics: false,
      marketing: false
    }));

    actionsMessage.innerHTML = "";
  });

  // Customize (your working version)
  customizeBtn.addEventListener("click", async () => {
     console.log("here")
    await loadComponent(
      "https://loghue.com/components/modals/cookies-customize.html",
      "modalContainer"
    );

    const analyticsToggle = document.getElementById("toggle-analytics");
    const marketingToggle = document.getElementById("toggle-marketing");
    const closeBtn = document.getElementById("close-modal");
    const saveBtn = document.getElementById("save-preferences");

    closeBtn.addEventListener("click", () => closeConsentModal());

    saveBtn.addEventListener("click", () => {
      const prefs = {
        analytics: analyticsToggle.checked,
        marketing: marketingToggle.checked
      };

      localStorage.setItem("consent-preferences", JSON.stringify(prefs));

      if (prefs.analytics) loadAnalytics();

      closeConsentModal();
      actionsMessage.innerHTML = "";
    });
  });
}

