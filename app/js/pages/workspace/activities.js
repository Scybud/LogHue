import { formatDateTime } from "../../utils/time.js";
import { sessionState } from "../../session.js";

/**
 * Shared activities feed (admin / owner / member).
 * Gated behind paid plan.
 * Rendered as a grouped vertical log, not a card grid.
 */
export function loadActivities(activities, container) {
  const planName = (sessionState?.plan?.name || "").toLowerCase();
  if (planName === "free") {
    renderPlaceholder(
      container,
      "Workspace activities overview is not available on your current plan.",
      true,
    );
    return;
  }

  if (!activities || activities.length === 0) {
    renderPlaceholder(container, "No activity in this workspace yet.", false);
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "Activities";

  const log = document.createElement("div");
  log.classList.add("activityLog");

  const groups = groupByDay(activities);

  groups.forEach(({ label, items }) => {
    const groupEl = document.createElement("div");
    groupEl.classList.add("activityGroup");

    const groupLabel = document.createElement("div");
    groupLabel.classList.add("activityGroupLabel");
    groupLabel.textContent = label;

    const rail = document.createElement("div");
    rail.classList.add("activityRail");

    items.forEach((item) => {
      rail.appendChild(buildEntry(item));
    });

    groupEl.append(groupLabel, rail);
    log.appendChild(groupEl);
  });

  section.append(title, log);
  container.append(section);
}

function renderPlaceholder(container, message, withUpgradeLink) {
  const p = document.createElement("p");
  p.classList.add("placeholderText");
  p.textContent = message;

  if (withUpgradeLink) {
    const a = document.createElement("a");
    a.href = "https://loghue.com/pricing";
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Upgrade";
    p.append(" ", a);
  }

  container.append(p);
}

function groupByDay(activities) {
  const sorted = [...activities].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );

  const groups = [];
  const seen = new Map();

  sorted.forEach((item) => {
    const dayKey = new Date(item.created_at).toDateString();
    const label = dayLabel(item.created_at);

    if (!seen.has(dayKey)) {
      const group = { label, items: [] };
      seen.set(dayKey, group);
      groups.push(group);
    }
    seen.get(dayKey).items.push(item);
  });

  return groups;
}

function dayLabel(dateString) {
  const date = new Date(dateString);
  const now = new Date();

  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOf(now) - startOf(date)) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function buildEntry(item) {
  const actor = item.actor;
  const avatar =
    actor?.avatar_url || "https://loghue.com/assets/default-avatar.png";
  const name = actor?.full_name || "Unknown User";
  const isTaskLog = item.type === "task_log";

  const label = isTaskLog
    ? `gave an update on "${item.title || "Unknown Task"}"`
    : `started a discussion "${item.title || "Untitled"}"`;

  const entry = document.createElement("div");
  entry.classList.add(
    "logEntry",
    isTaskLog ? "logEntry-task" : "logEntry-discussion",
  );

  const marker = document.createElement("div");
  marker.classList.add("logMarker");
  const dot = document.createElement("span");
  dot.classList.add("logDot");
  marker.appendChild(dot);

  const main = document.createElement("div");
  main.classList.add("logMain");

  const headline = document.createElement("div");
  headline.classList.add("logHeadline");

  const profileImg = document.createElement("img");
  profileImg.classList.add("logAvatar");
  profileImg.src = avatar;
  profileImg.alt = name;

  const text = document.createElement("span");
  text.classList.add("logText");
  const strongName = document.createElement("strong");
  strongName.textContent = name;
  text.append(strongName, document.createTextNode(` ${label}`));

  const time = document.createElement("time");
  time.classList.add("logTime");
  time.textContent = formatDateTime(item.created_at);

  headline.append(profileImg, text, time);

  const detail = document.createElement("div");
  detail.classList.add("logDetail");

  if (isTaskLog) {
    const note = document.createElement("p");
    note.classList.add("logNote");
    note.textContent = item.note || "";

    const statusClass = item.status === "in progress" ? "in-progress" : "completed";
    const status = document.createElement("span");
    status.classList.add("statusBadge", statusClass);
    status.textContent = item.status || "";

    detail.append(note, status);
  } else {
    const message = document.createElement("p");
    message.classList.add("logNote");
    message.textContent = item.note || "";
    detail.append(message);
  }

  const openLink = document.createElement("button");
  openLink.type = "button";
  openLink.classList.add("logOpenLink");
  openLink.textContent = isTaskLog ? "View task" : "View discussion";
  openLink.onclick = () => {
    if (isTaskLog) {
      window.location.href = `task-view?task=${item.task_id}`;
    } else {
      window.location.href = `discussion-view?dcn=${item.id}`;
    }
  };
  detail.appendChild(openLink);

  main.append(headline, detail);
  entry.append(marker, main);
  return entry;
}
