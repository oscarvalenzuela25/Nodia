import { fromMarkdown } from "mdast-util-from-markdown";
import type { Nodes } from "mdast";

const headingTags = ["h4", "h5", "h6"] as const;

function appendChildren(parent: HTMLElement | DocumentFragment, children: readonly Nodes[]) {
  for (const child of children) {
    const rendered = renderNode(child);
    if (rendered) parent.append(rendered);
  }
}

function container(tag: string, children: readonly Nodes[]) {
  const element = document.createElement(tag);
  appendChildren(element, children);
  return element;
}

function textElement(tag: string, value: string) {
  const element = document.createElement(tag);
  element.textContent = value;
  return element;
}

function renderNode(node: Nodes): Node | undefined {
  switch (node.type) {
    case "text": return document.createTextNode(node.value);
    case "paragraph": return container("p", node.children);
    case "heading": return container(headingTags[Math.min(node.depth - 1, 2)], node.children);
    case "emphasis": return container("em", node.children);
    case "strong": return container("strong", node.children);
    case "blockquote": return container("blockquote", node.children);
    case "thematicBreak": return document.createElement("hr");
    case "break": return document.createElement("br");
    case "listItem": return container("li", node.children);
    case "list": {
      if (!node.ordered) return container("ul", node.children);
      const list = document.createElement("ol");
      if (node.start != null && node.start !== 1) list.start = node.start;
      appendChildren(list, node.children);
      return list;
    }
    case "inlineCode": return textElement("code", node.value);
    case "code": {
      const pre = document.createElement("pre");
      pre.append(textElement("code", node.value));
      return pre;
    }
    case "link":
    case "linkReference": {
      const label = document.createDocumentFragment();
      appendChildren(label, node.children);
      return label;
    }
    case "image":
    case "imageReference": return document.createTextNode(node.alt ?? "");
    // HTML and definitions never enter the DOM. In particular, no node can set a URL or event handler.
    default: return undefined;
  }
}

export function renderReadingMarkdown(markdown: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  try {
    appendChildren(fragment, fromMarkdown(markdown).children);
  } catch {
    // Deeply nested content may exceed the parser or renderer's call stack. Keep the copy readable.
    fragment.replaceChildren(textElement("pre", markdown));
  }
  return fragment;
}
