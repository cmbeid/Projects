// Minimal XML writer/reader mirroring the tinyxml2 subset OpenSky uses for saves.
// No dependencies; works in browser and Bun.

export class XMLPrinter {
  constructor() {
    this.buf = '<?xml version="1.0"?>\n';
    this.stack = [];
    this.open = false; // an element is open and awaiting > or />
  }

  OpenElement(name) {
    if (this.open) this.buf += ">\n";
    this.buf += "    ".repeat(this.stack.length) + "<" + name;
    this.stack.push(name);
    this.open = true;
    return this;
  }

  PushAttribute(name, value) {
    this.buf += " " + name + '="' + _escape(String(value)) + '"';
    return this;
  }

  CloseElement() {
    const name = this.stack.pop();
    if (this.open) {
      this.buf += "/>\n";
      this.open = false;
    } else {
      this.buf += "    ".repeat(this.stack.length) + "</" + name + ">\n";
    }
    return this;
  }

  toString() {
    return this.buf;
  }
}

function _escape(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- Parser ---
// Returns { name, attrs: {...}, children: [...] }; .text holds trimmed text content.
export function parseXML(text) {
  let i = 0;
  const len = text.length;
  function skipProlog() {
    for (;;) {
      while (i < len && /\s/.test(text[i])) i++;
      if (text.startsWith("<?", i)) { i = text.indexOf("?>", i) + 2; continue; }
      if (text.startsWith("<!--", i)) { i = text.indexOf("-->", i) + 3; continue; }
      if (text.startsWith("<!", i)) { i = text.indexOf(">", i) + 1; continue; }
      break;
    }
  }
  function parseNode() {
    i++; // consume '<'
    let name = "";
    while (i < len && !/[\s/>]/.test(text[i])) name += text[i++];
    const node = { name, attrs: {}, children: [], text: "" };
    for (;;) {
      while (i < len && /\s/.test(text[i])) i++;
      if (text[i] === "/" && text[i + 1] === ">") { i += 2; return node; }
      if (text[i] === ">") { i++; break; }
      if (i >= len) return node;
      let aname = "";
      while (i < len && !/[\s=/>]/.test(text[i])) aname += text[i++];
      while (i < len && /\s/.test(text[i])) i++;
      if (text[i] !== "=") { if (aname) node.attrs[aname] = ""; continue; }
      i++; // =
      while (i < len && /\s/.test(text[i])) i++;
      const quote = text[i]; i++;
      let aval = "";
      while (i < len && text[i] !== quote) aval += text[i++];
      i++; // closing quote
      node.attrs[aname] = _unescape(aval);
    }
    let textContent = "";
    for (;;) {
      if (i >= len) break;
      if (text[i] === "<") {
        if (text.startsWith("</", i)) { i = text.indexOf(">", i) + 1; break; }
        if (text.startsWith("<!--", i)) { i = text.indexOf("-->", i) + 3; continue; }
        if (text.startsWith("<![CDATA[", i)) {
          i += 9;
          const end = text.indexOf("]]>", i);
          textContent += text.slice(i, end);
          i = end + 3;
          continue;
        }
        node.children.push(parseNode());
      } else {
        textContent += text[i];
        i++;
      }
    }
    node.text = _unescape(textContent.trim());
    return node;
  }
  skipProlog();
  if (i >= len || text[i] !== "<") throw new Error("no root element");
  return parseNode();
}

function _unescape(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// helpers mirroring tinyxml2 attribute accessors
export function intAttr(el, name, def = 0) {
  const v = el.attrs[name];
  if (v === undefined || v === "") return def;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : n;
}
export function doubleAttr(el, name, def = 0) {
  const v = el.attrs[name];
  if (v === undefined || v === "") return def;
  const n = parseFloat(v);
  return Number.isNaN(n) ? def : n;
}
export function boolAttr(el, name, def = false) {
  const v = el.attrs[name];
  if (v === undefined) return def;
  return v === "true" || v === "1";
}
export function childrenNamed(el, name) {
  return el.children.filter((c) => c.name === name);
}
export function firstChildNamed(el, name) {
  return el.children.find((c) => c.name === name) || null;
}
