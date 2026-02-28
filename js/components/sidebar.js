import { sidebarToggle } from "../utils/toggle.js";

/*
import { loadSection } from "../workspace.js";
*/

export function attachSidebarEvents() {
  const navButtons = document.querySelectorAll(".navBtn")
  if(!navButtons.length) return 
  
  navButtons.forEach((btn) => {
    // Link glows slightly when active
    if (btn.href === window.location.href) {
      btn.classList.add("active");
    }
    btn.addEventListener("click", () => {
      sidebarToggle();
    });
  });
}
