export function dataCount(displayer, dataToCount) {
  if (!displayer) return;
  displayer.textContent = dataToCount.length;
}

export function sanitizeHTML(html) {
  if (typeof html !== "string") return "";

  const template = document.createElement("template");
  template.innerHTML = html;

  const allowedTags = new Set([
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "span",
    "strong",
    "ul",
  ]);

  const elements = Array.from(template.content.querySelectorAll("*") || []);
  elements.forEach((element) => {
    const tagName = element.tagName.toLowerCase();
    if (!allowedTags.has(tagName)) {
      element.replaceWith(document.createTextNode(element.textContent || ""));
      return;
    }

    Array.from(element.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value || "";
      if (
        name.startsWith("on") ||
        name === "style" ||
        name === "srcdoc" ||
        /^javascript:/i.test(value)
      ) {
        element.removeAttribute(attr.name);
        return;
      }

      if (
        (name === "href" || name === "src") &&
        /^(?:javascript|data):/i.test(value)
      ) {
        element.removeAttribute(attr.name);
      }
    });
  });

  return template.innerHTML;
}
