import type { ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import { CodeBlock, MarkdownContent, TableScroll } from "./styles";
import type { MessageMarkdownProps } from "./types";

/** Markdown cannot navigate app/private routes, launch custom protocols or load resources. */
function safeLink(value: string): string | undefined {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code <= 32 || code === 127) return undefined;
  }
  try {
    const parsed = new URL(value);
    return ["https:", "http:", "mailto:"].includes(parsed.protocol) ? parsed.href : undefined;
  } catch { return undefined; }
}

function MarkdownLink({ href, title, children }: ComponentProps<"a">) {
  const safe = href ? safeLink(href) : undefined;
  return safe ? <a href={safe} title={title} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>;
}

function MarkdownTable({ children }: ComponentProps<"table">) {
  const { t } = useTranslation("nodiaAi");
  return <TableScroll role="region" aria-label={t("markdown.table_region")} tabIndex={0}><table>{children}</table></TableScroll>;
}

function MarkdownCodeBlock({ children }: ComponentProps<"pre">) {
  const { t } = useTranslation("nodiaAi");
  return <CodeBlock role="region" aria-label={t("markdown.code_region")} tabIndex={0}>{children}</CodeBlock>;
}

// Stable component identities preserve local scroll and existing DOM during message revalidation.
const components: Components = {
  a: MarkdownLink,
  img: ({ alt }) => alt ? <span>{alt}</span> : null,
  table: MarkdownTable,
  th: ({ children, style }) => <th scope="col" style={style}>{children}</th>,
  pre: MarkdownCodeBlock,
  h1: "h3", h2: "h4", h3: "h5", h4: "h6", h5: "h6", h6: "h6",
};
const allowedElements = ["p", "strong", "em", "del", "a", "img", "ul", "ol", "li", "blockquote", "pre", "code",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "br", "table", "thead", "tbody", "tr", "th", "td", "input"];
const remarkPlugins = [remarkGfm];

export default function MessageMarkdown({ text }: MessageMarkdownProps) {
  // react-markdown escapes raw HTML as text; never enable rehype-raw or HTML execution.
  return <MarkdownContent><ReactMarkdown skipHtml={false} allowedElements={allowedElements} components={components}
    remarkPlugins={remarkPlugins} urlTransform={safeLink}>{text}</ReactMarkdown></MarkdownContent>;
}
