"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";
import "react-quill-new/dist/quill.snow.css";

import hljs from "highlight.js/lib/core";

// ✅ languages
import plaintext from "highlight.js/lib/languages/plaintext";
import bash from "highlight.js/lib/languages/bash";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import xml from "highlight.js/lib/languages/xml";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import sql from "highlight.js/lib/languages/sql";

import "highlight.js/styles/github-dark.css";

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
}) as any;

const HLJS_READY_KEY = "__hljs_quill_ready__";

function ensureHljsOnWindowOnce() {
  if (typeof window === "undefined") return;
  const w = window as any;

  if (w.hljs && w[HLJS_READY_KEY]) return;

  try {
    hljs.registerLanguage("plaintext", plaintext);
    hljs.registerLanguage("bash", bash);
    hljs.registerLanguage("cpp", cpp);
    hljs.registerLanguage("csharp", csharp);
    hljs.registerLanguage("css", css);
    hljs.registerLanguage("diff", diff);
    hljs.registerLanguage("xml", xml);
    hljs.registerLanguage("java", java);
    hljs.registerLanguage("javascript", javascript);
    hljs.registerLanguage("markdown", markdown);
    hljs.registerLanguage("php", php);
    hljs.registerLanguage("python", python);
    hljs.registerLanguage("ruby", ruby);
    hljs.registerLanguage("sql", sql);
    hljs.registerLanguage("jsx", javascript);
  } catch {
    // ignore
  }

  w.hljs = w.hljs || hljs;
  w[HLJS_READY_KEY] = true;
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
 * - 구글독스/노션/웹페이지 표 복붙하면 인라인 color/background가 붙어서 다크모드에서 깨짐
 * - 여기서 table cell에 섞여 들어오는 color/background 포맷을 제거해버림
 */
function installClipboardSanitizer(quill: any) {
  const clipboard = quill?.getModule?.("clipboard");
  if (!clipboard?.addMatcher) return;

  const stripColorAndBgFromDelta = (delta: any) => {
    try {
      if (!delta?.ops) return delta;
      delta.ops = delta.ops.map((op: any) => {
        if (op?.attributes) {
          // Quill 포맷: color/background 제거
          const { color, background, ...rest } = op.attributes;
          op.attributes = rest;
          if (Object.keys(op.attributes).length === 0) {
            delete op.attributes;
          }
        }
        return op;
      });
    } catch {
      // ignore
    }
    return delta;
  };

  // TD/TH/PRE 등에서 들어오는 색상 포맷을 제거
  clipboard.addMatcher("TD", (node: any, delta: any) => {
    // 1) 기존: 색/배경 제거
    delta = stripColorAndBgFromDelta(delta);

    // 2) 추가: 셀 내부 줄바꿈을 최대한 유지
    //    (복붙 시 줄바꿈이 공백으로 합쳐지는 케이스 방어)
    try {
      const text = typeof node?.innerText === "string" ? node.innerText : "";
      if (text.includes("\n")) {
        // Quill은 insert 문자열에 '\n'이 있으면 줄바꿈으로 처리해줌
        // (단일 텍스트로 들어오는 케이스를 중심으로 보정)
        if (
          delta?.ops?.length === 1 &&
          typeof delta.ops[0]?.insert === "string"
        ) {
          delta.ops[0].insert = text;
        }
      }
    } catch {
      // ignore
    }

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
    // style 속성에서 color/background 제거
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

        // 최빈 컬럼 수(모드)
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

          // 초과 컬럼 -> 마지막 칸에 <br>로 합치기
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

          // 부족 컬럼 -> 빈칸 채우기
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

  // ✅ 핵심: 중복 리스너 방지 (같은 root에 이미 있으면 제거)
  const anyRoot = root as any;
  if (anyRoot.__studyTablePasteHandler) {
    root.removeEventListener("paste", anyRoot.__studyTablePasteHandler, true);
    delete anyRoot.__studyTablePasteHandler;
  }

  const handler = (e: ClipboardEvent) => {
    const cd = e.clipboardData;
    if (!cd) return;

    const html = cd.getData("text/html");
    if (!html || !html.includes("<table")) return; // table paste만 가로챔

    // ✅ Quill 기본 paste가 또 실행되지 않게 강하게 차단
    e.preventDefault();
    e.stopPropagation();
    // @ts-ignore
    if (typeof e.stopImmediatePropagation === "function")
      e.stopImmediatePropagation();

    const normalized = normalizeTableHtml(html);
    const index = quill.getSelection()?.index ?? quill.getLength();
    quill.clipboard.dangerouslyPasteHTML(index, normalized, "user");
  };

  // ✅ capture 단계(true)에서 먼저 잡는다
  root.addEventListener("paste", handler, true);
  anyRoot.__studyTablePasteHandler = handler;
}

type QuillEditorProps = {
  value: string;
  onChange: (v: string) => void;

  /** sticky toolbar */
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

      // ✅ 여기부터 핵심: toolbar를 {container, handlers} 형태로
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["blockquote", "code-block"],
          ["link", "image"],
          ["clean"],
        ],

        handlers: {
          link: function () {
            const quill = (this as any).quill;
            const range = quill.getSelection(true);
            const url = window.prompt("Enter link URL");
            if (!url) return;

            // ✅ 선택영역 없으면: URL 텍스트를 삽입하면서 링크 적용
            if (!range || range.length === 0) {
              const index = range?.index ?? quill.getLength();
              quill.insertText(index, url, { link: url });
              quill.setSelection(index + url.length, 0);
              return;
            }

            // ✅ 선택영역 있으면: 선택 텍스트에 링크 적용
            quill.format("link", url);
          },
        },
      },
    };
  }, []);

  // ✅ 파란 영역(ql-container) 아무데나 클릭해도 커서 들어가게
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

  // ✅ Quill 인스턴스 준비되면 clipboard sanitizer 1회 설치
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
          // ref 세팅 타이밍에 init 시도
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

        /* ✅ 툴바 스타일 (기본 유지) */
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

        /* =========================================================
           ✅ 여기부터 “표 다크모드 고정 스타일”
           - 기본 UI/레이아웃은 건들지 않고
           - 에디터 내부(table)에서만 강제로 가독성 확보
           - 복붙 인라인 스타일(color/background)도 !important로 덮어씀
           ========================================================= */

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

        /* 표 안에서 링크/코드/텍스트 컬러도 다크모드로 통일 */
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
