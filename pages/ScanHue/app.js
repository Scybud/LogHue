import { supabase } from "https://loghue.com/js/supabase.js";
import { actionMsg } from "https://loghue.com/js/utils/modals.js";

const imageInput = document.getElementById("imageInput");
const processBtn = document.getElementById("processBtn");
const canvas = document.getElementById("previewCanvas");
const output = document.getElementById("output");
const outputLower = document.querySelector(".outputLower");
const copyBtn = document.getElementById("copyBtn");
const editInNotesBtn = document.getElementById("editInNotesBtn");
const fileName = document.getElementById("fileName");

let selectedImage = null;
let cropBox = null;

let guestId = localStorage.getItem("loghue_anon_id");

if (!guestId) {
  guestId = crypto.randomUUID();
  localStorage.setItem("loghue_anon_id", guestId);
}

imageInput.addEventListener("change", () => {
  fileName.textContent = imageInput.files.length
    ? imageInput.files[0].name
    : "No file chosen";
});

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

  window.location.href = "../notes";
});

function canvasDefault() {
  const ctx = canvas.getContext("2d");

  const img = new Image();
  img.crossOrigin = "anonymous"; // important for CORS safety
  img.src = "https://app.loghue.com/ScanHue/preview-placeholder.png";

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
    loadUsage(); 

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


// --- OCR via Supabase Edge Function ---
async function runOCRViaEdgeFunction(canvas) {
  const dataUrl = canvas.toDataURL("image/png");

  // 🔐 GET REAL USER SESSION
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;

  const res = await fetch(
    "https://qqactsebaxdottiiyrng.functions.supabase.co/scanhue-ocr",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        image: dataUrl,
        guestId,
      }),
    },
  );

  const data = await res.json();

  if (!res.ok) {
    throw {
      message: data.error || "OCR failed",
      used: data.used,
      limit: data.limit,
    };
  }

  if (data.cached) {
    actionMsg("Fast result (cached)", "success");
  }

  return data;
}
// --- Process button ---
processBtn.addEventListener("click", async () => {
  if (!selectedImage) {
    actionMsg("Please select an image first", "error");
    return;
  }

  processBtn.disabled = true;
  document.querySelector(".previewCanvasContainer").classList.add("scan");

  output.value = "";

  try {
    const text = await runOCRViaEdgeFunction(canvas);
    output.value = text.text;
    updateUsageUI(text.used, text.limit);
    outputLower.classList.add("show");
  } catch (err) {
    outputLower.classList.add("show");

    if (err.message === "limit reached" || err.message === "Limit reached") {
      updateUsageUI(err.used, err.limit);

      showLimitModal(err.used || 0, err.limit || 0);
      return;
    } else if (err.message === "too many requests") {
      actionMsg("Too many requests. Please wait 5minutes before retrying.")
      return;
    }

    output.value = "Error: " + err.message;
    output.style.color = "red";
  } finally {
    processBtn.disabled = false;
    document.querySelector(".previewCanvasContainer").classList.remove("scan");
  }
});

const modal = document.getElementById("modalContainer");
const usageCountEl = document.getElementById("usageCount");
const usageLimitEl = document.getElementById("usageLimit");

function showLimitModal(count, limit) {
  usageCountEl.textContent = count;
  usageLimitEl.textContent = limit;

  modal.classList.remove("hidden");
}

document.getElementById("closeModal").onclick = () => {
  modal.classList.add("hidden");
};

document.getElementById("upgradeBtn").onclick = () => {
  window.location.href =
    "https://app.loghue.com/billing/upgrade?plan=77c12c94-25a4-4567-91a7-7bbddb335001"; // adjust route
};

const usageText = document.getElementById("usageText");

function updateUsageUI(used, limit) {
  if (used == null || limit == null) return;

  usageText.textContent = `${used} / ${limit} scans used`;

  // optional visual feedback
  const percent = used / limit;

  if (percent > 0.9) {
    usageText.style.color = "red";
  } else if (percent > 0.7) {
    usageText.style.color = "orange";
  } else {
    usageText.style.color = "inherit";
  }
}

async function loadUsage() {
  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    const [usageRes, entRes] = await Promise.all([
      fetch(
        "https://qqactsebaxdottiiyrng.functions.supabase.co/scanhue-ocr-usage",
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      ),
      fetch(
        "https://qqactsebaxdottiiyrng.functions.supabase.co/scanhue-entitlements",
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      ),
    ]);

    const usage = await usageRes.json();
    const ent = await entRes.json();

    updateUsageUI(usage.used, ent.limit);
  } catch {
    console.warn("Failed to load usage");
  }
}
