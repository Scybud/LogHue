import { sidebarToggle } from "../utils/toggle.js";

/*
import { loadSection } from "../workspace.js";
*/

export function attachSidebarEvents() {
  const navButtons = document.querySelectorAll(".navBtn")
  if(!navButtons.length) return 
  
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.section;


      sidebarToggle();
    });
  });
}
