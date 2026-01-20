"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";
import "react-quill-new/dist/quill.snow.css";

import hljs from "highlight.js/lib/core";

// ✅ languages (스샷 목록 전부)
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

// (선택) TS/TSX도 유지하고 싶으면 아래도 추가로 import/register 하면 됨
// import typescript from "highlight.js/lib/languages/typescript";

import "highlight.js/styles/github-dark.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

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

    // JSX/TSX를 JS/TS로 처리하고 싶으면 alias도 가능
    hljs.registerLanguage("jsx", javascript);
    // hljs.registerLanguage("typescript", typescript);
    // hljs.registerLanguage("tsx", typescript);
  } catch {
    // 이미 등록된 경우 등은 무시
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

export default function QuillEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  useEffect(() => {
    ensureHljsOnWindowOnce();
  }, []);

  const lastEmittedRef = useRef<string>("");

  const modules = useMemo(() => {
    return {
      // ✅ 여기서 languages 목록을 명시하면 스샷처럼 dropdown이 그 목록으로 맞춰짐
      syntax: {
        highlight: (text: string) => {
          const w = window as any;
          const engine = w?.hljs || hljs;
          return engine.highlightAuto(text).value;
        },
        languages: [
          { key: "plain", label: "Plain" }, // quill이 plain을 쓰는 경우가 많음
          { key: "bash", label: "Bash" },
          { key: "cpp", label: "C++" },
          { key: "csharp", label: "C#" },
          { key: "css", label: "CSS" },
          { key: "diff", label: "Diff" },
          { key: "xml", label: "HTML/XML" }, // HTML은 보통 xml로 처리
          { key: "java", label: "Java" },
          { key: "javascript", label: "JavaScript" },
          { key: "markdown", label: "Markdown" },
          { key: "php", label: "PHP" },
          { key: "python", label: "Python" },
          { key: "ruby", label: "Ruby" },
          { key: "sql", label: "SQL" },
        ],
      },
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "code-block"], // ✅ code-block은 유지 (dropdown은 syntax가 관장)
        ["link", "image"],
        ["clean"],
      ],
    };
  }, []);

  return (
    <div className="rounded-md border border-border overflow-hidden editor-dark">
      <ReactQuill
        value={value}
        onChange={(html) => {
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
          min-height: 420px;
        }
        .quill-editor .ql-editor {
          min-height: 420px;
          font-size: 16px;
          line-height: 1.7;
        }

        .editor-dark .ql-toolbar.ql-snow {
          background: color-mix(in oklab, var(--color-card) 92%, black 8%);
          border-color: var(--color-border);
        }
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
      `}</style>
    </div>
  );
}
