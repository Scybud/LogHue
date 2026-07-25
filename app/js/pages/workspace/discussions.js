import { formatDateTime } from "../../utils/time.js";

// -------------------------------------------------------------------
// DISCUSSION RENDERING (shared)
// -------------------------------------------------------------------
export async function loadDiscussions(title, discussions, container) {
  const section = document.createElement("div");
  section.classList.add("section");

  const sectionHeader = document.createElement("div");
  sectionHeader.classList.add("sectionHeader");
  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = "💬" + title;
  sectionHeader.appendChild(sectionTitle);
  section.appendChild(sectionHeader);

  if (!discussions || discussions.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.classList.add("placeholderText");
    placeholder.textContent = "No discussions started yet.";
    section.appendChild(placeholder);
  } else {
    const divGrid = document.createElement("div");
    divGrid.classList.add("container");

    discussions.forEach((dcn) => {
      const discussionCard = document.createElement("div");
      discussionCard.classList.add("card", "discussionCard");
      discussionCard.dataset.id = dcn.id;
      discussionCard.addEventListener("click", () => {
        window.location.href = `discussion-view?dcn=${dcn.id}`;
      });

      const dcnHeader = document.createElement("div");
      dcnHeader.classList.add("discussionHeader");
      const img = document.createElement("img");
      img.classList.add("profileImg");
      img.src =
        dcn.profiles?.avatar_url ||
        "https://loghue.com/assets/images/default_profile.png";
      const span = document.createElement("span");
      span.classList.add("actorName");
      span.textContent = dcn.profiles?.full_name || "Unknown User";
      dcnHeader.append(img, span);

      const dcnTitle = document.createElement("h3");
      dcnTitle.classList.add("taskTitle");
      dcnTitle.textContent = dcn.title;

      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Content";
      const descText = document.createElement("p");
      descText.textContent = dcn.content;
      details.append(summary, descText);

      const createdOn = document.createElement("p");
      createdOn.classList.add("meta");
      createdOn.textContent = formatDateTime(dcn.created_at);

      const dcnMeta = document.createElement("div");
      dcnMeta.classList.add("dcnMeta");
      dcnMeta.append(createdOn);

      const viewBtn = document.createElement("button");
      viewBtn.classList.add("btn", "btn-primary");
      viewBtn.textContent = "Open";
      viewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = `discussion-view?dcn=${dcn.id}`;
      });

      details.addEventListener("click", (e) => e.stopPropagation());

      discussionCard.append(dcnHeader, dcnMeta, dcnTitle, details, viewBtn);
      divGrid.appendChild(discussionCard);
    });

    section.appendChild(divGrid);
  }

  container.appendChild(section);
}
