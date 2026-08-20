import { loadComponent } from "../ui.js";
import { logEvent } from "../utils/logEvent.js";

export async function initCommandPalette() {
  document.addEventListener("keydown", async (e) => {
    // Cmd+K on Mac, Ctrl+K on Windows/Linux
    const isCmdK = (e.metaKey || e.ctrlKey) && e.key === "k" || (e.metaKey || e.ctrlKey) && e.key === "K";

    if (isCmdK) {
      e.preventDefault(); // stops browser's default (e.g. address bar focus)
      logEvent("command_palette_opened", { trigger: "ctrl_k" });

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