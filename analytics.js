import { loadComponent, closeModal as closeConsentModal } from "./app/js/ui.js";

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
  const consentBanner = document.getElementById("consent-banner");

  // Banner buttons (may or may not exist depending on the page)
  const acceptBtn = document.getElementById("accept-all");
  const rejectBtn = document.getElementById("reject-all");
  const customizeBtn = document.getElementById("customize");
  const customizeTracking = document.querySelector(".customize-tracking");

  // Customize for settings page
  if (customizeTracking) {
    customizeTracking.addEventListener("click", async () => {
      await loadComponent(
        "../components/modals/cookies-customize",
        "modalContainer",
      );

      const analyticsToggle = document.getElementById("toggle-analytics");
      const closeBtn = document.getElementById("close-modal");
      const saveBtn = document.getElementById("save-preferences");

      closeBtn.addEventListener("click", () => closeConsentModal());

      saveBtn.addEventListener("click", () => {
        const prefs = {
          analytics: analyticsToggle.checked,
        };

        localStorage.setItem("consent-preferences", JSON.stringify(prefs));

        if (prefs.analytics) loadAnalytics();

        closeConsentModal();
        if (consentBanner) consentBanner.remove();
      });
    });
  }

  // Accept All — guarded independently so a missing button here
  // doesn't prevent Reject All / Customize from being wired up below.
  if (acceptBtn) {
    acceptBtn.addEventListener("click", () => {
      localStorage.setItem(
        "consent-preferences",
        JSON.stringify({
          analytics: true,
        }),
      );

      loadAnalytics();
      if (consentBanner) consentBanner.remove();
    });
  }

  // Reject All
  if (rejectBtn) {
    rejectBtn.addEventListener("click", () => {
      localStorage.setItem(
        "consent-preferences",
        JSON.stringify({
          analytics: false,
        }),
      );

      if (consentBanner) consentBanner.remove();
    });
  }

  // Customize
  if (customizeBtn) {
    customizeBtn.addEventListener("click", async () => {
      await loadComponent(
        "../components/modals/cookies-customize",
        "modalContainer",
      );

      const analyticsToggle = document.getElementById("toggle-analytics");
      const closeBtn = document.getElementById("close-modal");
      const saveBtn = document.getElementById("save-preferences");

      // Bug fix: savedPrefs is a raw JSON string from localStorage, so it needs
      // parsing before reading .analytics off it. Also needed an actual
      // assignment (`= true`), not a bare property reference that does nothing.
      const savedPrefs = localStorage.getItem("consent-preferences");
      if (savedPrefs) {
        const parsedPrefs = JSON.parse(savedPrefs);
        if (parsedPrefs.analytics === true) {
          analyticsToggle.checked = true;
        }
      }

      closeBtn.addEventListener("click", () => closeConsentModal());

      saveBtn.addEventListener("click", () => {
        const prefs = {
          analytics: analyticsToggle.checked,
        };

        localStorage.setItem("consent-preferences", JSON.stringify(prefs));

        if (prefs.analytics) loadAnalytics();

        closeConsentModal();
        if (consentBanner) consentBanner.remove();
      });
    });
  }
}
