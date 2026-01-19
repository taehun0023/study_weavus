"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import "react-quill-new/dist/quill.snow.css";

// highlight.js core + languages
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import java from "highlight.js/lib/languages/java";
import sql from "highlight.js/lib/languages/sql";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

/**
 * 저장 HTML에 언어 정보를 남기기:
 * - Quill syntax 모듈이 pre.ql-syntax에 language-xxx 클래스를 붙여주면
 * - 그걸 읽어서 data-language="xxx"로 저장되게 가공
 */
function injectDataLanguage(html: string) {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");

    doc.querySelectorAll("pre.ql-syntax").forEach((pre) => {
      // 이미 있으면 유지
      if (pre.getAttribute("data-language")) return;

      const cls = (pre.getAttribute("class") || "").split(/\s+/);
      const langClass = cls.find((c) => c.startsWith("language-"));
      if (langClass) {
        const lang = langClass.replace("language-", "").trim().toLowerCase();
        if (lang) pre.setAttribute("data-language", lang);
      }
    });

    // Markdown 스타일로 저장될 수도 있으니 pre > code도 같이 처리
    doc.querySelectorAll("pre code").forEach((code) => {
      if (code.getAttribute("data-language")) return;
      const cls = (code.getAttribute("class") || "").split(/\s+/);
      const langClass = cls.find((c) => c.startsWith("language-"));
      if (langClass) {
        const lang = langClass.replace("language-", "").trim().toLowerCase();
        if (lang) code.setAttribute("data-language", lang);
      }
    });

    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

/**
 * Quill syntax 모듈은 window.hljs를 참조함.
 * 렌더 단계에서 바로 주입해두면 초기 로딩 때도 안정적.
 */
function ensureHljsOnWindow() {
  if (typeof window === "undefined") return;

  if (!(window as any).hljs) {
    hljs.registerLanguage("javascript", javascript);
    hljs.registerLanguage("typescript", typescript);
    hljs.registerLanguage("java", java);
    hljs.registerLanguage("sql", sql);
    hljs.registerLanguage("xml", xml);
    hljs.registerLanguage("css", css);
    hljs.registerLanguage("json", json);
    hljs.registerLanguage("bash", bash);

    (window as any).hljs = hljs;
  }
}

export default function QuillEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // ✅ 렌더 시점에 안전하게 hljs 주입
  ensureHljsOnWindow();

  const modules = useMemo(() => {
    return {
      syntax: true,
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "code-block"],
        ["link", "image"],
        ["clean"],
      ],
    };
  }, []);

  return (
    <div className="rounded-md border border-border overflow-hidden editor-dark">
      <ReactQuill
        value={value}
        onChange={(html) => onChange(injectDataLanguage(html))}
        modules={modules}
        theme="snow"
        className="quill-editor"
      />

      <style jsx global>{`
        /* -----------------------------
           Editor sizing
        ----------------------------- */
        .quill-editor .ql-container {
          min-height: 420px;
        }
        .quill-editor .ql-editor {
          min-height: 420px;
          font-size: 16px;
          line-height: 1.7;
        }

        /* -----------------------------
           Dark theme (token-based)
           - @theme 변수(OKLCH) 기반으로 통일
        ----------------------------- */
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

        /* toolbar icons */
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

        /* -----------------------------
           Code block
           - 보기 페이지(.prose)와 동일 톤으로 맞추기 쉬운 배경
        ----------------------------- */
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
