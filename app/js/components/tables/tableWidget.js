/*

TABLE WIDGET
Renders and manages a single interactive table (add/remove row/col,
editable cells, expand cell). Used two ways:
  1. Standalone table notes (note_type: "table") — one table fills the pane.
  2. Inline tables embedded inside Quill text notes via table-embed blots.

A table object has the shape:
  { id: string, name: string, cols: string[], rows: string[][] }

This module never touches Supabase or note state directly — callers pass
an onChange(table) callback and persist it themselves (autosave, etc).

*/

let idSeq = 0;
function uid() {
  return "tbl_" + Date.now().toString(36) + "_" + idSeq++;
}

export function createTable(name = "Untitled table") {
  return {
    id: uid(),
    name,
    cols: ["Column 1", "Column 2", "Column 3"],
    rows: [
      ["", "", ""],
      ["", "", ""],
    ],
  };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const ICONS = {
  plus: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  close: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  expand: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12"/></svg>`,
};

/**
 * Renders `table` into `container`. Re-renders in place on every structural
 * change (add/remove row/col) since those are infrequent; cell text edits
 * update the data model directly without a full re-render, so focus is
 * never lost while typing.
 *
 * options:
 *   onChange(table)  — called after any edit (debounce/autosave upstream)
 *   onDelete()        — optional, shows a delete-table button in the header
 *   allowNameEdit      — default true
 */
export function renderTableWidget(container, table, options = {}) {
  const {
    onChange = () => {},
    onDelete = null,
    allowNameEdit = true,
  } = options;

  function emitChange() {
    onChange(table);
  }

  function rerender() {
    build();
  }

  function build() {
    container.innerHTML = "";
    container.classList.add("tableWidget");

    // header
    const head = document.createElement("div");
    head.className = "tableWidgetHead";

    if (allowNameEdit) {
      const nameInput = document.createElement("input");
      nameInput.className = "tableWidgetName";
      nameInput.placeholder = "Untitled table";
      nameInput.value = table.name || "";
      nameInput.addEventListener("input", (e) => {
        table.name = e.target.value;
        emitChange();
      });
      head.appendChild(nameInput);
    } else {
      const nameLabel = document.createElement("div");
      nameLabel.className = "tableWidgetName tableWidgetNameStatic";
      nameLabel.textContent = table.name || "Untitled table";
      head.appendChild(nameLabel);
    }

    if (onDelete) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "tableWidgetIconBtn";
      delBtn.title = "Delete table";
      delBtn.innerHTML = ICONS.trash;
      delBtn.addEventListener("click", onDelete);
      head.appendChild(delBtn);
    }

    container.appendChild(head);

    // scroll area + grid
    const scrollArea = document.createElement("div");
    scrollArea.className = "tableWidgetScroll";

    const grid = document.createElement("table");
    grid.className = "tableWidgetGrid";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    const corner = document.createElement("th");
    corner.className = "tableRowHead";
    headRow.appendChild(corner);

    table.cols.forEach((colName, ci) => {
      const th = document.createElement("th");
      const wrap = document.createElement("div");
      wrap.className = "tableColHead";

      const labelInput = document.createElement("input");
      labelInput.className = "tableColLabel";
      labelInput.placeholder = "Column";
      labelInput.value = colName;
      labelInput.addEventListener("input", (e) => {
        table.cols[ci] = e.target.value;
        emitChange();
      });
      wrap.appendChild(labelInput);

      if (table.cols.length > 1) {
        const delCol = document.createElement("button");
        delCol.type = "button";
        delCol.className = "tableColDel";
        delCol.title = "Delete column";
        delCol.innerHTML = ICONS.close;
        delCol.addEventListener("click", () => {
          table.cols.splice(ci, 1);
          table.rows.forEach((r) => r.splice(ci, 1));
          emitChange();
          rerender();
        });
        wrap.appendChild(delCol);
      }

      th.appendChild(wrap);
      headRow.appendChild(th);
    });

    const addColTh = document.createElement("th");
    addColTh.className = "tableAddColCell";
    const addColBtn = document.createElement("button");
    addColBtn.type = "button";
    addColBtn.className = "tableAddColBtn";
    addColBtn.title = "Add column";
    addColBtn.innerHTML = ICONS.plus;
    addColBtn.addEventListener("click", () => {
      table.cols.push("Column " + (table.cols.length + 1));
      table.rows.forEach((r) => r.push(""));
      emitChange();
      rerender();
    });
    addColTh.appendChild(addColBtn);
    headRow.appendChild(addColTh);

    thead.appendChild(headRow);
    grid.appendChild(thead);

    const tbody = document.createElement("tbody");
    table.rows.forEach((row, ri) => {
      const tr = document.createElement("tr");

      const rowHeadTd = document.createElement("td");
      rowHeadTd.className = "tableRowHead";
      rowHeadTd.textContent = ri + 1;
      if (table.rows.length > 1) {
        const delRow = document.createElement("button");
        delRow.type = "button";
        delRow.className = "tableRowDel";
        delRow.title = "Delete row";
        delRow.innerHTML = ICONS.close;
        delRow.addEventListener("click", () => {
          table.rows.splice(ri, 1);
          emitChange();
          rerender();
        });
        rowHeadTd.appendChild(delRow);
      }
      tr.appendChild(rowHeadTd);

      row.forEach((val, ci) => {
        const td = document.createElement("td");
        const cellWrap = document.createElement("div");
        cellWrap.className = "tableCellWrap";

        const cell = document.createElement("div");
        cell.className = "tableCell";
        cell.contentEditable = "true";
        cell.textContent = val;
        cell.addEventListener("input", () => {
          table.rows[ri][ci] = cell.textContent;
          emitChange();
        });
        cellWrap.appendChild(cell);

        const expandBtn = document.createElement("button");
        expandBtn.type = "button";
        expandBtn.className = "tableCellExpandBtn";
        expandBtn.title = "Expand cell";
        expandBtn.innerHTML = ICONS.expand;
        expandBtn.addEventListener("click", () => {
          openCellEditorModal(table.rows[ri][ci], (newVal) => {
            table.rows[ri][ci] = newVal;
            cell.textContent = newVal;
            emitChange();
          });
        });
        cellWrap.appendChild(expandBtn);

        td.appendChild(cellWrap);
        tr.appendChild(td);
      });

      const spacer = document.createElement("td");
      spacer.className = "tableAddColCell";
      tr.appendChild(spacer);

      tbody.appendChild(tr);
    });

    grid.appendChild(tbody);
    scrollArea.appendChild(grid);
    container.appendChild(scrollArea);

    const addRow = document.createElement("button");
    addRow.type = "button";
    addRow.className = "tableAddRowStrip";
    addRow.innerHTML = ICONS.plus + "<span>Add row</span>";
    addRow.addEventListener("click", () => {
      table.rows.push(table.cols.map(() => ""));
      emitChange();
      rerender();
    });
    container.appendChild(addRow);
  }

  build();
}

/* Shared "expand cell" modal, lazily created once per page */
let modalEl = null;
function ensureCellModal() {
  if (modalEl) return modalEl;

  modalEl = document.createElement("div");
  modalEl.className = "tableCellModalVeil";
  modalEl.innerHTML = `
    <div class="tableCellModal">
      <div class="tableCellModalHead">
        <span>Edit cell</span>
        <button type="button" class="tableWidgetIconBtn" data-close>${ICONS.close}</button>
      </div>
      <textarea class="tableCellModalTextarea"></textarea>
      <div class="tableCellModalActions">
        <button type="button" class="btn btn-sm" data-save>Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeCellModal();
  });
  modalEl
    .querySelector("[data-close]")
    .addEventListener("click", closeCellModal);

  return modalEl;
}

function closeCellModal() {
  if (modalEl) modalEl.classList.remove("open");
}

function openCellEditorModal(value, onSave) {
  const modal = ensureCellModal();
  const textarea = modal.querySelector(".tableCellModalTextarea");
  const saveBtn = modal.querySelector("[data-save]");

  textarea.value = value || "";
  modal.classList.add("open");
  textarea.focus();

  const saveHandler = () => {
    onSave(textarea.value);
    closeCellModal();
    saveBtn.removeEventListener("click", saveHandler);
  };
  saveBtn.addEventListener("click", saveHandler, { once: true });
}

/* Static HTML rendering for export (PDF/HTML) — no editing affordances */
export function renderTableToHTML(table) {
  if (!table) return "";
  const colHtml = table.cols
    .map(
      (c) =>
        `<th style="border:1px solid #ccc;padding:6px 10px;background:#f3f3f3;text-align:left;">${escapeHtml(c)}</th>`,
    )
    .join("");
  const rowsHtml = table.rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="border:1px solid #ccc;padding:6px 10px;">${escapeHtml(cell)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  const titleHtml = table.name
    ? `<div style="font-weight:600;margin:14px 0 6px;">${escapeHtml(table.name)}</div>`
    : "";

  return `${titleHtml}<table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
    <thead><tr>${colHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>`;
}
