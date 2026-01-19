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
 *
 * ⚠️ 주의: 매 onChange마다 DOMParser로 HTML을 "정규화"하면
 *          문자열이 미세하게 달라져 ReactQuill value와 충돌 → 무한 루프 가능.
 *          그래서 "주입이 정말 필요한 경우"에만 파싱한다.
 */
function injectDataLanguage(html: string) {
  if (!html) return html;

  // ✅ data-language가 이미 있으면 굳이 파싱할 필요 없음
  if (html.includes("data-language=")) return html;

  // ✅ language-가 없으면 주입할 것도 없음
  if (!html.includes("language-")) return html;

  // ✅ Quill code block / pre>code 형태가 아예 없으면 파싱할 필요 없음
  const mayHaveTargets =
    html.includes("ql-syntax") ||
    html.includes("<pre") ||
    html.includes("<code");
  if (!mayHaveTargets) return html;

  // ✅ "language-"는 있는데 data-language는 없는 경우에만 실제 파싱/주입
  //    (이 조건을 더 강하게 해서 불필요한 파싱을 최대한 줄임)
  const shouldParse =
    (html.includes("pre") && html.includes("language-")) ||
    (html.includes("ql-syntax") && html.includes("language-"));

  if (!shouldParse) return html;

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    let mutated = false;

    doc.querySelectorAll("pre.ql-syntax").forEach((pre) => {
      if (pre.getAttribute("data-language")) return;

      const cls = (pre.getAttribute("class") || "").split(/\s+/);
      const langClass = cls.find((c) => c.startsWith("language-"));
      if (langClass) {
        const lang = langClass.replace("language-", "").trim().toLowerCase();
        if (lang) {
          pre.setAttribute("data-language", lang);
          mutated = true;
        }
      }
    });

    // Markdown 스타일로 저장될 수도 있으니 pre > code도 같이 처리
    doc.querySelectorAll("pre code").forEach((code) => {
      if (code.getAttribute("data-language")) return;

      const cls = (code.getAttribute("class") || "").split(/\s+/);
      const langClass = cls.find((c) => c.startsWith("language-"));
      if (langClass) {
        const lang = langClass.replace("language-", "").trim().toLowerCase();
        if (lang) {
          code.setAttribute("data-language", lang);
          mutated = true;
        }
      }
    });

    // ✅ 바뀐 게 없으면 원본 그대로 반환 (문자열 미세 변경으로 인한 루프 방지)
    if (!mutated) return html;

    const out = doc.body.innerHTML;

    // ✅ 혹시라도 DOMParser가 공백/정렬만 바꿔버렸다면,
    //    결과가 원본과 완전히 같을 때는 원본을 반환
    if (out === html) return html;

    return out;
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
        onChange={(html) => {
          // ✅ 주입이 필요 없으면 원본 그대로 통과 (루프 방지)
          const next = injectDataLanguage(html);
          onChange(next);
        }}
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
