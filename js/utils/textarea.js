//Textarea autoexpand
export function autoExpandTextarea() {
  const textareas = document.querySelectorAll("textarea");

  textareas.forEach((t) => {
    if (t) {
      t.addEventListener("input", () => {
        t.style.height = "auto";
        t.style.height = t.scrollHeight + "px";
      })
    }
})
}

