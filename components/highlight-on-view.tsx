"use client";

import { useEffect } from "react";
import hljs from "highlight.js/lib/core";

import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import java from "highlight.js/lib/languages/java";
import sql from "highlight.js/lib/languages/sql";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";

import "highlight.js/styles/github-dark.css";

function detectLang(el: Element): string | null {
  // 1) data-language 우선
  const dl = el.getAttribute("data-language");
  if (dl) return dl.toLowerCase();

  // 2) class에 language-xxx 형태가 있는지
  const cls = (el.getAttribute("class") || "").split(/\s+/);
  const langClass = cls.find((c) => c.startsWith("language-"));
  if (langClass) return langClass.replace("language-", "").toLowerCase();

  return null;
}

function wrapCodeBlock(pre: HTMLElement, lang: string | null) {
  // 이미 래핑했으면 스킵
  if (pre.parentElement?.classList.contains("codeblock-wrap")) return;

  const wrap = document.createElement("div");
  wrap.className = "codeblock-wrap";
  wrap.style.position = "relative";

  // pre를 wrap으로 감싸기
  const parent = pre.parentNode;
  if (!parent) return;
  parent.insertBefore(wrap, pre);
  wrap.appendChild(pre);

  // 언어 배지(있으면)
  if (lang) {
    const badge = document.createElement("div");
    badge.textContent = lang.toUpperCase();
    badge.className = "codeblock-lang";
    wrap.appendChild(badge);
  }

  // 복사 버튼
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "복사";
  btn.className = "codeblock-copy";
  btn.addEventListener("click", async () => {
    const text = pre.innerText ?? "";
    try {
      await navigator.clipboard.writeText(text);
      const old = btn.textContent;
      btn.textContent = "복사됨";
      setTimeout(() => (btn.textContent = old || "복사"), 900);
    } catch {
      // clipboard 권한 실패 대비
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        const old = btn.textContent;
        btn.textContent = "복사됨";
        setTimeout(() => (btn.textContent = old || "복사"), 900);
      } catch {
        btn.textContent = "실패";
        setTimeout(() => (btn.textContent = "복사"), 900);
      }
    }
  });
  wrap.appendChild(btn);
}

export default function HighlightOnView({
  selector = ".prose",
}: {
  selector?: string;
}) {
  useEffect(() => {
    hljs.registerLanguage("javascript", javascript);
    hljs.registerLanguage("typescript", typescript);
    hljs.registerLanguage("java", java);
    hljs.registerLanguage("sql", sql);
    hljs.registerLanguage("xml", xml);
    hljs.registerLanguage("css", css);
    hljs.registerLanguage("json", json);
    hljs.registerLanguage("bash", bash);

    const root = document.querySelector(selector);
    if (!root) return;

    // 대상: markdown pre>code, quill pre.ql-syntax
    const pres: HTMLElement[] = [
      ...(Array.from(root.querySelectorAll("pre")) as HTMLElement[]),
    ];

    pres.forEach((pre) => {
      // 코드블록 언어 감지
      const lang = detectLang(pre);

      // Quill은 pre.ql-syntax만 있을 수 있음 → highlightElement(pre)
      // markdown은 pre>code → highlightElement(code)
      const code = pre.querySelector("code");

      if (code) {
        code.classList.add("hljs");
        if (lang) {
          // highlight.js가 언어를 확정할 수 있게 class로도 주입
          code.classList.add(`language-${lang}`);
          code.setAttribute("data-language", lang);
        }
        try {
          hljs.highlightElement(code as HTMLElement);
        } catch {}
      } else {
        pre.classList.add("hljs");
        if (lang) {
          pre.classList.add(`language-${lang}`);
          pre.setAttribute("data-language", lang);
        }
        try {
          hljs.highlightElement(pre);
        } catch {}
      }

      // 복사 버튼 + 언어 배지
      wrapCodeBlock(pre, lang);
    });
  }, [selector]);

  return null;
}
