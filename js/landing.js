// ---------------------
// THEME TOGGLE
// ---------------------
const themeToggle = document.getElementById("themeToggle");

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light");

  // Update button icon
  themeToggle.textContent = document.body.classList.contains("light")
    ? "☀️"
    : "🌙";

  // Optional: save preference to localStorage
  localStorage.setItem(
    "theme",
    document.body.classList.contains("light") ? "light" : "dark",
  );
});

// Load saved theme on page load
if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light");
  themeToggle.textContent = "🌙";
}

// ---------------------
// MOBILE SIDEBAR
// ---------------------
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileSidebar = document.getElementById("mobileSidebar");
const closeSidebar = document.getElementById("closeSidebar");

// Open sidebar
mobileMenuBtn.addEventListener("click", () =>
  mobileSidebar.classList.add("open"),
);

// Close sidebar
closeSidebar.addEventListener("click", () =>
  mobileSidebar.classList.remove("open"),
);

// Close when a link or button is clicked inside sidebar
mobileSidebar.addEventListener("click", (event) => {
  if (event.target.tagName === "A" || event.target.classList.contains("btn")) {
    mobileSidebar.classList.remove("open");
  }
});
