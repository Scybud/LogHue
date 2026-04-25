import {supabase} from "https://loghue.com/js/supabase.js"
import { actionMsg } from "https://loghue.com/js/utils/modals.js";

const imageInput = document.getElementById("imageInput");
const processBtn = document.getElementById("processBtn");
const canvas = document.getElementById("previewCanvas");
const output = document.getElementById("output");
const outputLower = document.querySelector(".outputLower");
const copyBtn = document.getElementById("copyBtn");
const editInNotesBtn = document.getElementById("editInNotesBtn");

let selectedImage = null;
let cropBox = null;

    // Copy button
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(output.value);
      actionMsg("Copied to clipboard!", "success");
    });

    //EDIT IN LOGHUE NOTES
    editInNotesBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      localStorage.setItem("extractedText", output.value);

      window.location.href = "../notes"
    });

    
function canvasDefault() {
   const ctx = canvas.getContext("2d");

   const img = new Image();
   img.crossOrigin = "anonymous"; // important for CORS safety
   img.src = "preview-placeholder.png";

   img.onload = () => {
     // scale image to fit canvas width
     const scale = canvas.width / img.width;
     const newHeight = img.height * scale;

     canvas.height = newHeight;
     ctx.drawImage(img, 0, 0, canvas.width, newHeight);
   };
}
window.addEventListener("load", () => {
canvasDefault();
});


// --- Preview image ---
imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  selectedImage = file;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
img.crossOrigin = "anonymous";
img.onload = () => {
  const ctx = canvas.getContext("2d");

  const targetWidth = 1000;
  const scale = targetWidth / img.width;
  canvas.width = targetWidth;
  canvas.height = img.height * scale;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
};
img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

/*

// --- Crop selection (drag box) ---
const ctx = canvas.getContext("2d");

let startX,
  startY,
  isDragging = false;

canvas.addEventListener("mousedown", (e) => {
  startX = e.offsetX;
  startY = e.offsetY;
  isDragging = true;
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const currentX = e.offsetX;
  const currentY = e.offsetY;

  const w = currentX - startX;
  const h = currentY - startY;

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  ctx.putImageData(imgData, 0, 0);

  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.strokeRect(startX, startY, w, h);
});

canvas.addEventListener("mouseup", (e) => {
  isDragging = false;

  const endX = e.offsetX;
  const endY = e.offsetY;

  cropBox = {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    w: Math.abs(endX - startX),
    h: Math.abs(endY - startY),
  };

  if (cropBox.w === 0 || cropBox.h === 0) {
    cropBox = null;
    alert("Invalid crop selection");
  }
});
*/

// --- OCR via Supabase Edge Function ---
async function runOCRViaEdgeFunction(canvas) {
  const dataUrl = canvas.toDataURL("image/png");

const res = await fetch(
  "https://qqactsebaxdottiiyrng.functions.supabase.co/scanhue-ocr",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl }),
  },
);

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "OCR failed");
  }

  return data.text;
}

// --- Process button ---
processBtn.addEventListener("click", async () => {
  if (!selectedImage) {
    actionMsg("Please select an image first", "error");
    return;
  }

  output.value = "Processing...";

  let targetCanvas = canvas;
/*
  if (cropBox) {
    const cropped = ctx.getImageData(
      cropBox.x,
      cropBox.y,
      cropBox.w,
      cropBox.h,
    );
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = cropBox.w;
    tempCanvas.height = cropBox.h;
    tempCanvas.getContext("2d").putImageData(cropped, 0, 0);
    targetCanvas = tempCanvas;
  }
  */

  try {
    const text = await runOCRViaEdgeFunction(targetCanvas);
    output.value = text;

outputLower.classList.add("show");

    if(text === null) return console.log("Undefined")
  } catch (err) {  

    outputLower.classList.add("show");

  output.value = "Error: " + err.message;
  }
});
