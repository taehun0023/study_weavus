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
import python from "highlight.js/lib/languages/python";

import "highlight.js/styles/github-dark.css";

function highlight(root: Element) {
  const blocks = Array.from(
    root.querySelectorAll("pre, .ql-syntax"),
  ) as HTMLElement[];

  blocks.forEach((block) => {
    // 이미 하이라이트 된 건 스킵
    if (block.querySelector(".hljs")) return;

    const code = block.querySelector("code") ?? block;
    code.classList.add("hljs");

    try {
      hljs.highlightElement(code as HTMLElement);
    } catch {}
  });
}

export default function HighlightOnView({
  selector = ".prose",
}: {
  selector?: string;
}) {
  useEffect(() => {
    // 언어 등록 (1회)
    hljs.registerLanguage("javascript", javascript);
    hljs.registerLanguage("typescript", typescript);
    hljs.registerLanguage("java", java);
    hljs.registerLanguage("sql", sql);
    hljs.registerLanguage("xml", xml);
    hljs.registerLanguage("css", css);
    hljs.registerLanguage("json", json);
    hljs.registerLanguage("bash", bash);
    hljs.registerLanguage("python", python);

    const roots = Array.from(document.querySelectorAll(selector));
    if (roots.length === 0) return;

    // 최초 1회 실행
    roots.forEach(highlight);

    // 🔥 핵심: DOM 변경 감지
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          roots.forEach(highlight);
          break;
        }
      }
    });

    roots.forEach((root) => {
      observer.observe(root, {
        childList: true,
        subtree: true,
      });
    });

    return () => observer.disconnect();
  }, [selector]);

  return null;
}
