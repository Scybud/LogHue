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

  // only color/background-color survive, and only as hex or rgb()/rgba()
  const allowedStyleProps = new Set(["color", "background-color"]);
  const safeColorValue = /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\))$/i;

  function sanitizeStyleAttr(value) {
    // parse via a detached element so the browser normalizes it for us
    const probe = document.createElement("span");
    probe.setAttribute("style", value);

    const kept = [];
    for (const prop of allowedStyleProps) {
      const propValue = probe.style.getPropertyValue(prop).trim();
      if (propValue && safeColorValue.test(propValue)) {
        kept.push(`${prop}: ${propValue}`);
      }
    }
    return kept.join("; ");
  }

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

      if (name === "style") {
        const cleaned = sanitizeStyleAttr(value);
        if (cleaned) {
          element.setAttribute("style", cleaned);
        } else {
          element.removeAttribute("style");
        }
        return;
      }

      if (
        name.startsWith("on") ||
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
