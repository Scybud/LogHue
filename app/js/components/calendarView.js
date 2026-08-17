import { savedTaskDetails, toggleTaskCompletion } from "../pages/personalTasks.js";

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
    els.modeListBtn?.addEventListener("click", () => setMode("list", els.listContainer));
    els.modeCalendarBtn?.addEventListener("click", () => setMode("calendar", els.listContainer));
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
    mode = next;
    els.modeListBtn?.classList.toggle("active", mode === "list");
    els.modeCalendarBtn?.classList.toggle("active", mode === "calendar");
    els.listContainer.hidden = mode !== "list";
    els.calContainer.hidden = mode !== "calendar";
    if (els.viewPills) els.viewPills.hidden = mode !== "calendar";
    if (els.calendarNav) els.calendarNav.hidden = mode !== "calendar";
    if (els.calendarClock) els.calendarClock.hidden = mode !== "calendar";
    if (mode === "calendar") {
listContainer?.classList.add("hide");
        render();
    } 
    if (mode === "list") {
      listContainer?.classList.remove("hide");
      render();
    } 
    
}

function setView(next) {
    view = next;
    els.viewPills?.querySelectorAll(".viewPill").forEach((b) => {
        b.classList.toggle("active", b.dataset.view === view);
    });
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
    return h === 0 ? "12 AM" : h < 12 ? h + " AM" : h === 12 ? "12 PM" : h - 12 + " PM";
}
function fmtTime(d) {
    let h = d.getHours(),
        m = d.getMinutes();
    const ap = h < 12 ? "AM" : "PM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${m.toString().padStart(2, "0")} ${ap}`;
}

// Only tasks with a real deadline can be placed on the calendar. Tasks
// created before task_deadline was required (or any legacy null rows) are
// skipped here and remain visible only in list view.
function scheduledTasks() {
    return savedTaskDetails.filter((t) => t.task_deadline);
}
function deadlineDate(t) {
    return new Date(t.task_deadline);
}
function isOverdue(t) {
    return !t.is_completed && deadlineDate(t) < new Date();
}
function stateClass(t) {
    return t.is_completed ? "done" : isOverdue(t) ? "overdue" : "";
}

function taskChip(t, cls) {
    const el = document.createElement("div");
    el.className = `${cls} ${stateClass(t)}`;
    el.dataset.id = t.id;
    el.innerHTML = `<span class="chipTitle">${escapeHtml(t.name)}</span>`;
    el.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleTaskCompletion(t.id, !t.is_completed);
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
            : days[0].toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

    els.calContainer.innerHTML = `
    <div class="calDayHeaders" style="grid-template-columns:56px repeat(${numDays},1fr)">
      <div class="calSpacer"></div>
      ${days
          .map(
              (d) => `<div class="calDayHead ${sameDay(d, today) ? "isToday" : ""}" data-jump="${d.toISOString()}">
        <div class="calDow">${d.toLocaleDateString(undefined, { weekday: "short" })}</div>
        <div class="calDom">${d.getDate()}</div>
      </div>`
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
        scheduledTasks()
            .filter((t) => sameDay(deadlineDate(t), colDate))
            .forEach((t) => {
                const d = deadlineDate(t);
                const el = document.createElement("div");
                el.className = `calTask ${stateClass(t)}`;
                el.style.top = d.getHours() * ROW_H + (d.getMinutes() / 60) * ROW_H + 2 + "px";
                el.style.height = ROW_H - 6 + "px";
                el.dataset.id = t.id;
                el.innerHTML = `<span class="calTaskTime">${fmtTime(d)}</span><span class="calTaskTitle">${escapeHtml(t.name)}</span>`;
                el.addEventListener("click", () => toggleTaskCompletion(t.id, !t.is_completed));
                col.appendChild(el);
            });
        if (sameDay(colDate, today)) {
            const line = document.createElement("div");
            line.className = "calNowLine";
            const now = new Date();
            line.style.top = ((now.getHours() * 60 + now.getMinutes()) / 60) * ROW_H + "px";
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
    els.rangeText.textContent = anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const dows = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let cells = "";
    for (let i = 0; i < 42; i++) {
        const d = addDays(start, i);
        const outside = d.getMonth() !== anchor.getMonth();
        const isToday = sameDay(d, today);
        const dayTasks = scheduledTasks().filter((t) => sameDay(deadlineDate(t), d));
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
            const dayTasks = scheduledTasks().filter((t) => sameDay(deadlineDate(t), d));
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
    els.rangeText.textContent = "Today, " + today.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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