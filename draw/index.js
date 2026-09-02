const board = document.getElementById("board");
const context = board.getContext("2d");

let isdrawing = false;
const colorPicker = document.getElementById("color-picker");
const brushSize = document.getElementById("brush-size");
const clearBtn = document.getElementById("clear-button");
const fillBtn = document.getElementById("fill-button");
const downloadBtn = document.getElementById("download-button");


board.addEventListener("pointerdown", () => (isdrawing = true));
board.addEventListener("pointerup", () => {
    isdrawing = false;
    context.beginPath();
});
board.addEventListener("pointerout", () => (isdrawing = false));
board.addEventListener("pointermove", draw);
board.style.touchAction = "none";

clearBtn.addEventListener("click", clearCanvas);
fillBtn.addEventListener("click", fillCanvas);
downloadBtn.addEventListener("click", downloadCanvas);

function draw(e) {
    if(!isdrawing) return;

    context.lineWidth = brushSize.value;
    context.lineCap = "round";
    context.strokeStyle = colorPicker.value;

context.lineTo(e.offsetX, e.offsetY);
context.stroke();
context.beginPath();
context.moveTo(e.offsetX, e.offsetY);
}

function clearCanvas() {
    context.clearRect(0, 0, board.width, board.height)
}

function fillCanvas() {
    context.fillStyle = colorPicker.value;
        context.fillRect(0, 0, board.width, board.height);
}

function downloadCanvas() {
    const imageLink = document.createElement("a");
    imageLink.download = `Drawing-${Date.now()}.png`;
    imageLink.href = board.toDataURL("image/png");
    imageLink.click();
}