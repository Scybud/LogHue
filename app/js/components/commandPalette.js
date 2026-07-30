import { loadComponent } from "../ui.js";
/*
 NOTE: intentionally NOT statically importing initSmartSearch from "../utils/search.js" here.
 search.js has a top-level `await sessionReady;`, and a static import would make THIS module
 (and therefore app.js, which imports this) wait on that too — delaying when the keydown
 listener gets registered, and even delaying DOMContentLoaded itself. Dynamic import below
 keeps initCommandPalette() free of that dependency until the palette is actually opened.
*/

export async function initCommandPalette() {
  document.addEventListener("keydown", async (e) => {
    // Cmd+K on Mac, Ctrl+K on Windows/Linux
    const isCmdK = (e.metaKey || e.ctrlKey) && e.key === "k" || (e.metaKey || e.ctrlKey) && e.key === "K";

    if (isCmdK) {
      e.preventDefault(); // stops browser's default (e.g. address bar focus)

      await loadComponent(
        "../components/modals/command-palette",
        "modalContainer",
      );

      const mainSearchInput = document.querySelector(
        ".modalContainer .mainSearchInput",
      );
      if (mainSearchInput) mainSearchInput.focus();

      const { initSmartSearch } = await import("../utils/search.js");
      await initSmartSearch(document.querySelector(".modalContainer"));
    }

    if (e.key === "Escape") {
      const modalContainer = document.getElementById("modalContainer");
      if (modalContainer) modalContainer.innerHTML = "";
    }
  });
}
