import { escapeHTML } from "./escapeHTML.js";
import { linkify } from "./linkify.js";

export function renderFormattedTextWithLink(text, container) {
  container.innerHTML = "";

  if (!text?.trim()) return;

  const linkified = linkify(text); // escapes internally, then adds <a> tags

  const lines = text.replace(/\r\n/g, "\n").split("\n");

  let paragraph = [];
  let currentList = null;
  let currentListType = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;

    const p = document.createElement("p");

    paragraph.forEach((line, index) => {
      if (index > 0) p.appendChild(document.createElement("br"));
      const span = document.createElement("span");
      span.innerHTML = line;
      p.appendChild(span);
    });

    container.appendChild(p);
    paragraph = [];
  };

  const flushList = () => {
    if (!currentList) return;
    container.appendChild(currentList);
    currentList = null;
    currentListType = null;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);

    if (numberedMatch) {
      flushParagraph();
      if (currentListType !== "ol") {
        flushList();
        currentList = document.createElement("ol");
        currentListType = "ol";
      }
      const li = document.createElement("li");
      li.innerHTML = numberedMatch[2];
      currentList.appendChild(li);
      return;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);

    if (bulletMatch) {
      flushParagraph();
      if (currentListType !== "ul") {
        flushList();
        currentList = document.createElement("ul");
        currentListType = "ul";
      }
      const li = document.createElement("li");
      li.innerHTML = bulletMatch[1];
      currentList.appendChild(li);
      return;
    }

    flushList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();
}

export function renderFormattedText(text, container) {
  container.innerHTML = "";

  if (!text?.trim()) return;

  const escaped = escapeHTML(text); // escapes internally, then adds <a> tags

  const lines = escaped.replace(/\r\n/g, "\n").split("\n");

  let paragraph = [];
  let currentList = null;
  let currentListType = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;

    const p = document.createElement("p");

    paragraph.forEach((line, index) => {
      if (index > 0) p.appendChild(document.createElement("br"));
      const span = document.createElement("span");
      span.innerHTML = line;
      p.appendChild(span);
    });

    container.appendChild(p);
    paragraph = [];
  };

  const flushList = () => {
    if (!currentList) return;
    container.appendChild(currentList);
    currentList = null;
    currentListType = null;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);

    if (numberedMatch) {
      flushParagraph();
      if (currentListType !== "ol") {
        flushList();
        currentList = document.createElement("ol");
        currentListType = "ol";
      }
      const li = document.createElement("li");
      li.innerHTML = numberedMatch[2];
      currentList.appendChild(li);
      return;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);

    if (bulletMatch) {
      flushParagraph();
      if (currentListType !== "ul") {
        flushList();
        currentList = document.createElement("ul");
        currentListType = "ul";
      }
      const li = document.createElement("li");
      li.innerHTML = bulletMatch[1];
      currentList.appendChild(li);
      return;
    }

    flushList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();
}
