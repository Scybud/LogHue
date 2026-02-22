// Toggles the main sidebar visibility
export function sidebarToggle() {
  const sidebar = document.querySelector(".sidebarContainer");
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
  const actionBtn = document.querySelector(".actionBtn");
  if (actionBtn) {
    actionBtn.addEventListener("click", sidebarToggle);
  }
}

// Attaches the personal log input panel toggle behavior
export function personalLogInputContainerPanelToggle() {
  const toggleInputContainer = document.getElementById("toggleInputContainer");
  const upperDashboardContainer = document.getElementById("upperDashboardContainer");
  const personalLogInputContainer = document.querySelector(".personalLogInputContainer");

  if (toggleInputContainer || upperDashboardContainer || personalLogInputContainer) {
    toggleInputContainer.addEventListener("click", () => {
      
      toggleInputContainer.textContent =
      toggleInputContainer.textContent === "Close Input Panel"
      ? "Open Input Panel"
      : "Close Input Panel";
      
      personalLogInputContainer.classList.toggle("expand");
      toggleInputContainer.classList.toggle("panelClosed");
        
        upperDashboardContainer.classList.toggle("hide");
    });
  }
}
