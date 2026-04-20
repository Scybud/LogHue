// filepath: docs/components/navbar.js
/**
 * Documentation Navbar Component
 * Top navigation bar for the docs section
 */

class DocsNavbar {
  constructor() {
    this.init();
  }

  init() {
    this.render();
    this.attachEventListeners();
  }

  render() {
    const navbar = document.getElementById("docs-navbar");
    if (!navbar) return;

    navbar.innerHTML = `
      <button type="button" class="menuBtn" id="openDocsSidebar">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <div class="headerTitle">
        <a href="https://loghue.com" class="logo">
          <span class="logo-icon">📘</span>
          <div class="logo-container>
          <div class="logo">Log<span>Hue</span> <strong class="logo-docs-text">docs</strong></div>
          </div>
        </a>
        <span class="separator">›</span>
        <span class="page-title">Help Center</span>
      </div>
      <div class="headerActions">
        <a href="https://loghue.com" class="headerLink">Go to App</a>
      </div>
    `;
  }

  attachEventListeners() {
    const openBtn = document.getElementById("openDocsSidebar");
    if (openBtn) {
      openBtn.addEventListener("click", () => {
        const sidebar = document.getElementById("docs-sidebar");
        if (sidebar) sidebar.classList.add("open");
      });
    }
  }

  setPageTitle(title) {
    const titleEl = document.querySelector(".page-title");
    if (titleEl) titleEl.textContent = title;
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.docsNavbar = new DocsNavbar();
});
