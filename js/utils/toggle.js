// Toggles the main sidebar visibility
const sidebar = document.querySelector(".sidebarContainer");
export function sidebarToggle() {
  if (sidebar) {
    sidebar.classList.toggle("slideShow");
  }
}

// Attaches sidebar toggle events to buttons
export function attachSidebarToggle() {
  const toggleBtn = document.getElementById("toggleSidebar");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", sidebarToggle);
  }
  const closeSidebar = document.getElementById("closeSidebar")
  if(closeSidebar) {
    closeSidebar.addEventListener("click", sidebarToggle);

  }

  //ACTION BUTTONS
  if(sidebar) {
    const actionBtns = sidebar.querySelectorAll(".actionBtn");
    if(actionBtns) {
      actionBtns.forEach((actionBtn) => {
        if (actionBtn) {
          actionBtn.addEventListener("click", sidebarToggle);
        }
      });
    }
  }

  //NAV BUTTONS AND LINKS
  const navBtns = document.querySelectorAll(".navBtn");
  navBtns.forEach((navBtn) => {
    if(navBtn) {
      navBtn.addEventListener("click", sidebarToggle);
    }
  });
  }

export function toggleNotification() {

  const notificationToggleBtn = document.getElementById(
    "notificationToggleBtn",
  );
  const notificationsContainer = document.getElementById("notificationsContainer");

  if(!notificationsContainer || !notificationToggleBtn){

    console.log("elements not found"); 
    return;
  } 

  notificationToggleBtn.addEventListener("click", () => {
notificationsContainer.classList.toggle("show")
  })

}