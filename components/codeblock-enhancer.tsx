"use client";

import { useEffect } from "react";
import hljs from "highlight.js/lib/core";
import "highlight.js/styles/github-dark.css";

// ✅ languages (QuillEditor와 동일)
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

type Props = {
  selector?: string; // 기본: ".post-content"
};

let HLJS_READY = false;
function ensureHljsOnce() {
  if (HLJS_READY) return;
  HLJS_READY = true;

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

    // alias
    hljs.registerLanguage("jsx", javascript);
  } catch {
    // ignore
  }
}

function normalizeLang(raw: string) {
  const v = (raw || "").trim();
  if (!v) return "";
  return v.toUpperCase();
}

function toHljsLang(rawUpper: string) {
  const v = (rawUpper || "").trim().toUpperCase();
  if (!v) return "";

  switch (v) {
    case "PLAIN":
    case "PLAINTEXT":
      return "plaintext";
    case "HTML":
    case "XML":
    case "HTML/XML":
      return "xml";
    case "JS":
    case "JAVASCRIPT":
      return "javascript";
    case "C#":
    case "CSHARP":
      return "csharp";
    case "C++":
    case "CPP":
      return "cpp";
    default:
      return v.toLowerCase();
  }
}

function getLanguageFromPre(pre: HTMLElement) {
  // 1) data-language
  const dl = pre.getAttribute("data-language");
  if (dl) return normalizeLang(dl);

  // 2) className like: language-java / lang-java
  const cls = pre.className || "";
  const m = cls.match(/(?:language|lang)-([a-z0-9]+)/i);
  if (m?.[1]) return normalizeLang(m[1]);

  // 3) Quill: ql-syntax language-java
  const m2 = cls.match(/language-([a-z0-9]+)/i);
  if (m2?.[1]) return normalizeLang(m2[1]);

  return "";
}

function ensureNotInsideP(node: HTMLElement) {
  const parent = node.parentElement;
  if (parent && parent.tagName === "P") {
    parent.parentElement?.insertBefore(node, parent.nextSibling);
    if (parent.textContent?.trim() === "") parent.remove();
  }
}

/**
 * Quill list HTML -> semantic list
 */
function normalizeQuillLists(root: HTMLElement) {
  const ols = Array.from(root.querySelectorAll("ol")) as HTMLOListElement[];

  for (const ol of ols) {
    const lis = Array.from(ol.children).filter(
      (n) => n.tagName === "LI",
    ) as HTMLLIElement[];
    if (lis.length === 0) continue;

    const types = new Set(lis.map((li) => li.getAttribute("data-list") || ""));

    // bullet -> ul
    if (types.size === 1 && types.has("bullet")) {
      const ul = document.createElement("ul");
      ul.className = ol.className;

      for (const li of lis) {
        li.removeAttribute("data-list");
        const ui = li.querySelector(".ql-ui");
        if (ui) ui.remove();
        ul.appendChild(li);
      }

      ol.replaceWith(ul);
      continue;
    }

    // ordered -> keep ol, cleanup
    if (types.has("ordered") || types.size === 1) {
      for (const li of lis) {
        li.removeAttribute("data-list");
        const ui = li.querySelector(".ql-ui");
        if (ui) ui.remove();
      }
    }
  }
}

/**
 * ✅ 저장 후 상세 화면에서도 색 나오게:
 * highlightElement(pre) 대신 텍스트를 직접 highlight해서 pre.innerHTML로 넣는다.
 * (pre 내부에 <code>가 없는 구조에서도 확실히 동작)
 */
function applyHighlightToPre(pre: HTMLElement) {
  // 이미 진짜 하이라이트(span)가 있으면 스킵
  if (pre.querySelector("span.hljs")) return;

  const langUpper = getLanguageFromPre(pre);
  const lang = toHljsLang(langUpper);

  const codeText = pre.textContent ?? "";
  if (!codeText.trim()) return;

  // 다른 시도에서 남긴 흔적 제거
  pre.removeAttribute("data-highlighted");
  pre.classList.remove("language-undefined");
  pre.classList.remove("hljs");

  try {
    const result = lang
      ? hljs.highlight(codeText, { language: lang })
      : hljs.highlightAuto(codeText);

    pre.innerHTML = result.value; // ✅ span.hljs-* 생성
    pre.classList.add("hljs");
    if (lang) pre.classList.add(`language-${lang}`);
  } catch {
    pre.textContent = codeText;
  }
}

function enhanceCodeBlocks(root: HTMLElement) {
  const pres = Array.from(root.querySelectorAll("pre")) as HTMLElement[];

  for (const pre of pres) {
    // ✅ 1. 항상 하이라이트 시도
    applyHighlightToPre(pre);

    // ✅ 2. 이미 codeframe 안에 있으면 재구성만 스킵
    if (pre.parentElement?.classList.contains("codeframe")) {
      continue;
    }

    // ✅ 3. 강제로 codeframe 생성
    const frame = document.createElement("div");
    frame.className = "codeframe";

    const header = document.createElement("div");
    header.className = "codeframe__header";

    const langEl = document.createElement("div");
    langEl.className = "codeframe__lang";
    const language = getLanguageFromPre(pre);
    langEl.textContent = language || "";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "codeframe__copy";
    btn.textContent = "복사";

    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pre.innerText ?? "");
        btn.textContent = "복사됨";
        setTimeout(() => (btn.textContent = "복사"), 900);
      } catch {
        btn.textContent = "실패";
        setTimeout(() => (btn.textContent = "복사"), 900);
      }
    });

    header.appendChild(langEl);
    header.appendChild(btn);

    const parent = pre.parentElement;
    if (!parent) continue;

    parent.insertBefore(frame, pre);
    frame.appendChild(header);
    frame.appendChild(pre);

    ensureNotInsideP(frame);
  }
}

export default function CodeBlockEnhancer({
  selector = ".post-content",
}: Props) {
  useEffect(() => {
    ensureHljsOnce();

    const roots = Array.from(
      document.querySelectorAll(selector),
    ) as HTMLElement[];
    if (roots.length === 0) return;

    const observers: MutationObserver[] = [];
    const timers: number[] = [];
    let raf = 0;

    const run = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        for (const root of roots) {
          normalizeQuillLists(root);
          enhanceCodeBlocks(root);
        }
      });
    };

    // 최초 + 늦게 들어오는 DOM 대비
    run();
    timers.push(window.setTimeout(run, 50));

    // 각 root마다 감시
    for (const root of roots) {
      const ob = new MutationObserver(() => run());
      ob.observe(root, { childList: true, subtree: true });
      observers.push(ob);
    }

    return () => {
      for (const t of timers) window.clearTimeout(t);
      for (const ob of observers) ob.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [selector]);

  return null;
}
