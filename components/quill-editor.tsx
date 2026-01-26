"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";
import "react-quill-new/dist/quill.snow.css";

import hljs, { ensureHljsOnWindowOnce } from "@/lib/hljs";
import "highlight.js/styles/github-dark.css";

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
}) as any;

/** ✅ divider blot 등록을 "동기"로 보장 */
let DIVIDER_READY = false;

function ensureDividerRegisteredOnce() {
  if (DIVIDER_READY) return;
  if (typeof window === "undefined") return;

  try {
    // ✅ 핵심: react-quill-new가 사용하는 Quill 인스턴스를 여기서 가져온다 (동기)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: any = require("react-quill-new");
    const Q = mod?.Quill;
    if (!Q) return;

    const BlockEmbed = Q.import("blots/block/embed");

    class DividerBlot extends BlockEmbed {
      static blotName = "divider";
      static tagName = "hr";
    }

    Q.register(DividerBlot, true);
    try {
      const icons = Q.import("ui/icons");
      // 간단한 hr 아이콘 (가로선)
      icons["divider"] =
        '<svg viewBox="0 0 18 18"><line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" stroke-width="2"/></svg>';
    } catch {
      // ignore
    }

    DIVIDER_READY = true;
  } catch {
    // ignore
  }
}

function injectDataLanguage(html: string) {
  if (!html) return html;
  if (html.includes("data-language=")) return html;
  if (!html.includes("language-")) return html;
  if (typeof window === "undefined" || typeof DOMParser === "undefined")
    return html;

  const mayHaveTargets =
    html.includes("ql-syntax") ||
    html.includes("<pre") ||
    html.includes("<code");
  if (!mayHaveTargets) return html;

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    let mutated = false;

    doc.querySelectorAll("pre.ql-syntax").forEach((pre) => {
      if (pre.getAttribute("data-language")) return;

      const cls = (pre.getAttribute("class") || "").split(/\s+/);
      const langClass = cls.find((c) => c.startsWith("language-"));
      if (!langClass) return;

      const lang = langClass.replace("language-", "").trim().toLowerCase();
      if (!lang) return;

      pre.setAttribute("data-language", lang);
      mutated = true;
    });

    doc.querySelectorAll("pre code").forEach((code) => {
      if (code.getAttribute("data-language")) return;

      const cls = (code.getAttribute("class") || "").split(/\s+/);
      const langClass = cls.find((c) => c.startsWith("language-"));
      if (!langClass) return;

      const lang = langClass.replace("language-", "").trim().toLowerCase();
      if (!lang) return;

      code.setAttribute("data-language", lang);
      mutated = true;
    });

    if (!mutated) return html;
    const out = doc.body.innerHTML;
    return out === html ? html : out;
  } catch {
    return html;
  }
}

/**
 * ✅ 붙여넣기(clipboard) 시 표/문서에서 따라오는 색상 포맷 제거
 */
function installClipboardSanitizer(quill: any) {
  const clipboard = quill?.getModule?.("clipboard");
  if (!clipboard?.addMatcher) return;

  const stripColorAndBgFromDelta = (delta: any) => {
    try {
      if (!delta?.ops) return delta;
      delta.ops = delta.ops.map((op: any) => {
        if (op?.attributes) {
          const { color, background, ...rest } = op.attributes;
          op.attributes = rest;
          if (Object.keys(op.attributes).length === 0) {
            delete op.attributes;
          }
        }
        return op;
      });
    } catch {}
    return delta;
  };

  clipboard.addMatcher("TD", (node: any, delta: any) => {
    delta = stripColorAndBgFromDelta(delta);

    try {
      const text = typeof node?.innerText === "string" ? node.innerText : "";
      if (text.includes("\n")) {
        if (
          delta?.ops?.length === 1 &&
          typeof delta.ops[0]?.insert === "string"
        ) {
          delta.ops[0].insert = text;
        }
      }
    } catch {}

    return delta;
  });

  clipboard.addMatcher("TH", (_node: any, delta: any) =>
    stripColorAndBgFromDelta(delta),
  );
  clipboard.addMatcher("TABLE", (_node: any, delta: any) =>
    stripColorAndBgFromDelta(delta),
  );
  clipboard.addMatcher("SPAN", (_node: any, delta: any) =>
    stripColorAndBgFromDelta(delta),
  );
}

function installTablePasteNormalizer(quill: any) {
  const root: HTMLElement | null = quill?.root ?? null;
  if (!root) return;

  const sanitizeStyleAttrsInTable = (table: HTMLElement) => {
    const styled = Array.from(
      table.querySelectorAll("[style]"),
    ) as HTMLElement[];
    for (const el of styled) {
      const style = el.getAttribute("style") || "";
      if (!style) continue;

      const cleaned = style
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => {
          const k = s.split(":")[0]?.trim().toLowerCase();
          return (
            k !== "color" && k !== "background" && k !== "background-color"
          );
        })
        .join("; ");

      if (cleaned) el.setAttribute("style", cleaned);
      else el.removeAttribute("style");
    }

    const attrs = Array.from(
      table.querySelectorAll("[bgcolor],[color]"),
    ) as HTMLElement[];
    for (const el of attrs) {
      el.removeAttribute("bgcolor");
      el.removeAttribute("color");
    }
  };

  const countCols = (tr: HTMLTableRowElement) => {
    const cells = Array.from(
      tr.querySelectorAll("th,td"),
    ) as HTMLTableCellElement[];
    let count = 0;
    for (const c of cells) {
      const cs = Number(c.getAttribute("colspan") || "1");
      count += Number.isFinite(cs) && cs > 0 ? cs : 1;
    }
    return count;
  };

  const normalizeTableHtml = (html: string) => {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const tables = Array.from(doc.querySelectorAll("table")) as HTMLElement[];
      if (tables.length === 0) return html;

      for (const table of tables) {
        sanitizeStyleAttrsInTable(table);

        const rows = Array.from(
          table.querySelectorAll("tr"),
        ) as HTMLTableRowElement[];
        if (rows.length === 0) continue;

        const freq = new Map<number, number>();
        for (const r of rows) {
          const c = countCols(r);
          if (c > 0) freq.set(c, (freq.get(c) || 0) + 1);
        }
        let targetCols = 0;
        let best = -1;
        for (const [cols, f] of freq.entries()) {
          if (f > best) {
            best = f;
            targetCols = cols;
          }
        }
        if (targetCols <= 0) continue;

        for (const tr of rows) {
          const cells = Array.from(
            tr.querySelectorAll("th,td"),
          ) as HTMLTableCellElement[];
          let currentCols = countCols(tr);

          while (currentCols > targetCols && cells.length > 1) {
            const extra = cells.pop();
            const last = cells[cells.length - 1];
            if (!extra || !last) break;

            const extraHtml = (extra as HTMLElement).innerHTML?.trim();
            if (extraHtml) {
              const lastEl = last as HTMLElement;
              const lastHtml = lastEl.innerHTML?.trim();
              lastEl.innerHTML = lastHtml
                ? `${lastHtml}<br>${extraHtml}`
                : extraHtml;
            }
            extra.remove();
            currentCols = countCols(tr);
          }

          while (currentCols < targetCols) {
            const td = doc.createElement("td");
            td.innerHTML = "";
            tr.appendChild(td);
            currentCols = countCols(tr);
          }
        }
      }

      return doc.body.innerHTML;
    } catch {
      return html;
    }
  };

  const anyRoot = root as any;
  if (anyRoot.__studyTablePasteHandler) {
    root.removeEventListener("paste", anyRoot.__studyTablePasteHandler, true);
    delete anyRoot.__studyTablePasteHandler;
  }

  const handler = (e: ClipboardEvent) => {
    const cd = e.clipboardData;
    if (!cd) return;

    const html = cd.getData("text/html");
    if (!html || !html.includes("<table")) return;

    e.preventDefault();
    e.stopPropagation();
    // @ts-ignore
    if (typeof e.stopImmediatePropagation === "function")
      e.stopImmediatePropagation();

    const normalized = normalizeTableHtml(html);
    const index = quill.getSelection()?.index ?? quill.getLength();
    quill.clipboard.dangerouslyPasteHTML(index, normalized, "user");
  };

  root.addEventListener("paste", handler, true);
  anyRoot.__studyTablePasteHandler = handler;
}

type QuillEditorProps = {
  value: string;
  onChange: (v: string) => void;

  stickyToolbar?: boolean;
  stickyTopPx?: number;
  maxWidthPx?: number;
  minHeightPx?: number;

  placeholder?: string;
};

export default function QuillEditor({
  value,
  onChange,
  stickyToolbar = true,
  stickyTopPx = 56,
  maxWidthPx = 760,
  minHeightPx = 420,
  placeholder,
}: QuillEditorProps) {
  useEffect(() => {
    ensureHljsOnWindowOnce();
    ensureDividerRegisteredOnce(); // ✅ 여기서 먼저 등록
  }, []);

  const quillRef = useRef<any>(null);
  const lastEmittedRef = useRef<string>("");
  const clipboardInitRef = useRef(false);

  const modules = useMemo(() => {
    return {
      syntax: {
        highlight: (text: string) => {
          const w = window as any;
          const engine = w?.hljs || hljs;
          return engine.highlightAuto(text).value;
        },
        languages: [
          { key: "plain", label: "Plain" },
          { key: "bash", label: "Bash" },
          { key: "cpp", label: "C++" },
          { key: "csharp", label: "C#" },
          { key: "css", label: "CSS" },
          { key: "diff", label: "Diff" },
          { key: "xml", label: "HTML/XML" },
          { key: "java", label: "Java" },
          { key: "javascript", label: "JavaScript" },
          { key: "json", label: "JSON" },
          { key: "kotlin", label: "Kotlin" },
          { key: "markdown", label: "Markdown" },
          { key: "python", label: "Python" },
          { key: "sql", label: "SQL" },
          { key: "typescript", label: "TypeScript" },
        ],
      },

      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["blockquote", "code-block"],
          ["link", "image"],
          ["divider"],
          ["clean"],
        ],
        handlers: {
          link: function () {
            const quill = (this as any).quill;
            const range = quill.getSelection(true);
            const url = window.prompt("Enter link URL");
            if (!url) return;

            if (!range || range.length === 0) {
              const index = range?.index ?? quill.getLength();
              quill.insertText(index, url, { link: url });
              quill.setSelection(index + url.length, 0);
              return;
            }
            quill.format("link", url);
          },

          divider: function () {
            // ✅ 여기서도 한 번 더 보장 (HMR/초기 타이밍 방어)
            ensureDividerRegisteredOnce();

            const quill = (this as any).quill;
            const range = quill.getSelection(true);
            const index = range?.index ?? quill.getLength();

            quill.insertEmbed(index, "divider", true, "user");
            quill.setSelection(index + 1, 0);
          },
        },
      },
    };
  }, []);

  const handleMouseDownCapture = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    if (target.closest(".ql-toolbar")) return;

    const container = target.closest(".quill-editor .ql-container.ql-snow");
    if (!container) return;

    const inEditor = !!target.closest(".ql-editor");
    const isNonTextTarget = !!target.closest(
      "img, table, thead, tbody, tr, td, th, pre, code, .ql-syntax",
    );
    if (inEditor && !isNonTextTarget) return;

    const quill = quillRef.current?.getEditor?.();
    if (quill) {
      quill.focus();
      const len = quill.getLength();
      quill.setSelection(len, 0, "silent");
      return;
    }

    const editorEl = container.querySelector(
      ".ql-editor",
    ) as HTMLElement | null;
    editorEl?.focus();
  };

  const wrapperClass = stickyToolbar
    ? "rounded-md border border-border editor-dark"
    : "rounded-md border border-border overflow-hidden editor-dark";

  const maybeInitClipboard = () => {
    if (clipboardInitRef.current) return;
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;
    installClipboardSanitizer(quill);
    installTablePasteNormalizer(quill);
    clipboardInitRef.current = true;
  };

  return (
    <div className={wrapperClass} onMouseDownCapture={handleMouseDownCapture}>
      <ReactQuill
        ref={(instance: any) => {
          quillRef.current = instance;
          setTimeout(maybeInitClipboard, 0);
        }}
        value={value}
        placeholder={placeholder}
        onChange={(html: string) => {
          ensureHljsOnWindowOnce();
          const next = injectDataLanguage(html);
          if (next === lastEmittedRef.current) return;
          lastEmittedRef.current = next;
          onChange(next);
        }}
        modules={modules}
        theme="snow"
        className="quill-editor"
      />

      <style jsx global>{`
        .quill-editor .ql-container {
          min-height: ${minHeightPx}px;
        }

        .quill-editor .ql-editor {
          min-height: ${minHeightPx}px;
          font-size: 16px;
          line-height: 1.7;

          max-width: ${maxWidthPx}px;
          margin-left: auto;
          margin-right: auto;

          padding-left: 16px;
          padding-right: 16px;
        }

        .editor-dark .ql-toolbar.ql-snow {
          background: color-mix(in oklab, var(--color-card) 92%, black 8%);
          border-color: var(--color-border);
        }

        ${stickyToolbar
          ? `
        .editor-dark .ql-toolbar.ql-snow {
          position: sticky;
          top: ${stickyTopPx}px;
          z-index: 100;
        }`
          : `
        .editor-dark .ql-toolbar.ql-snow {
          position: static;
        }`}

        .editor-dark .ql-container.ql-snow {
          border-color: var(--color-border);
        }
        .editor-dark .ql-editor {
          background: var(--color-card);
          color: var(--color-card-foreground);
        }
        .editor-dark .ql-editor.ql-blank::before {
          color: color-mix(
            in oklab,
            var(--color-muted-foreground) 70%,
            transparent 30%
          );
        }

        .editor-dark .ql-snow .ql-stroke {
          stroke: color-mix(
            in oklab,
            var(--color-foreground) 85%,
            transparent 15%
          );
        }
        .editor-dark .ql-snow .ql-fill {
          fill: color-mix(
            in oklab,
            var(--color-foreground) 85%,
            transparent 15%
          );
        }
        .editor-dark .ql-snow .ql-picker {
          color: var(--color-foreground);
        }
        .editor-dark .ql-snow .ql-picker-options {
          background: var(--color-popover);
          border-color: var(--color-border);
        }

        .editor-dark .ql-syntax {
          background: color-mix(in oklab, var(--color-muted) 35%, black 65%);
          color: var(--color-foreground);
          border: 1px solid var(--color-border);
          padding: 12px 14px;
          border-radius: var(--radius-lg);
          overflow-x: auto;
        }

        .editor-dark .ql-editor table {
          width: 100%;
          border-collapse: collapse;
          table-layout: auto;
        }

        .editor-dark .ql-editor table th,
        .editor-dark .ql-editor table td {
          border: 1px solid var(--color-border) !important;
          padding: 10px 12px !important;
          vertical-align: top;
          color: var(--color-card-foreground) !important;
          background: color-mix(
            in oklab,
            var(--color-card) 92%,
            black 8%
          ) !important;
        }

        .editor-dark .ql-editor table th {
          font-weight: 700;
          background: color-mix(
            in oklab,
            var(--color-card) 86%,
            black 14%
          ) !important;
        }

        .editor-dark .ql-editor table tr:nth-child(even) td {
          background: color-mix(
            in oklab,
            var(--color-card) 88%,
            black 12%
          ) !important;
        }

        .editor-dark .ql-editor table a {
          color: var(--color-primary) !important;
          text-decoration: underline;
        }

        .editor-dark .ql-editor table code {
          background: color-mix(
            in oklab,
            var(--color-muted) 35%,
            black 65%
          ) !important;
          border: 1px solid var(--color-border) !important;
          padding: 0.15rem 0.35rem;
          border-radius: 0.35rem;
          color: var(--color-foreground) !important;
        }
      `}</style>
    </div>
  );
}
