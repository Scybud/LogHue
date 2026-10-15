// sketchBoard.js
// Infinite canvas + palm rejection + shape refinement
// + text tool + pinch zoom + two-finger pan

let board = null;
let context = null;
let isdrawing = false;
let isPanning = false;
let lastPanPoint = null;
let sketchTool = "pen"; // "pen" | "eraser" | "text"
let undoStack = [];
const UNDO_LIMIT = 40;

let strokes = [];
let currentStroke = null;
let shapeHoldTimer = null;
const SHAPE_HOLD_MS = 700;

const camera = { x: 0, y: 0, zoom: 1 };

// Multi-touch state
const activePointers = new Map(); // pointerId -> { x, y } (screen coords)
let lastPinchDist = null;
let lastPinchMid = null;

let onStrokeFinished = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initSketchBoard(options = {}) {
  onStrokeFinished = options.onStrokeFinished || (() => {});

  board = document.getElementById("board");
  if (!board) return;
  context = board.getContext("2d");

  board.style.touchAction = "none";
  board.style.cursor = "crosshair";
  board.style.width = "100%";
  board.style.height = "100%";
  board.style.display = "block";

  const colorPicker = document.getElementById("color-picker");
  const brushSize = document.getElementById("brush-size");
  const penToolBtn = document.getElementById("pen-tool-button");
  const eraserToolBtn = document.getElementById("eraser-tool-button");
  const textToolBtn = document.getElementById("text-tool-button");
  const undoBtn = document.getElementById("undo-button");
  const clearBtn = document.getElementById("clear-button");
  const fillBtn = document.getElementById("fill-button");
  const downloadBtn = document.getElementById("download-button");

  // ----- Pointer down -----
  board.addEventListener("pointerdown", (e) => {
    // Palm rejection (single large contact)
    if (e.pointerType === "touch" && e.width > 40 && e.height > 40) return;

    board.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two or more fingers → gesture mode (pan / pinch)
    if (activePointers.size >= 2) {
      isdrawing = false;
      currentStroke = null;
      isPanning = false;
      initPinchState();
      return;
    }

    // Middle mouse or Alt = pan (mouse)
    if (e.button === 1 || e.altKey) {
      isPanning = true;
      lastPanPoint = { x: e.clientX, y: e.clientY };
      board.style.cursor = "grab";
      return;
    }

    // Text tool
    if (sketchTool === "text") {
      placeSketchText(e);
      return;
    }

    // Start drawing
    const pos = getWorldPos(e);
    pushUndoSnapshot();

    currentStroke = {
      id: crypto.randomUUID(),
      points: [pos],
      color: colorPicker?.value || "#000000",
      size: +(brushSize?.value || 5),
      tool: sketchTool,
    };
    isdrawing = true;
    render();
  });

  // ----- Pointer move -----
  board.addEventListener("pointermove", (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Multi-touch gesture
    if (activePointers.size >= 2) {
      handlePinchPan();
      return;
    }

    // Mouse pan
    if (isPanning && lastPanPoint) {
      const dx = (e.clientX - lastPanPoint.x) / camera.zoom;
      const dy = (e.clientY - lastPanPoint.y) / camera.zoom;
      camera.x -= dx;
      camera.y -= dy;
      lastPanPoint = { x: e.clientX, y: e.clientY };
      render();
      return;
    }

    if (!isdrawing || !currentStroke) return;

    currentStroke.points.push(getWorldPos(e));
    render();
  });

  // ----- Pointer up / cancel -----
  const endPointer = (e) => {
    activePointers.delete(e.pointerId);

    if (activePointers.size < 2) {
      lastPinchDist = null;
      lastPinchMid = null;
    }

    if (isPanning && activePointers.size === 0) {
      isPanning = false;
      lastPanPoint = null;
      board.style.cursor =
        sketchTool === "eraser"
          ? "cell"
          : sketchTool === "text"
            ? "text"
            : "crosshair";
    }

    if (!isdrawing || !currentStroke) return;
    if (activePointers.size > 0) return; // still another finger down

    isdrawing = false;

    if (currentStroke.points.length > 1) {
      if (currentStroke.tool === "pen" && currentStroke.points.length > 8) {
        clearTimeout(shapeHoldTimer);
        const pts = currentStroke.points.slice();
        const col = currentStroke.color;
        const sz = currentStroke.size;
        const id = currentStroke.id;

        // show freehand immediately
        strokes.push({ ...currentStroke });
        currentStroke = null;
        render();

        shapeHoldTimer = setTimeout(() => {
          const refined = tryRefineShape(pts, col, sz);
          if (refined) {
            const idx = strokes.findIndex((s) => s.id === id);
            if (idx !== -1) strokes[idx] = refined;
          }
          render();
          onStrokeFinished();
        }, SHAPE_HOLD_MS);
      } else {
        strokes.push(currentStroke);
        currentStroke = null;
        render();
        onStrokeFinished();
      }
    } else {
      currentStroke = null;
      render();
    }
  };

  board.addEventListener("pointerup", endPointer);
  board.addEventListener("pointercancel", endPointer);
  board.addEventListener("pointerleave", (e) => {
    if (activePointers.has(e.pointerId)) endPointer(e);
  });

  // Wheel zoom (desktop)
  board.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = board.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const worldBefore = {
        x: camera.x + sx / camera.zoom,
        y: camera.y + sy / camera.zoom,
      };

      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      camera.zoom = Math.min(8, Math.max(0.15, camera.zoom * factor));

      camera.x = worldBefore.x - sx / camera.zoom;
      camera.y = worldBefore.y - sy / camera.zoom;
      render();
    },
    { passive: false },
  );

  // Toolbar
  clearBtn?.addEventListener("click", () => {
    pushUndoSnapshot();
    strokes = [];
    currentStroke = null;
    render();
    onStrokeFinished();
  });

  // In initSketchBoard, replace the fill button handler with:

  fillBtn?.addEventListener("click", () => {
    pushUndoSnapshot();

    const colorPicker = document.getElementById("color-picker");
    const color = colorPicker?.value || "#ffffff";

    // Cover a large area in world space (current view + margin)
    const margin = 4000 / camera.zoom;
    const x = camera.x - margin;
    const y = camera.y - margin;
    const w = board.clientWidth / camera.zoom + margin * 2;
    const h = board.clientHeight / camera.zoom + margin * 2;

    strokes.unshift({
      id: crypto.randomUUID(),
      type: "fill",
      x,
      y,
      w,
      h,
      color,
    });

    render();
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
  textToolBtn?.addEventListener("click", () => setSketchTool("text"));

  window.addEventListener("resize", () => render());

  setSketchTool("pen");
  render();
}

// ---------------------------------------------------------------------------
// Multi-touch helpers
// ---------------------------------------------------------------------------

function initPinchState() {
  const pts = [...activePointers.values()];
  if (pts.length < 2) return;
  lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  lastPinchMid = {
    x: (pts[0].x + pts[1].x) / 2,
    y: (pts[0].y + pts[1].y) / 2,
  };
}

function handlePinchPan() {
  const pts = [...activePointers.values()];
  if (pts.length < 2) return;

  const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  const mid = {
    x: (pts[0].x + pts[1].x) / 2,
    y: (pts[0].y + pts[1].y) / 2,
  };

  const rect = board.getBoundingClientRect();

  // Pinch zoom (toward midpoint)
  if (lastPinchDist && lastPinchDist > 0) {
    const scale = dist / lastPinchDist;
    const sx = mid.x - rect.left;
    const sy = mid.y - rect.top;

    const worldBefore = {
      x: camera.x + sx / camera.zoom,
      y: camera.y + sy / camera.zoom,
    };

    camera.zoom = Math.min(8, Math.max(0.15, camera.zoom * scale));
    camera.x = worldBefore.x - sx / camera.zoom;
    camera.y = worldBefore.y - sy / camera.zoom;
  }

  // Two-finger pan
  if (lastPinchMid) {
    const dx = (mid.x - lastPinchMid.x) / camera.zoom;
    const dy = (mid.y - lastPinchMid.y) / camera.zoom;
    camera.x -= dx;
    camera.y -= dy;
  }

  lastPinchDist = dist;
  lastPinchMid = mid;
  render();
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function ensureBoardSized() {
  render();
}

export function loadImageOntoBoard(dataUrl) {
  if (!dataUrl) {
    strokes = [];
    render();
    return;
  }
  const img = new Image();
  img.onload = () => {
    strokes = [
      {
        id: "legacy-image",
        type: "image",
        img,
        x: 0,
        y: 0,
        w: img.width,
        h: img.height,
      },
    ];
    camera.x = 0;
    camera.y = 0;
    camera.zoom = 1;
    render();
  };
  img.src = dataUrl;
}

export function getBoardDataURL() {
  return board ? board.toDataURL("image/png") : null;
}

export function getSketchData() {
  return {
    version: 1,
    camera: { ...camera },
    strokes: strokes
      .filter((s) => s.type !== "image")
      .map((s) => ({
        id: s.id,
        type: s.type || "stroke",
        points: s.points,
        color: s.color,
        size: s.size,
        tool: s.tool,
        text: s.text,
        x: s.x,
        y: s.y,
        w: s.w, // needed for fill
        h: s.h, // needed for fill
      })),
  };
}

export function loadSketchData(data) {
  if (!data) return;
  strokes = data.strokes || [];
  if (data.camera) {
    camera.x = data.camera.x ?? 0;
    camera.y = data.camera.y ?? 0;
    camera.zoom = data.camera.zoom ?? 1;
  }
  render();
}

export function clearSketchUndo() {
  undoStack = [];
}

export function setSketchTool(tool) {
  sketchTool = tool;
  document.getElementById("pen-tool-button")?.classList.toggle("active", tool === "pen");
  document.getElementById("eraser-tool-button")?.classList.toggle("active", tool === "eraser");
  document.getElementById("text-tool-button")?.classList.toggle("active", tool === "text");
  if (board) {
    board.style.cursor =
      tool === "text" ? "text" : tool === "eraser" ? "cell" : "crosshair";
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render() {
  if (!board || !context) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = board.clientWidth || 1;
  const cssH = board.clientHeight || 1;

  if (
    board.width !== Math.round(cssW * dpr) ||
    board.height !== Math.round(cssH * dpr)
  ) {
    board.width = Math.round(cssW * dpr);
    board.height = Math.round(cssH * dpr);
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, board.width, board.height);

  // Paper
  context.fillStyle = "#fdfaf3";
  context.fillRect(0, 0, board.width, board.height);

  // Camera
  context.setTransform(
    camera.zoom * dpr,
    0,
    0,
    camera.zoom * dpr,
    -camera.x * camera.zoom * dpr,
    -camera.y * camera.zoom * dpr,
  );

  for (const stroke of strokes) {
    if (stroke.type === "fill") {
  context.fillStyle = stroke.color || "#ffffff";
  context.fillRect(stroke.x, stroke.y, stroke.w, stroke.h);
} else if (stroke.type === "image" && stroke.img) {
      context.drawImage(stroke.img, stroke.x, stroke.y, stroke.w, stroke.h);
    } else if (stroke.type === "text") {
      drawText(stroke);
    } else {
      drawStroke(stroke);
    }
  }

  if (currentStroke) drawStroke(currentStroke);
}

function drawStroke(stroke) {
  if (!stroke.points || stroke.points.length < 2) return;

  context.beginPath();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = stroke.size;
  context.strokeStyle = stroke.color;
  context.globalCompositeOperation =
    stroke.tool === "eraser" ? "destination-out" : "source-over";

  context.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    context.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  context.stroke();
  context.globalCompositeOperation = "source-over";
}

function drawText(item) {
  if (!item?.text) return;

  context.save();
  context.globalCompositeOperation = "source-over";
  context.fillStyle = item.color || "#000000";
  context.font = `${item.size || 24}px sans-serif`;
  context.textBaseline = "top";
  context.textAlign = "left";
  context.fillText(item.text, item.x, item.y);
  context.restore();
}

// ---------------------------------------------------------------------------
// Coordinates
// ---------------------------------------------------------------------------

function getWorldPos(e) {
  const rect = board.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  return {
    x: camera.x + sx / camera.zoom,
    y: camera.y + sy / camera.zoom,
  };
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

function pushUndoSnapshot() {
  const snapshot = JSON.stringify(
    strokes
      .filter((s) => s.type !== "image")
      .map((s) => ({
        id: s.id,
        type: s.type || "stroke",
        points: s.points,
        color: s.color,
        size: s.size,
        tool: s.tool,
        text: s.text,
        x: s.x,
        y: s.y,
        w: s.w,
        h: s.h,
      })),
  );
  undoStack.push(snapshot);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
}

function undoSketch() {
  const prev = undoStack.pop();
  if (prev === undefined) return;
  try {
    strokes = JSON.parse(prev);
  } catch {
    strokes = [];
  }
  currentStroke = null;
  render();
}

// ---------------------------------------------------------------------------
// Text tool
// ---------------------------------------------------------------------------

function placeSketchText(e) {
  const pos = getWorldPos(e);
  const colorPicker = document.getElementById("color-picker");
  const brushSize = document.getElementById("brush-size");
  const color = colorPicker?.value || "#000000";
  const size = brushSize ? Math.max(18, +brushSize.value * 4) : 24;

  // Overlay rooted on the pane, not the canvas wrap
  const pane =
    document.getElementById("sketchEditorPane") || board.parentElement;
  if (!pane) {
    const text = prompt("Enter text:");
    if (text?.trim()) commitText(text.trim(), pos, color, size);
    return;
  }

  const paneRect = pane.getBoundingClientRect();
  const left = e.clientX - paneRect.left;
  const top = e.clientY - paneRect.top;

  const editable = document.createElement("div");
  editable.contentEditable = "true";
  editable.style.cssText = `
    position: absolute;
    left: ${left}px;
    top: ${top}px;
    min-width: 60px;
    min-height: 1.3em;
    padding: 4px 6px;
    color: ${color};
    font: ${size}px sans-serif;
    background: #fffef8;
    outline: 2px solid #3b82f6;
    border-radius: 4px;
    z-index: 50;
    white-space: pre-wrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  `;

  if (getComputedStyle(pane).position === "static") {
    pane.style.position = "relative";
  }

  pane.appendChild(editable);
  editable.focus();

  let committed = false;
  const finish = () => {
    if (committed) return;
    committed = true;
    const text = (editable.textContent || "").trim();
    editable.remove();
    if (text) commitText(text, pos, color, size);
  };

  editable.addEventListener("blur", finish);
  editable.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      editable.blur();
    }
    if (ev.key === "Escape") {
      committed = true;
      editable.remove();
    }
  });
}

function commitText(text, pos, color, size) {
  pushUndoSnapshot();
  strokes.push({
    id: crypto.randomUUID(),
    type: "text",
    text,
    x: pos.x,
    y: pos.y,
    color,
    size,
  });
  render();
  onStrokeFinished();
}

function downloadBoard() {
  const title = document.getElementById("sketchTitle")?.value || "sketch";
  const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const a = document.createElement("a");
  a.download = `${safeTitle || "sketch"}.png`;
  a.href = board.toDataURL("image/png");
  a.click();
}

// ---------------------------------------------------------------------------
// Shape recognition (unchanged logic)
// ---------------------------------------------------------------------------

function tryRefineShape(points, color, size) {
  if (!points || points.length < 10) return null;

  const scores = {
    line: scoreLine(points),
    rect: scoreRect(points),
    circle: scoreCircle(points),
    triangle: scoreTriangle(points),
  };

  let best = null;
  let bestScore = 0.58;
  for (const [name, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  if (!best) return null;

  if (best === "line") {
    return {
      id: crypto.randomUUID(),
      points: [points[0], points[points.length - 1]],
      color,
      size,
      tool: "pen",
    };
  }
  if (best === "rect") {
    const b = getBounds(points);
    return {
      id: crypto.randomUUID(),
      points: [
        { x: b.x, y: b.y },
        { x: b.x + b.w, y: b.y },
        { x: b.x + b.w, y: b.y + b.h },
        { x: b.x, y: b.y + b.h },
        { x: b.x, y: b.y },
      ],
      color,
      size,
      tool: "pen",
    };
  }
  if (best === "circle") {
    const b = getBounds(points);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const rx = b.w / 2;
    const ry = b.h / 2;
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
    }
    return { id: crypto.randomUUID(), points: pts, color, size, tool: "pen" };
  }
  if (best === "triangle") {
    const verts = findTriangleVertices(points);
    if (!verts) return null;
    return {
      id: crypto.randomUUID(),
      points: [verts[0], verts[1], verts[2], verts[0]],
      color,
      size,
      tool: "pen",
    };
  }
  return null;
}

function scoreLine(pts) {
  const a = pts[0], b = pts[pts.length - 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 50) return 0;
  let maxDev = 0, sumDev = 0;
  for (const p of pts) {
    const d = pointToLineDistance(p, a, b);
    maxDev = Math.max(maxDev, d);
    sumDev += d;
  }
  const avgDev = sumDev / pts.length;
  if (maxDev > 16 || avgDev > 7) return 0;
  return 1 - avgDev / 10;
}

function scoreRect(pts) {
  const b = getBounds(pts);
  if (b.w < 55 || b.h < 55) return 0;
  const aspect = Math.max(b.w, b.h) / Math.min(b.w, b.h);
  if (aspect > 5.5) return 0;
  const tol = Math.max(16, Math.min(b.w, b.h) * 0.09);
  let onEdge = 0;
  for (const p of pts) {
    if (
      Math.abs(p.x - b.x) < tol ||
      Math.abs(p.x - (b.x + b.w)) < tol ||
      Math.abs(p.y - b.y) < tol ||
      Math.abs(p.y - (b.y + b.h)) < tol
    )
      onEdge++;
  }
  const ratio = onEdge / pts.length;
  if (ratio < 0.72) return 0;
  return ratio * 0.92 * (1 - Math.min(0.35, Math.abs(1 - aspect) * 0.25));
}

function scoreCircle(pts) {
  const b = getBounds(pts);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const rx = b.w / 2, ry = b.h / 2;
  if (rx < 35 || ry < 35) return 0;
  const aspect = Math.max(rx, ry) / Math.min(rx, ry);
  if (aspect > 1.45) return 0;
  let sumErr = 0, maxErr = 0;
  for (const p of pts) {
    const err = Math.abs(Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) - 1);
    sumErr += err;
    maxErr = Math.max(maxErr, err);
  }
  const avgErr = sumErr / pts.length;
  if (avgErr > 0.32 || maxErr > 0.55) return 0;
  return (1 - avgErr / 0.4) * (aspect < 1.2 ? 1.05 : 0.95);
}

function scoreTriangle(pts) {
  const verts = findTriangleVertices(pts);
  if (!verts) return 0;
  const sides = [[verts[0], verts[1]], [verts[1], verts[2]], [verts[2], verts[0]]];
  let close = 0;
  for (const p of pts) {
    let minD = Infinity;
    for (const [a, b] of sides) minD = Math.min(minD, pointToLineDistance(p, a, b));
    if (minD < 20) close++;
  }
  const ratio = close / pts.length;
  if (ratio < 0.68) return 0;
  const d01 = Math.hypot(verts[0].x - verts[1].x, verts[0].y - verts[1].y);
  const d12 = Math.hypot(verts[1].x - verts[2].x, verts[1].y - verts[2].y);
  const d20 = Math.hypot(verts[2].x - verts[0].x, verts[2].y - verts[0].y);
  if (d01 < 55 || d12 < 55 || d20 < 55) return 0;
  const bounds = getBounds(pts);
  const aspect = Math.max(bounds.w, bounds.h) / Math.min(bounds.w, bounds.h);
  if (aspect > 1.8 && ratio < 0.82) return 0;
  return ratio * 0.88;
}

function findTriangleVertices(pts) {
  const simplified = douglasPeucker(pts, 22);
  if (simplified.length < 3) return null;
  let best = null, bestArea = 0;
  for (let i = 0; i < simplified.length; i++) {
    for (let j = i + 1; j < simplified.length; j++) {
      for (let k = j + 1; k < simplified.length; k++) {
        const area = Math.abs(
          (simplified[i].x * (simplified[j].y - simplified[k].y) +
            simplified[j].x * (simplified[k].y - simplified[i].y) +
            simplified[k].x * (simplified[i].y - simplified[j].y)) / 2,
        );
        if (area > bestArea) {
          bestArea = area;
          best = [simplified[i], simplified[j], simplified[k]];
        }
      }
    }
  }
  return best && bestArea >= 1200 ? best : null;
}

function douglasPeucker(points, epsilon) {
  if (points.length < 3) return points.slice();
  let maxDist = 0, index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = pointToLineDistance(points[i], points[0], points[end]);
    if (d > maxDist) { maxDist = d; index = i; }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[end]];
}

function getBounds(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function pointToLineDistance(p, a, b) {
  const A = p.x - a.x, B = p.y - a.y, C = b.x - a.x, D = b.y - a.y;
  const lenSq = C * C + D * D || 1;
  const t = Math.max(0, Math.min(1, (A * C + B * D) / lenSq));
  return Math.hypot(p.x - (a.x + t * C), p.y - (a.y + t * D));
}