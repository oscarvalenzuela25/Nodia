import { isValidElement, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { IconButton, Tooltip, Typography } from "@mui/material";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import ReactMarkdown, { type Components } from "react-markdown";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import { CodeFrame, CodeHeader, CodeScroll, MarkdownContent } from "./styles";

// Display-only aliases for declared Markdown languages; never infer a language from code.
const extensions = new Map([
  ["html", ".html"], ["css", ".css"], ["scss", ".scss"], ["less", ".less"],
  ["javascript", ".js"], ["js", ".js"], ["jsx", ".jsx"],
  ["typescript", ".ts"], ["ts", ".ts"], ["tsx", ".tsx"],
  ["json", ".json"], ["xml", ".xml"], ["yaml", ".yaml"], ["yml", ".yml"],
  ["python", ".py"], ["py", ".py"], ["bash", ".sh"], ["shell", ".sh"], ["sh", ".sh"],
  ["sql", ".sql"], ["java", ".java"], ["c", ".c"], ["cpp", ".cpp"], ["c++", ".cpp"],
  ["csharp", ".cs"], ["c#", ".cs"], ["go", ".go"], ["rust", ".rs"], ["rs", ".rs"],
  ["php", ".php"], ["ruby", ".rb"], ["rb", ".rb"], ["markdown", ".md"], ["md", ".md"],
]);

function MarkdownCodeBlock({ children }: ComponentProps<"pre">) {
  const { t } = useTranslation();
  const inFlight = useRef(false);
  const [copying, setCopying] = useState(false);
  const element = isValidElement<{ className?: string; children?: ReactNode }>(children) ? children : null;
  const code = typeof element?.props.children === "string" ? element.props.children : null;
  const language = element?.props.className?.match(/(?:^|\s)language-([^\s]+)/)?.[1];
  const label = language ? extensions.get(language.toLowerCase()) ?? language : t("teacher:code_label");
  const copy = async () => {
    if (code === null || inFlight.current) return;
    inFlight.current = true;
    setCopying(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(code);
      sileo.success({ title: t("teacher:code_copied") });
    } catch {
      sileo.error({ title: t("teacher:code_copy_failed"), description: t("teacher:code_copy_manual") });
    } finally { inFlight.current = false; setCopying(false); }
  };
  return <CodeFrame>
    <CodeHeader>
      <Typography component="span" variant="caption" sx={{ fontFamily: "inherit", fontWeight: 700, overflowWrap: "anywhere", minWidth: 0 }}>{label}</Typography>
      {code !== null && <Tooltip title={t("teacher:code_copy")}><span><IconButton aria-label={t("teacher:code_copy")} disabled={copying} onClick={() => void copy()} sx={{ width: 44, height: 44 }}><ContentCopyOutlined fontSize="small" /></IconButton></span></Tooltip>}
    </CodeHeader>
    <CodeScroll role="region" aria-label={t("teacher:code_region", { language: label })} tabIndex={0}>{children}</CodeScroll>
  </CodeFrame>;
}

const components: Components = { pre: MarkdownCodeBlock };

export default function LessonMarkdown({ text }: { text: string }) {
  return <MarkdownContent><ReactMarkdown skipHtml disallowedElements={["img"]} components={components}>{text}</ReactMarkdown></MarkdownContent>;
}
