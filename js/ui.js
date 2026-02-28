
export async function loadComponent(path, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const response = await fetch(path);
  const html = await response.text();

  container.innerHTML = html;

  attachCloseModal();
}

export function closeModal() {
  const modalContainer = document.getElementById("modalContainer");

  modalContainer.innerHTML = "";

}

function attachCloseModal() {
  //Close modal button
  const closeModalBtn = document.querySelector(".closeModalBtn");

    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", () => {
        closeModal();
      });
    }
}

//PRELOADER
export function removeLoader() {
  const preLoaderContainer = document.querySelector(".preLoaderContainer");

  if(preLoaderContainer) {

    preLoaderContainer.remove()
  }
}

export function buttonLoading(container) {
  if(container.dataset.loading === "true") {
    container.innerHTML = container.dataset.originalText
    container.dataset.loading = "false"; 
    return;
  }

  container.dataset.originalText = container.innerHTML; 
  container.dataset.loading = "true";

const preLoaderContainer = document.createElement("div")
preLoaderContainer.classList.add("btnLoaderContainer")

const waveLoader = document.createElement("div")
waveLoader.classList.add("tt-wave-loader");

for(let i = 1; i <= 3; i++) {
  const span = document.createElement("span")

  waveLoader.append(span)
}
preLoaderContainer.append(waveLoader)

container.innerHTML = ""
container.append(preLoaderContainer)
}