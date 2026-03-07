
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
    container.classList.add("disabled")
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
container.classList.add("disabled");
container.append(preLoaderContainer)
}

export function preferedPrimary() {
  document.addEventListener("DOMContentLoaded", () => {
      const picker = document.getElementById("primaryColor")
        
        const saved = JSON.parse(localStorage.getItem("preferedPrimary"));

if (saved) {
  document.documentElement.style.setProperty("--primary", saved);
  if(picker) {
  picker.value = saved;
  }
}

if(picker) {

  picker.addEventListener("input", () => {
    const color = picker.value;
    document.documentElement.style.setProperty("--primary", color);
    
    localStorage.setItem("preferedPrimary", JSON.stringify(color))
  })
}
});

const reseToDefaultPrimary = document.getElementById("reseToDefaultPrimary");
if(!reseToDefaultPrimary) return;
reseToDefaultPrimary.addEventListener("click", () => {
  localStorage.removeItem("preferedPrimary");
  window.location.reload()
})
}


//SET THEME
export function setTheme() {
const themeSelect = document.getElementById("themeSelect");

if(themeSelect) {
  themeSelect.addEventListener("change", () => {
const value = themeSelect.value

if(value === "system") {
  document.documentElement.removeAttribute("data-theme")

  localStorage.setItem("theme", "system")
  return;
}

document.documentElement.setAttribute("data-theme", value)
  localStorage.setItem("theme", value);

  });
}

//LOAD SAVED THEME
const savedTheme = localStorage.getItem("theme")
if(savedTheme && themeSelect) {
  themeSelect.value = savedTheme;
}
if (savedTheme === "light" || savedTheme === "dark") {
  document.documentElement.setAttribute("data-theme", savedTheme);
} else {
  document.documentElement.removeAttribute("data-theme");
}
}

export function setInterfaceDensity() {
  const interfaceSelect = document.getElementById("interfaceSelect");

  if (interfaceSelect) {
    interfaceSelect.addEventListener("change", () => {
      const value = interfaceSelect.value;

        document.documentElement.setAttribute("data-density", value);
        localStorage.setItem("density", value);
    });
  }

  //LOAD SAVED THEME
  const savedDensity = localStorage.getItem("density");
  if (savedDensity && interfaceSelect) {
    document.documentElement.setAttribute("data-density", savedDensity);
    interfaceSelect.value = savedDensity;
  } else {
    document.documentElement.removeAttribute("data-density");
  }
}