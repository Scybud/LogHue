/*

TABLE EMBED BLOT
Registers a Quill embed that Quill treats as a single opaque unit (like
an image). It only ever renders an empty placeholder div carrying the
table's id — the actual interactive table is mounted into that div by
mountTableEmbeds() in notes.js, completely outside Quill's own diffing.
This keeps table editing (typing in cells, adding rows) from being
interpreted by Quill as text edits.

Call registerTableEmbedBlot(Quill) once, before creating the Quill
instance.

*/
export function registerTableEmbedBlot(Quill) {
  const Embed = Quill.import("blots/embed");

  class TableEmbedBlot extends Embed {
    static create(value) {
      const node = super.create();
      node.setAttribute("data-table-id", value.id);
      node.setAttribute("contenteditable", "false");
      return node;
    }

    static value(node) {
      return { id: node.getAttribute("data-table-id") };
    }
  }

  TableEmbedBlot.blotName = "table-embed";
  TableEmbedBlot.tagName = "div";
  TableEmbedBlot.className = "ql-table-embed";

  Quill.register(TableEmbedBlot, true);
}
