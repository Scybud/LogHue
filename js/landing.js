import {handleConcentEvents, loadAnalytics} from "/analytics.js"
import {
  loadComponent,
} from "https://ui.scybud.com/js/ui.js";

// Backlinks: lazy load images
document
  .querySelectorAll(".backLinks img")
  .forEach((img) => img.setAttribute("loading", "lazy"));

// HERO DESK DEMO
const desk = document.getElementById("desk");
if (desk) {
  const input = document.getElementById("deskInput");
  const live = document.getElementById("deskLive");
  const chips = [...desk.querySelectorAll("[data-q]")];
  const TOP = 120; // space reserved for the search controls
  const GAP = 14;
  const ALIASES = {
    "all notes": "note",
    "all tasks": "task",
    "all workspaces": "workspace",
  };

  if (/Mac|iPhone|iPad/.test(navigator.platform)) {
    document.getElementById("deskKbd").textContent = "⌘ K";
  }

  // x and y are 0 to 1 positions inside the scatter area, r is rotation
  const ITEMS = [
    {
      group: "note",
      kind: "Note",
      title: "Meeting notes",
      meta: "2 min ago",
      body: "lines",
      x: 0.03,
      y: 0.4,
      r: -6,
    },
    {
      group: "task",
      kind: "Task",
      title: "Send the invoice",
      meta: "Due 10:00",
      body: "task",
      x: 0.22,
      y: 0.65,
      r: 4,
    },
    {
      group: "workspace",
      kind: "Workspace",
      title: "Website rebuild",
      meta: "3 members",
      body: "ws",
      x: 0.4,
      y: 0.3,
      r: -3,
    },
    {
      group: "note",
      kind: "Table",
      title: "Budget table",
      meta: "Yesterday",
      body: "table",
      x: 0.58,
      y: 0.6,
      r: 5,
    },
    {
      group: "task",
      kind: "Task",
      title: "Renew the domain",
      meta: "Overdue",
      body: "task",
      overdue: true,
      x: 0.76,
      y: 0.25,
      r: -4,
    },
    {
      group: "note",
      kind: "Sketch",
      title: "App flow sketch",
      meta: "3 days ago",
      body: "sketch",
      x: 0.97,
      y: 0.62,
      r: 6,
    },
    {
      group: "note",
      kind: "Note",
      title: "Launch checklist",
      meta: "1 hour ago",
      body: "lines",
      x: 0.12,
      y: 0.95,
      r: 3,
      extra: true,
    },
    {
      group: "task",
      kind: "Task",
      title: "Review the project plan",
      meta: "Due 14:30",
      body: "task",
      x: 0.47,
      y: 0.97,
      r: -5,
      extra: true,
    },
    {
      group: "workspace",
      kind: "Workspace",
      title: "Team planning",
      meta: "5 members",
      body: "ws",
      x: 0.72,
      y: 1,
      r: 4,
      extra: true,
    },
  ];

  const BODIES = {
    lines: '<div class="slip-lines"></div>',
    table: `<div class="mini-table">${"<i></i>".repeat(9)}</div>`,
    sketch:
      '<svg class="slip-sketch" viewBox="0 0 120 44" aria-hidden="true"><path d="M4 34C18 6 30 6 40 24S62 40 74 14 100 4 116 30"/></svg>',
  };

  const slips = ITEMS.map((it, i) => {
    const el = document.createElement("div");
    el.className = `slip slip-${it.body}${it.overdue ? " overdue" : ""}`;
    if (it.extra) el.dataset.extra = "";
    el.style.setProperty("--i", i);
    el.innerHTML =
      `<div class="slip-kind">${it.kind}</div>` +
      `<div class="slip-head">${it.body === "task" ? '<i class="slip-check"></i>' : ""}<h3 class="slip-title"></h3></div>` +
      (BODIES[it.body] || "") +
      `<div class="slip-meta">${it.meta}</div>`;
    desk.appendChild(el);
    return { ...it, el, titleEl: el.querySelector(".slip-title") };
  });

  let query = "";

  function matches(s, q) {
    const group = ALIASES[q];
    if (group) return s.group === group;
    return s.title.toLowerCase().includes(q) || s.kind.toLowerCase() === q;
  }

  // Marks the matched part of the title
  function highlight(s, q) {
    const i = q ? s.title.toLowerCase().indexOf(q) : -1;
    s.titleEl.replaceChildren();
    if (i < 0) {
      s.titleEl.textContent = s.title;
      return;
    }
    const m = document.createElement("mark");
    m.textContent = s.title.slice(i, i + q.length);
    s.titleEl.append(s.title.slice(0, i), m, s.title.slice(i + q.length));
  }

  function render() {
    const q = query.trim().toLowerCase();
    const vis = slips.filter((s) => s.el.offsetParent);
    if (!vis.length) return;
    const W = desk.clientWidth;
    const H = desk.clientHeight;
    const w = vis[0].el.offsetWidth;
    const h = Math.max(...vis.map((s) => s.el.offsetHeight));

    const found = q ? vis.filter((s) => matches(s, q)) : [];
    const cols = Math.max(1, Math.floor((W + GAP) / (w + GAP)));
    const per = Math.min(found.length || 1, cols);
    const rows = Math.ceil(found.length / per);
    const x0 = (W - (per * (w + GAP) - GAP)) / 2;
    const y0 = TOP + Math.max(0, (H - TOP - (rows * (h + GAP) - GAP)) / 2);

    vis.forEach((s) => {
      const i = found.indexOf(s);
      const isFound = i > -1;
      const x = isFound ? x0 + (i % per) * (w + GAP) : s.x * (W - w);
      const y = isFound
        ? y0 + Math.floor(i / per) * (h + GAP)
        : TOP + s.y * (H - TOP - h);
      s.el.style.setProperty("--x", `${x}px`);
      s.el.style.setProperty("--y", `${y}px`);
      s.el.style.setProperty("--r", isFound ? "0deg" : `${s.r}deg`);
      s.el.style.setProperty("--s", q && !isFound ? 0.94 : 1);
      s.el.classList.toggle("found", isFound);
      s.el.classList.toggle("away", Boolean(q) && !isFound);
      highlight(s, q && !ALIASES[q] ? q : "");
    });

    live.textContent = !q
      ? ""
      : found.length
        ? `${found.length} ${found.length === 1 ? "result" : "results"}`
        : 'Nothing matches. Try "all tasks".';
    chips.forEach((c) =>
      c.setAttribute("aria-pressed", String(c.dataset.q === q)),
    );
  }

  input.addEventListener("input", () => {
    query = input.value;
    render();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      query = "";
      render();
    }
  });
  chips.forEach((c) =>
    c.addEventListener("click", () => {
      input.value = query === c.dataset.q ? "" : c.dataset.q;
      query = input.value;
      render();
    }),
  );

  // Same shortcut as the real app
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  new ResizeObserver(render).observe(desk);
  document.fonts?.ready.then(render);
  render();
}


// THEME TOGGLE
const ICONS = {
  moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
};

const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle");

// Icon shows the theme you will switch to
function renderThemeIcon() {
  const isLight = root.classList.contains("light");
  themeToggle.innerHTML = isLight ? ICONS.moon : ICONS.sun;
  themeToggle.setAttribute(
    "aria-label",
    isLight ? "Switch to dark mode" : "Switch to light mode",
  );
}

if (themeToggle) {
  renderThemeIcon();
  themeToggle.addEventListener("click", () => {
    root.classList.toggle("light");
    try {
      localStorage.setItem(
        "theme",
        root.classList.contains("light") ? "light" : "dark",
      );
    } catch {}
    renderThemeIcon();
  });
}

// MOBILE SIDEBAR
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileSidebar = document.getElementById("mobileSidebar");
const closeSidebar = document.getElementById("closeSidebar");

function setSidebar(open) {
  mobileSidebar.classList.toggle("open", open);
  mobileMenuBtn.setAttribute("aria-expanded", String(open));
  document.body.style.overflow = open ? "hidden" : "";
  if (open) closeSidebar.focus();
  else mobileMenuBtn.focus();
}

if (mobileMenuBtn && mobileSidebar) {
  mobileMenuBtn.setAttribute("aria-expanded", "false");
  mobileMenuBtn.setAttribute("aria-label", "Open menu");
  closeSidebar.setAttribute("aria-label", "Close menu");

  mobileMenuBtn.addEventListener("click", () => setSidebar(true));
  closeSidebar.addEventListener("click", () => setSidebar(false));

  // closest() so clicks on child elements count too
  mobileSidebar.addEventListener("click", (e) => {
    if (e.target.closest("a")) setSidebar(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mobileSidebar.classList.contains("open")) {
      setSidebar(false);
    }
  });
}

// SCROLL REVEAL with stagger inside grids
document
  .querySelectorAll(".feature-grid,.what-grid,.how-steps,.who-grid")
  .forEach((g) =>
    [...g.children].forEach((c, i) => c.style.setProperty("--i", i % 4)),
  );

const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }),
  { threshold: 0.15 },
);

document
  .querySelectorAll(
    ".hero-content,.hero-illustration,.section h2,.section-lead,.feature-card,.what-item,.how-step,.who-card",
  )
  .forEach((el) => {
    el.classList.add("reveal");
    io.observe(el);
  });


  // Analytics
    await loadComponent("https://app.loghue.com/components/modals/cookies-banner", "infoDisplay");
    const saved = localStorage.getItem("consent-preferences");
    if (saved) {
      const prefs = JSON.parse(saved);
      const consentBanner = document.getElementById("consent-banner");
      if (consentBanner) consentBanner.remove();
  
      if (prefs.analytics) loadAnalytics();
    }

    handleConcentEvents();