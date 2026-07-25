import { sessionState } from "../../session.js";
import { formatDateTime } from "../../utils/time.js";

// -------------------------------------------------------------------
// ACTIVITIES (shared)
// -------------------------------------------------------------------
export function loadActivities(activities, container) {
  if (sessionState.plan.name === "free" || sessionState.plan.name === "Free") {
    const p = document.createElement("p");
    p.classList.add("placeholderText");
    p.textContent =
      "Workspace activities overview is not available on your current plan. ";
    const a = document.createElement("a");
    a.href = "https://loghue.com/pricing";
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Upgrade";
    p.appendChild(a);
    container.append(p);
    return;
  }

  if (!activities || activities.length === 0) {
    const p = document.createElement("p");
    p.classList.add("placeholderText");
    p.textContent = "No activity in this workspace yet.";
    container.append(p);
    return;
  }

  const section = document.createElement("section");
  section.classList.add("section");
  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "Activities";
  const list = document.createElement("div");
  list.classList.add("activityList", "double-grid");

  activities.forEach((item) => {
    const actor = item.actor;
    const avatar = actor?.avatar_url || "/assets/default-avatar.png";
    const name = actor?.full_name || "Unknown User";
    const label =
      item.type === "task_log"
        ? `gave an update on "${item.title || "Unknown Task"}"`
        : `started a discussion "${item.title || "Untitled"}"`;

    const div = document.createElement("div");
    div.classList.add("activityItem");

    const activityHeader = document.createElement("div");
    activityHeader.classList.add("activityHeader");
    const profileImg = document.createElement("img");
    profileImg.classList.add("profileImg");
    profileImg.src = avatar;
    const actorName = document.createElement("span");
    actorName.classList.add("actorName");
    actorName.textContent = `${name} ${label}`;
    activityHeader.append(profileImg, actorName);

    const activityBody = document.createElement("div");
    activityBody.classList.add("activityBody");
    if (item.type === "task_log") {
      const note = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = "Update: ";
      note.append(strong, document.createTextNode(item.note || ""));
      const status = document.createElement("p");
      const statusLabel = document.createElement("strong");
      statusLabel.textContent = "Status: ";
      const statusValue = document.createElement("span");
      statusValue.classList.add("statusBadge");
      statusValue.textContent = item.status || "";
      status.append(statusLabel, statusValue);
      activityBody.append(note, status);
    } else {
      const msg = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = "Message: ";
      msg.append(strong, document.createTextNode(item.note || ""));
      activityBody.append(msg);
    }

    const activityTime = document.createElement("div");
    activityTime.classList.add("activityTime");
    activityTime.textContent = formatDateTime(item.created_at);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("btn", "pageOpenLink", "btn-primary");
    btn.textContent = "Open";
    if (item.type === "discussion") {
      btn.onclick = () =>
        (window.location.href = `https://app.loghue.com/discussion-view?dcn=${item.id}`);
    } else if (item.type === "task_log") {
      btn.onclick = () =>
        (window.location.href = `https://app.loghue.com/task-view?task=${item.task_id}`);
    }

    div.append(activityHeader, activityBody, activityTime, btn);
    list.appendChild(div);
  });

  section.append(title, list);
  container.append(section);
}
