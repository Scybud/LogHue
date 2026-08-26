// Toggles the main sidebar visibility
const sidebar = document.querySelector(".sidebar");
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
  const closeSidebar = document.getElementById("closeSidebar");
  if (closeSidebar) {
    closeSidebar.addEventListener("click", sidebarToggle);
  }

  //ACTION BUTTONS
  if (sidebar) {
    const actionBtns = sidebar.querySelectorAll(".actionBtn");
    if (actionBtns) {
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
    if (navBtn) {
      navBtn.addEventListener("click", sidebarToggle);
    }
  });
}

export function toggleSearchBar() {
  const searchBarOpen = document.getElementById("searchBarOpen");
  const searchContainer = document.querySelector(".searchContainer");

  if (!searchBarOpen || !searchContainer) return;

  searchBarOpen.addEventListener("click", () => {
    searchContainer.classList.add("showFlex");
    document.getElementById("searchInput")?.focus();
  });

  searchContainer.addEventListener("click", (e) => {
    if (e.target === searchContainer) {
      searchContainer.classList.remove("showFlex");
    }
  });
}

export function makeCollapsible(element, maxHeight = 220) {
  if (!element) return;

  requestAnimationFrame(() => {
    // Don't do anything if the content isn't actually taller
    // than the allowed height.
    if (element.scrollHeight <= maxHeight) return;

    element.classList.add("isCollapsible");
    element.style.maxHeight = `${maxHeight}px`;
    element.style.overflow = "hidden";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "contentToggle";
    button.textContent = "Show more";

    element.insertAdjacentElement("afterend", button);

    button.addEventListener("click", () => {
      const expanded = element.classList.toggle("expanded");

      if (expanded) {
        element.style.maxHeight = `${element.scrollHeight}px`;
        button.textContent = "Show less";
      } else {
        element.style.maxHeight = `${maxHeight}px`;
        button.textContent = "Show more";
      }
    });
  });
}