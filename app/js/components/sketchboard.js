// sketchBoard.js
// Natural drawing + palm rejection + shape refinement (line / rect / circle / triangle)

let board = null;
let context = null;
let isdrawing = false;
let sketchTool = "pen"; // "pen" | "eraser" | "text"
let undoStack = [];
const UNDO_LIMIT = 20;

let currentStroke = null;
let shapeHoldTimer = null;
const SHAPE_HOLD_MS = 700;

const BOARD_WIDTH = 1920;
const BOARD_HEIGHT = 1080;

// Callback provided by the parent module
let onStrokeFinished = null;

/**
 * Initialize the sketch board.
 * Call this once after the sketch pane HTML is in the DOM.
 *
 * @param {Object} options
 * @param {Function} options.onStrokeFinished - called after a stroke is committed (or refined)
 */
export function initSketchBoard(options = {}) {
  onStrokeFinished = options.onStrokeFinished || (() => {});

  board = document.getElementById("board");
  if (!board) return;
  context = board.getContext("2d");

  const colorPicker = document.getElementById("color-picker");
  const brushSize = document.getElementById("brush-size");
  const penToolBtn = document.getElementById("pen-tool-button");
  const eraserToolBtn = document.getElementById("eraser-tool-button");
  const undoBtn = document.getElementById("undo-button");
  const clearBtn = document.getElementById("clear-button");
  const fillBtn = document.getElementById("fill-button");
  const downloadBtn = document.getElementById("download-button");

  board.style.touchAction = "none";

  // ---------- Pointer events (with palm rejection) ----------
  board.addEventListener("pointerdown", (e) => {
    // Palm rejection
    if (e.pointerType === "touch" && e.isPrimary === false) return;
    if (e.width > 40 || e.height > 40) return;

    if (sketchTool === "text") {
      placeSketchText(e);
      return;
    }

    board.setPointerCapture(e.pointerId);
    pushUndoSnapshot();
    isdrawing = true;

    const [x, y] = getBoardPos(e);
    currentStroke = {
      points: [{ x, y }],
      tool: sketchTool,
      color: colorPicker.value,
      size: +brushSize.value,
    };

    context.beginPath();
    context.moveTo(x, y);
  });

  board.addEventListener("pointermove", (e) => {
    if (!isdrawing || !currentStroke) return;
    if (e.pointerType === "touch" && e.isPrimary === false) return;

    const [x, y] = getBoardPos(e);
    currentStroke.points.push({ x, y });

    context.lineWidth =
      currentStroke.tool === "eraser"
        ? currentStroke.size * 3
        : currentStroke.size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalCompositeOperation =
      currentStroke.tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = currentStroke.color;

    context.lineTo(x, y);
    context.stroke();
    context.beginPath();
    context.moveTo(x, y);
  });

  board.addEventListener("pointerup", () => {
    if (!isdrawing) return;
    isdrawing = false;
    context.beginPath();
    context.globalCompositeOperation = "source-over";

    if (
      currentStroke &&
      currentStroke.tool === "pen" &&
      currentStroke.points.length > 6
    ) {
      clearTimeout(shapeHoldTimer);
      const pts = currentStroke.points.slice();
      const col = currentStroke.color;
      const sz = currentStroke.size;

      shapeHoldTimer = setTimeout(() => {
        tryRefineShape(pts, col, sz);
        onStrokeFinished();
      }, SHAPE_HOLD_MS);
    } else {
      onStrokeFinished();
    }

    currentStroke = null;
  });

  board.addEventListener("pointercancel", () => {
    isdrawing = false;
    currentStroke = null;
    clearTimeout(shapeHoldTimer);
  });

  // ---------- Toolbar buttons ----------
  clearBtn?.addEventListener("click", () => {
    pushUndoSnapshot();
    clearBoard();
    onStrokeFinished();
  });

  fillBtn?.addEventListener("click", () => {
    pushUndoSnapshot();
    fillBoard();
    onStrokeFinished();
  });

  downloadBtn?.addEventListener("click", downloadBoard);
  undoBtn?.addEventListener("click", () => {
    undoSketch();
    onStrokeFinished();
  });

  penToolBtn?.addEventListener("click", () => setSketchTool("pen"));
  eraserToolBtn?.addEventListener("click", () =>
    setSketchTool(sketchTool === "eraser" ? "pen" : "eraser"),
  );

  setSketchTool("pen");
}

// ---------- Public helpers the parent may need ----------

export function ensureBoardSized() {
  if (!board) return;
  if (board.width === BOARD_WIDTH && board.height === BOARD_HEIGHT) return;
  board.width = BOARD_WIDTH;
  board.height = BOARD_HEIGHT;
}

export function loadImageOntoBoard(dataUrl) {
  ensureBoardSized();
  if (!context) return;
  context.clearRect(0, 0, board.width, board.height);
  if (!dataUrl) return;
  const img = new Image();
  img.onload = () => context.drawImage(img, 0, 0);
  img.src = dataUrl;
}

export function getBoardDataURL() {
  return board ? board.toDataURL("image/png") : null;
}

export function clearSketchUndo() {
  undoStack = [];
}

export function setSketchTool(tool) {
  sketchTool = tool;
  document
    .getElementById("pen-tool-button")
    ?.classList.toggle("active", tool === "pen");
  document
    .getElementById("eraser-tool-button")
    ?.classList.toggle("active", tool === "eraser");
  if (board) {
    board.style.cursor =
      tool === "text" ? "text" : tool === "eraser" ? "cell" : "crosshair";
  }
}

// ---------- Internal helpers ----------

function getBoardPos(e) {
  const rect = board.getBoundingClientRect();
  const scaleX = board.width / rect.width;
  const scaleY = board.height / rect.height;
  return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
}

function clearBoard() {
  context.clearRect(0, 0, board.width, board.height);
}

function fillBoard() {
  const colorPicker = document.getElementById("color-picker");
  context.fillStyle = colorPicker.value;
  context.fillRect(0, 0, board.width, board.height);
}

function downloadBoard() {
  const title = document.getElementById("sketchTitle")?.value || "sketch";
  const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const a = document.createElement("a");
  a.download = `${safeTitle || "sketch"}.png`;
  a.href = board.toDataURL("image/png");
  a.click();
}

function placeSketchText(e) {
  const rect = board.getBoundingClientRect();
  const displayX = e.clientX - rect.left;
  const displayY = e.clientY - rect.top;
  const [boardX, boardY] = getBoardPos(e);
  const colorPicker = document.getElementById("color-picker");

  const editable = document.createElement("div");
  editable.contentEditable = "true";
  editable.className = "sketchTextInput";
  editable.style.position = "absolute";
  editable.style.left = `${displayX}px`;
  editable.style.top = `${displayY}px`;
  editable.style.color = colorPicker.value;
  editable.style.font = "20px sans-serif";
  editable.style.minWidth = "20px";
  editable.style.outline = "1px dashed var(--accent, #3b82f6)";
  editable.style.background = "transparent";
  board.parentElement.appendChild(editable);
  editable.focus();

  const commit = () => {
    const content = editable.textContent.trim();
    editable.remove();
    if (!content) return;
    pushUndoSnapshot();
    const scale = board.width / rect.width;
    context.fillStyle = colorPicker.value;
    context.font = `${20 * scale}px sans-serif`;
    context.textBaseline = "top";
    context.fillText(content, boardX, boardY);
    onStrokeFinished();
  };

  editable.addEventListener("blur", commit, { once: true });
  editable.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      editable.blur();
    }
  });
}

function pushUndoSnapshot() {
  if (!board?.width || !board?.height) return;
  undoStack.push(board.toDataURL("image/png"));
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
}

function undoSketch() {
  const previous = undoStack.pop();
  if (!previous) return;
  const img = new Image();
  img.onload = () => {
    context.clearRect(0, 0, board.width, board.height);
    context.drawImage(img, 0, 0);
  };
  img.src = previous;
}

// ===================== SHAPE RECOGNITION =====================

// ===================== SHAPE RECOGNITION =====================

function tryRefineShape(points, color, size) {
  if (!points || points.length < 10) return;

  const scores = {
    line: scoreLine(points),
    rect: scoreRect(points),
    circle: scoreCircle(points),
    triangle: scoreTriangle(points),
  };

  // Debug (optional – remove later)
  // console.log("Shape scores:", scores);

  let best = null;
  let bestScore = 0.58; // slightly higher confidence needed

  for (const [name, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }

  if (!best) return;

  if (best === "line") {
    redrawStrokeAsLine(points[0], points[points.length - 1], color, size);
  } else if (best === "rect") {
    redrawStrokeAsRect(getBounds(points), color, size);
  } else if (best === "circle") {
    redrawStrokeAsEllipse(getBounds(points), color, size);
  } else if (best === "triangle") {
    const verts = findTriangleVertices(points);
    if (verts) redrawStrokeAsTriangle(verts, color, size);
  }
}

// ---------- Scoring (higher = more confident) ----------

function scoreLine(pts) {
  const a = pts[0];
  const b = pts[pts.length - 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 50) return 0;

  let maxDev = 0;
  let sumDev = 0;
  for (const p of pts) {
    const d = pointToLineDistance(p, a, b);
    maxDev = Math.max(maxDev, d);
    sumDev += d;
  }
  const avgDev = sumDev / pts.length;

  // Very strict – only almost-straight strokes
  if (maxDev > 16 || avgDev > 7) return 0;
  return 1 - avgDev / 10;
}

function scoreRect(pts) {
  const b = getBounds(pts);
  if (b.w < 55 || b.h < 55) return 0;

  const aspect = Math.max(b.w, b.h) / Math.min(b.w, b.h);
  if (aspect > 5.5) return 0; // too thin → more like a line

  const tol = Math.max(16, Math.min(b.w, b.h) * 0.09);
  let onEdge = 0;

  for (const p of pts) {
    const nearL = Math.abs(p.x - b.x) < tol;
    const nearR = Math.abs(p.x - (b.x + b.w)) < tol;
    const nearT = Math.abs(p.y - b.y) < tol;
    const nearB = Math.abs(p.y - (b.y + b.h)) < tol;
    if (nearL || nearR || nearT || nearB) onEdge++;
  }

  const ratio = onEdge / pts.length;
  if (ratio < 0.72) return 0; // must hug the edges well

  // Prefer more square-ish shapes slightly
  const squareBonus = 1 - Math.min(0.35, Math.abs(1 - aspect) * 0.25);
  return ratio * 0.92 * squareBonus;
}

function scoreCircle(pts) {
  const b = getBounds(pts);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const rx = b.w / 2;
  const ry = b.h / 2;

  if (rx < 35 || ry < 35) return 0;

  // Circles should not be too elongated
  const aspect = Math.max(rx, ry) / Math.min(rx, ry);
  if (aspect > 1.45) return 0;

  let sumErr = 0;
  let maxErr = 0;

  for (const p of pts) {
    const dx = (p.x - cx) / rx;
    const dy = (p.y - cy) / ry;
    const r = Math.hypot(dx, dy);
    const err = Math.abs(r - 1);
    sumErr += err;
    maxErr = Math.max(maxErr, err);
  }

  const avgErr = sumErr / pts.length;

  // More forgiving than before but still strict enough
  if (avgErr > 0.32 || maxErr > 0.55) return 0;

  // Bonus for better circularity
  return (1 - avgErr / 0.4) * (aspect < 1.2 ? 1.05 : 0.95);
}

function scoreTriangle(pts) {
  const verts = findTriangleVertices(pts);
  if (!verts) return 0;

  // Check that points lie close to the three sides
  const sides = [
    [verts[0], verts[1]],
    [verts[1], verts[2]],
    [verts[2], verts[0]],
  ];

  let close = 0;
  const tol = 20;

  for (const p of pts) {
    let minD = Infinity;
    for (const [a, b] of sides) {
      minD = Math.min(minD, pointToLineDistance(p, a, b));
    }
    if (minD < tol) close++;
  }

  const ratio = close / pts.length;
  if (ratio < 0.68) return 0;

  // Vertices must be reasonably far apart
  const d01 = Math.hypot(verts[0].x - verts[1].x, verts[0].y - verts[1].y);
  const d12 = Math.hypot(verts[1].x - verts[2].x, verts[1].y - verts[2].y);
  const d20 = Math.hypot(verts[2].x - verts[0].x, verts[2].y - verts[0].y);

  if (d01 < 55 || d12 < 55 || d20 < 55) return 0;

  // Important: penalize if the shape is too rectangular
  // (this prevents rectangles from being classified as triangles)
  const bounds = getBounds(pts);
  const aspect = Math.max(bounds.w, bounds.h) / Math.min(bounds.w, bounds.h);
  if (aspect > 1.8 && ratio < 0.82) return 0;

  return ratio * 0.88;
}

function findTriangleVertices(pts) {
  // Simplify first
  const simplified = douglasPeucker(pts, 22);
  if (simplified.length < 3) return null;

  let best = null;
  let bestArea = 0;

  for (let i = 0; i < simplified.length; i++) {
    for (let j = i + 1; j < simplified.length; j++) {
      for (let k = j + 1; k < simplified.length; k++) {
        const area = triangleArea(simplified[i], simplified[j], simplified[k]);
        if (area > bestArea) {
          bestArea = area;
          best = [simplified[i], simplified[j], simplified[k]];
        }
      }
    }
  }

  // Require a decent sized triangle
  if (!best || bestArea < 1200) return null;
  return best;
}

function triangleArea(a, b, c) {
  return Math.abs(
    (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2,
  );
}

function douglasPeucker(points, epsilon) {
  if (points.length < 3) return points.slice();

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = pointToLineDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[end]];
}

// ---------- Geometry helpers ----------

function getBounds(pts) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function pointToLineDistance(p, a, b) {
  const A = p.x - a.x;
  const B = p.y - a.y;
  const C = b.x - a.x;
  const D = b.y - a.y;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D || 1;
  const t = Math.max(0, Math.min(1, dot / lenSq));
  const xx = a.x + t * C;
  const yy = a.y + t * D;
  return Math.hypot(p.x - xx, p.y - yy);
}

// ---------- Redraw helpers ----------

function redrawStrokeAsLine(a, b, color, size) {
  const last = undoStack[undoStack.length - 1];
  if (!last) return;
  const img = new Image();
  img.onload = () => {
    context.clearRect(0, 0, board.width, board.height);
    context.drawImage(img, 0, 0);
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
  };
  img.src = last;
}

function redrawStrokeAsRect(bounds, color, size) {
  const last = undoStack[undoStack.length - 1];
  if (!last) return;
  const img = new Image();
  img.onload = () => {
    context.clearRect(0, 0, board.width, board.height);
    context.drawImage(img, 0, 0);
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineJoin = "round";
    context.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
  };
  img.src = last;
}

function redrawStrokeAsEllipse(bounds, color, size) {
  const last = undoStack[undoStack.length - 1];
  if (!last) return;
  const img = new Image();
  img.onload = () => {
    context.clearRect(0, 0, board.width, board.height);
    context.drawImage(img, 0, 0);
    context.strokeStyle = color;
    context.lineWidth = size;
    context.beginPath();
    context.ellipse(
      bounds.x + bounds.w / 2,
      bounds.y + bounds.h / 2,
      bounds.w / 2,
      bounds.h / 2,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
  };
  img.src = last;
}

function redrawStrokeAsTriangle(verts, color, size) {
  const last = undoStack[undoStack.length - 1];
  if (!last) return;
  const img = new Image();
  img.onload = () => {
    context.clearRect(0, 0, board.width, board.height);
    context.drawImage(img, 0, 0);
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(verts[0].x, verts[0].y);
    context.lineTo(verts[1].x, verts[1].y);
    context.lineTo(verts[2].x, verts[2].y);
    context.closePath();
    context.stroke();
  };
  img.src = last;
}