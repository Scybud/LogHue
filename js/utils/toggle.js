// Toggles the main sidebar visibility
const sidebar = document.querySelector(".sidebarContainer");
export function sidebarToggle() {
  if (!sidebar) return;
  sidebar.classList.toggle("show");
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
  const actionBtns = sidebar.querySelectorAll(".actionBtn");
  actionBtns.forEach((actionBtn) => {
    if (actionBtn) {
      actionBtn.addEventListener("click", sidebarToggle);
    }
  });

  //NAV BUTTONS AND LINKS
  const navBtns = document.querySelectorAll(".navBtn");
  navBtns.forEach((navBtn) => {
    if(navBtn) {
      navBtn.addEventListener("click", sidebarToggle);
    }
  })
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