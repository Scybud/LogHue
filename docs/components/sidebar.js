// filepath: docs/components/sidebar.js
/**
 * Documentation Sidebar Component
 * Handles navigation within the docs section
 */

class DocsSidebar {
  constructor() {
    this.currentPage = this.getCurrentPage();
    this.init();
  }

  init() {
    this.render();
    this.highlightCurrentPage();
  }

  getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split("/").pop().replace(".html", "");
    return filename || "index";
  }

  getNavItems() {
    return [
      { id: "index", title: "Help Center", icon: "home", url: "index" },
      {
        id: "getting-started",
        title: "Getting Started",
        icon: "rocket",
        url: "getting-started",
      },
      {
        id: "workspaces",
        title: "Workspaces",
        icon: "folder",
        url: "workspaces",
      },
      {
        id: "roles",
        title: "Roles & Permissions",
        icon: "users",
        url: "roles",
      },
      { id: "tasks", title: "Tasks & Logs", icon: "check", url: "tasks" },
      {
        id: "security",
        title: "Security & Privacy",
        icon: "shield",
        url: "security",
      },
    ];
  }

  getIcon(iconName) {
    const icons = {
      home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10L12 3L21 10V20C21 20.55 20.55 21 20 21H4C3.45 21 3 20.55 3 20V10Z"/><path d="M9 21V14H15V21"/></svg>',
      rocket:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
      folder:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
      users:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      check:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      shield:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    };
    return icons[iconName] || icons.home;
  }

  render() {
    const sidebar = document.getElementById("docs-sidebar");
    if (!sidebar) return;

    const navHTML = this.getNavItems()
      .map(
        (item) => `
      <a href="${item.url}" class="navBtn ${item.id === this.currentPage ? "active" : ""}" data-page="${item.id}">
        <span class="navIcon">${this.getIcon(item.icon)}</span>
        <span class="navText">${item.title}</span>
      </a>
    `,
      )
      .join("");

    sidebar.innerHTML = `
      <button type="button" class="menuBtn" id="closeDocsSidebar">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
          <rect x="3.5" y="3.5" width="17" height="17" rx="6" ry="6" fill="currentColor" opacity="0.06"/>
          <path d="M9 9l6 6M15 9l-6 6"/>
        </svg>
      </button>
      <nav class="sidebarNav">
        ${navHTML}
      </nav>
    `;

    // Re-attach close handler
    const closeBtn = document.getElementById("closeDocsSidebar");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        const sidebar = document.getElementById("docs-sidebar");
        if (sidebar) sidebar.classList.remove("open");
      });
    }
  }

  highlightCurrentPage() {
    const navBtns = document.querySelectorAll("#docs-sidebar .navBtn");
    navBtns.forEach((btn) => {
      if (btn.dataset.page === this.currentPage) {
        btn.classList.add("active");
      }
    });
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new DocsSidebar();
});
