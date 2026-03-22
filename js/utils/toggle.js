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
  const actionBtn = sidebar.querySelector(".actionBtn");
  if (actionBtn) {
    actionBtn.addEventListener("click", sidebarToggle);
  }
  }

export function toggleNotification() {

  const notificationToggleBtn = document.getElementById(
    "notificationToggleBtn",
  );
  const notificationsContainer = document.getElementById("notificationsContainer");

  if(!notificationsContainer || !notificationToggleBtn) return;

  notificationToggleBtn.addEventListener("click", () => {
notificationsContainer.classList.toggle("show")
  })

}