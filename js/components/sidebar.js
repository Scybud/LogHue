import { sidebarToggle } from "../utils/toggle.js";

/*
import { loadSection } from "../workspace.js";
*/

export function attachSidebarEvents() {
  const navButtons = document.querySelectorAll(".navBtn")
  if(!navButtons.length) return 
  
  navButtons.forEach((btn) => {
    // Link lights slightly when active
    if (btn.href === window.location.href) {
      btn.classList.add("active");
    }
    btn.addEventListener("click", () => {
      sidebarToggle();
    });
  });

  navDropdowns();
}

function navDropdowns() {
   const navBtnDropdown = document.getElementById("navBtnDropdown");
   const historyNavs = document.querySelector(".historyNavs");

   if (navBtnDropdown && historyNavs) {
     navBtnDropdown.addEventListener("click", () => {
       navBtnDropdown.classList.toggle("dropped");

       historyNavs.classList.toggle("dropNav");
     });
   }
}