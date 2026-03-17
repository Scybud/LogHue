// ---------------------
// THEME TOGGLE
// ---------------------
const themeToggle = document.getElementById("themeToggle");

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  // Update button icon
  themeToggle.textContent = document.body.classList.contains("dark")
    ? "☀️"
    : "🌙";

  // Optional: save preference to localStorage
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light",
  );
});

// Load saved theme on page load
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  themeToggle.textContent = "☀️";
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
