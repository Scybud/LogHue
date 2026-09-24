import {
  savedTaskDetails,
  toggleTaskCompletion,
} from "../pages/personalTasks.js";
import { logEvent } from "../utils/logEvent.js";

const ROW_H = 60;

let mode = "list"; // "list" | "calendar" — list is the existing default view
let view = "week"; // "year" | "month" | "week" | "day" | "hour"
let anchor = new Date();

let els = {};

export function initCalendarView() {
  els = {
    listContainer: document.getElementById("personalCreatedTasks"),
    calContainer: document.getElementById("personalTasksCalendar"),
    modeListBtn: document.getElementById("modeListBtn"),
    modeCalendarBtn: document.getElementById("modeCalendarBtn"),
    viewPills: document.getElementById("calendarViewPills"),
    calendarNav: document.getElementById("calendarNav"),
    calendarClock: document.getElementById("calendarClock"),
    rangeText: document.getElementById("calendarRangeText"),
    prevBtn: document.getElementById("calPrevBtn"),
    nextBtn: document.getElementById("calNextBtn"),
    clockTime: document.getElementById("calClockTime"),
  };

  if (!els.calContainer) return; // calendar markup not present on this page
  els.modeListBtn?.addEventListener("click", () =>
    setMode("list", els.listContainer),
  );
  els.modeCalendarBtn?.addEventListener("click", () =>
    setMode("calendar", els.listContainer),
  );
  els.viewPills?.querySelectorAll(".viewPill").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });
  els.prevBtn?.addEventListener("click", () => {
    shiftAnchor(-1);
    render();
  });
  els.nextBtn?.addEventListener("click", () => {
    shiftAnchor(1);
    render();
  });
  // personalTasks.js dispatches this after any create/toggle/delete so the
  // calendar stays in sync without polling or a second query.
  document.addEventListener("personalTasksUpdated", () => {
    if (mode === "calendar") render();
  });
  setInterval(() => {
    if (mode === "calendar") render();
  }, 60000);
}

function setMode(next, listContainer) {
  if (next === mode) return;
  mode = next;
  els.modeListBtn?.classList.toggle("active", mode === "list");
  els.modeCalendarBtn?.classList.toggle("active", mode === "calendar");
  els.listContainer.hidden = mode !== "list";
  els.calContainer.hidden = mode !== "calendar";
  if (els.viewPills) els.viewPills.hidden = mode !== "calendar";
  if (els.calendarNav) els.calendarNav.hidden = mode !== "calendar";
  if (els.calendarClock) els.calendarClock.hidden = mode !== "calendar";
  logEvent("calendar_vs_list_toggle", { chosen_view: mode });
  if (mode === "calendar") {
    els.listContainer?.classList.add("hide");
    els.prevBtn?.classList.remove("hide");
    els.calendarNav?.classList.remove("hide");
    els.calendarClock?.classList.remove("hide");
    els.nextBtn?.classList.remove("hide");
    els.viewPills?.classList.remove("hide");
    logEvent("calendar_view_opened", { view });
    render();
  }
  if (mode === "list") {
    els.listContainer?.classList.remove("hide");
    els.prevBtn?.classList.add("hide");
    els.calendarNav?.classList.add("hide");
    els.calendarClock?.classList.add("hide");
    els.nextBtn?.classList.add("hide");
    els.viewPills?.classList.add("hide");

    render();
  }
}

function setView(next) {
  if (next === view) return;
  const from = view;
  view = next;
  els.viewPills?.querySelectorAll(".viewPill").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
  });
  logEvent("calendar_view_switched", { from_view: from, to_view: view });
  render();
}

function shiftAnchor(dir) {
  if (view === "week") anchor = addDays(anchor, 7 * dir);
  else if (view === "day") anchor = addDays(anchor, 1 * dir);
  else if (view === "month") anchor = addMonths(anchor, 1 * dir);
  else if (view === "year") anchor = addMonths(anchor, 12 * dir);
}

// --- helpers ---
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function addMonths(d, n) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function getMonday(d) {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}
function fmtHour(h) {
  return h === 0
    ? "12 AM"
    : h < 12
      ? h + " AM"
      : h === 12
        ? "12 PM"
        : h - 12 + " PM";
}
function fmtTime(d) {
  let h = d.getHours(),
    m = d.getMinutes();
  const ap = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m.toString().padStart(2, "0")} ${ap}`;
}

function scheduledTasks() {
  return savedTaskDetails.filter((t) => t.task_deadline && !t.is_template);
}
function deadlineDate(t) {
  return new Date(t.task_deadline);
}
// Real start/end when the task has them, falling back to the deadline as a
// point in time for tasks that don't set start/end.
function taskStart(t) {
  return t.start_time ? new Date(t.start_time) : deadlineDate(t);
}
function taskEnd(t) {
  if (t.end_time) return new Date(t.end_time);
  return new Date(taskStart(t).getTime() + VISUAL_DURATION_MIN * 60000);
}
function isOverdue(t) {
  return !t.is_completed && deadlineDate(t) < new Date() && !t.is_template;
}
function stateClass(t) {
  return t.is_completed ? "done" : isOverdue(t) ? "overdue" : "";
}

function taskState(t) {
  return t.is_completed ? "done" : isOverdue(t) ? "overdue" : "pending";
}

// Tasks with a real start_time/end_time render as an actual duration block.
// Tasks without one are still just a point in time (the deadline), but their
// chip needs real vertical space to be visible, so it gets a synthetic
// "visual duration" equal to one chip height. Either way, two tasks close
// enough together that their blocks would visually overlap need to sit side
// by side instead of stacked on top of each other. This packs overlapping
// tasks into columns the same way calendar apps lay out concurrent events:
// sort by start, group anything whose window overlaps the running group end
// into a cluster, then within each cluster greedily assign the first free
// column.
const VISUAL_DURATION_MIN = (ROW_H - 6) * (60 / ROW_H);
const MIN_CHIP_MIN = VISUAL_DURATION_MIN; // floor so a short real duration stays readable

function layoutDayEvents(tasks) {
  const events = tasks
    .map((t) => {
      const start = taskStart(t);
      let end = taskEnd(t);
      if (end - start < MIN_CHIP_MIN * 60000) {
        end = new Date(start.getTime() + MIN_CHIP_MIN * 60000);
      }
      return { task: t, start, end, col: 0, totalCols: 1 };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  let cluster = [];
  let clusterEnd = null;
  const clusters = [];

  events.forEach((ev) => {
    if (cluster.length === 0 || ev.start < clusterEnd) {
      cluster.push(ev);
      clusterEnd = clusterEnd && clusterEnd > ev.end ? clusterEnd : ev.end;
    } else {
      clusters.push(cluster);
      cluster = [ev];
      clusterEnd = ev.end;
    }
  });
  if (cluster.length) clusters.push(cluster);

  clusters.forEach((clusterEvents) => {
    const columnEnds = []; // columnEnds[i] = end time of the last event placed in column i
    clusterEvents.forEach((ev) => {
      let placedCol = -1;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= ev.start) {
          placedCol = c;
          break;
        }
      }
      if (placedCol === -1) placedCol = columnEnds.length;
      columnEnds[placedCol] = ev.end;
      ev.col = placedCol;
    });
    const totalCols = columnEnds.length;
    clusterEvents.forEach((ev) => (ev.totalCols = totalCols));
  });

  return events;
}

function handleTaskClick(t) {
  logEvent("calendar_task_clicked", { task_status: taskState(t) });
  toggleTaskCompletion(t.id, !t.is_completed);
}

function taskChip(t, cls) {
  const el = document.createElement("div");
  el.className = `${cls} ${stateClass(t)}`;
  el.dataset.id = t.id;
  el.title = escapeHtml(t.name);
  el.innerHTML = `<span class="chipTitle">${escapeHtml(t.name)}</span>`;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    handleTaskClick(t);
  });
  return el;
}
function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

// --- render dispatch ---
function render() {
  const now = new Date();
  if (els.clockTime) {
    els.clockTime.textContent =
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0");
  }
  if (els.prevBtn) els.prevBtn.disabled = view === "hour";
  if (els.nextBtn) els.nextBtn.disabled = view === "hour";

  if (view === "week") renderGrid(7);
  else if (view === "day") renderGrid(1);
  else if (view === "month") renderMonth();
  else if (view === "year") renderYear();
  else if (view === "hour") renderAgenda();
}

function renderGrid(numDays) {
  const start =
    numDays === 7
      ? getMonday(anchor)
      : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const days = Array.from({ length: numDays }, (_, i) => addDays(start, i));
  const today = new Date();

  els.rangeText.textContent =
    numDays === 7
      ? `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { day: "numeric" })}`
      : days[0].toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        });

  els.calContainer.innerHTML = `
    <div class="calDayHeaders" style="grid-template-columns:56px repeat(${numDays},1fr)">
      <div class="calSpacer"></div>
      ${days
        .map(
          (
            d,
          ) => `<div class="calDayHead ${sameDay(d, today) ? "isToday" : ""}" data-jump="${d.toISOString()}">
        <div class="calDow">${d.toLocaleDateString(undefined, { weekday: "short" })}</div>
        <div class="calDom">${d.getDate()}</div>
      </div>`,
        )
        .join("")}
    </div>
    <div class="calGridScroll">
      <div class="calHourGrid" style="grid-template-columns:56px repeat(${numDays},1fr)">
        <div class="calHourLabels" style="grid-column:1;display:contents"></div>
        ${days.map((d, i) => `<div class="calDayCol" data-idx="${i}" data-date="${d.toISOString()}"></div>`).join("")}
      </div>
    </div>`;

  const labelsHost = els.calContainer.querySelector(".calHourLabels");
  for (let h = 0; h < 24; h++) {
    const lbl = document.createElement("div");
    lbl.className = "calHourLabel";
    lbl.style.gridColumn = "1";
    lbl.style.gridRow = String(h + 1);
    lbl.textContent = fmtHour(h);
    labelsHost.appendChild(lbl);
  }
  els.calContainer.querySelectorAll(".calDayCol").forEach((col, i) => {
    col.style.gridColumn = String(i + 2);
    col.style.gridRow = "1 / span 24";
    for (let h = 0; h < 24; h++) {
      const cell = document.createElement("div");
      cell.className = "calHourCell";
      col.appendChild(cell);
    }
  });

  els.calContainer.querySelectorAll(".calDayCol").forEach((col) => {
    const colDate = new Date(col.dataset.date);
    const dayTasks = scheduledTasks().filter((t) =>
      sameDay(taskStart(t), colDate),
    );
    const laidOut = layoutDayEvents(dayTasks);

    laidOut.forEach(({ task: t, start: d, end, col: colIdx, totalCols }) => {
      const el = document.createElement("div");
      const hasRealDuration = Boolean(t.start_time && t.end_time);
      el.className = `calTask ${stateClass(t)} ${hasRealDuration ? "hasDuration" : ""}`;
      el.title = t.name;
      const widthPct = 100 / totalCols;
      const top = d.getHours() * ROW_H + (d.getMinutes() / 60) * ROW_H + 2;
      const durationMin = (end - d) / 60000;
      const height = Math.min((durationMin / 60) * ROW_H - 6, 24 * ROW_H - top);
      el.style.top = top + "px";
      el.style.height = height + "px";
      el.style.left = `calc(${colIdx * widthPct}% + 2px)`;
      el.style.width = `calc(${widthPct}% - 4px)`;
      el.dataset.id = t.id;
      const timeLabel = hasRealDuration
        ? `${fmtTime(d)} – ${fmtTime(end)}`
        : fmtTime(d);
      el.innerHTML = `<span class="calTaskTime">${timeLabel}</span><span class="calTaskTitle">${escapeHtml(t.name)}</span>`;
      el.addEventListener("click", () => handleTaskClick(t));
      col.appendChild(el);
    });
    if (sameDay(colDate, today)) {
      const line = document.createElement("div");
      line.className = "calNowLine";
      const now = new Date();
      line.style.top =
        ((now.getHours() * 60 + now.getMinutes()) / 60) * ROW_H + "px";
      col.appendChild(line);
    }
  });

  els.calContainer.querySelectorAll(".calDayHead").forEach((h) => {
    h.addEventListener("click", () => {
      anchor = new Date(h.dataset.jump);
      setView("day");
    });
  });

  const scrollBox = els.calContainer.querySelector(".calGridScroll");
  scrollBox.scrollTop = Math.max(0, new Date().getHours() - 2) * ROW_H;
}

function renderMonth() {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = getMonday(first);
  const today = new Date();
  els.rangeText.textContent = anchor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const dows = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let cells = "";
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const outside = d.getMonth() !== anchor.getMonth();
    const isToday = sameDay(d, today);
    const dayTasks = scheduledTasks().filter((t) =>
      sameDay(deadlineDate(t), d),
    );
    const visible = dayTasks.slice(0, 2);
    const extra = dayTasks.length - visible.length;
    cells += `<div class="calMonthCell ${outside ? "outside" : ""} ${isToday ? "isToday" : ""}" data-jump="${d.toISOString()}">
      <span class="calMonthNum">${d.getDate()}</span>
      <div class="calMonthChips" data-day="${d.toISOString()}"></div>
      ${extra > 0 ? `<div class="calMonthMore">+${extra} more</div>` : ""}
    </div>`;
  }

  els.calContainer.innerHTML = `
    <div class="calMonthGrid">${dows.map((d) => `<div class="calMonthDow">${d}</div>`).join("")}</div>
    <div class="calMonthGrid">${cells}</div>`;

  els.calContainer.querySelectorAll(".calMonthChips").forEach((host) => {
    const d = new Date(host.dataset.day);
    scheduledTasks()
      .filter((t) => sameDay(deadlineDate(t), d))
      .slice(0, 2)
      .forEach((t) => host.appendChild(taskChip(t, "calMonthChip")));
  });

  els.calContainer.querySelectorAll(".calMonthCell").forEach((c) => {
    c.addEventListener("click", () => {
      anchor = new Date(c.dataset.jump);
      setView("day");
    });
  });
}

function renderYear() {
  els.rangeText.textContent = anchor.getFullYear().toString();
  const today = new Date();
  let html = '<div class="calYearGrid">';
  for (let m = 0; m < 12; m++) {
    const monthDate = new Date(anchor.getFullYear(), m, 1);
    const start = getMonday(monthDate);
    let dayCells = "";
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      if (d.getMonth() !== m) {
        dayCells += `<div class="calYearDay"></div>`;
        continue;
      }
      const isToday = sameDay(d, today);
      const dayTasks = scheduledTasks().filter((t) =>
        sameDay(deadlineDate(t), d),
      );
      const hasOverdue = dayTasks.some((t) => isOverdue(t));
      dayCells += `<div class="calYearDay ${isToday ? "isToday" : ""} ${dayTasks.length ? "hasTask" : ""} ${hasOverdue ? "hasOverdue" : ""}">${d.getDate()}</div>`;
    }
    html += `<div class="calYearMonth" data-jump="${monthDate.toISOString()}">
      <div class="calYearTitle">${monthDate.toLocaleDateString(undefined, { month: "long" })}</div>
      <div class="calYearDayGrid">${dayCells}</div>
    </div>`;
  }
  html += "</div>";
  els.calContainer.innerHTML = html;
  els.calContainer.querySelectorAll(".calYearMonth").forEach((el) => {
    el.addEventListener("click", () => {
      anchor = new Date(el.dataset.jump);
      setView("month");
    });
  });
}

function renderAgenda() {
  const today = new Date();
  els.rangeText.textContent =
    "Today, " +
    today.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const now = new Date();
  let html = '<div class="calAgenda">';
  for (let h = 0; h < 24; h++) {
    const isNow = now.getHours() === h;
    html += `<div class="calAgendaSlot ${isNow ? "isNow" : ""}">
      <div class="calAgendaHour">${fmtHour(h)}</div>
      <div class="calAgendaTasks" data-hour="${h}"></div>
    </div>`;
  }
  html += "</div>";
  els.calContainer.innerHTML = html;

  els.calContainer.querySelectorAll(".calAgendaTasks").forEach((host) => {
    const h = Number(host.dataset.hour);
    const hourTasks = scheduledTasks().filter((t) => {
      const d = deadlineDate(t);
      return sameDay(d, today) && d.getHours() === h;
    });
    if (!hourTasks.length) {
      host.innerHTML = '<span class="calAgendaEmpty">—</span>';
      return;
    }
    hourTasks.forEach((t) => host.appendChild(taskChip(t, "calTask")));
  });

  const nowSlot = els.calContainer.querySelector(".calAgendaSlot.isNow");
  if (nowSlot) nowSlot.scrollIntoView({ block: "center" });
}
