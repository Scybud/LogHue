export function showUploadStatus(message, isError = false) {
  let box = document.getElementById("uploadStatusBox");

  if (!box) {
    box = document.createElement("div");
    box.id = "uploadStatusBox";
    box.className = "uploadStatus";
   adminWorkspaceDashboardContent.prepend(box);
  }

  box.textContent = message;
  box.style.color = isError ? "#ff5252" : "#4caf50";
}