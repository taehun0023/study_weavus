"use client";

import hljs from "highlight.js/lib/core";

// ✅ languages (union of all places that used hljs.registerLanguage)
import plaintext from "highlight.js/lib/languages/plaintext";
import bash from "highlight.js/lib/languages/bash";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import xml from "highlight.js/lib/languages/xml";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import sql from "highlight.js/lib/languages/sql";
import jsonLang from "highlight.js/lib/languages/json";

const HLJS_READY_KEY = "__hljs_quill_ready__";

let REGISTERED = false;

/**
 * ✅ highlight.js language registry (idempotent)
 * - Keeps previous behavior: sets window.hljs and window[HLJS_READY_KEY]
 * - Safe to call from any client component before highlightElement()
 */
export function ensureHljsOnWindowOnce() {
  if (typeof window === "undefined") return hljs;

  const w = window as any;

  // If another place already put hljs on window and marked ready, respect it.
  if (w.hljs && w[HLJS_READY_KEY]) return w.hljs as typeof hljs;

  if (!REGISTERED) {
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
      hljs.registerLanguage("typescript", typescript);
      hljs.registerLanguage("markdown", markdown);
      hljs.registerLanguage("php", php);
      hljs.registerLanguage("python", python);
      hljs.registerLanguage("ruby", ruby);
      hljs.registerLanguage("sql", sql);
      hljs.registerLanguage("json", jsonLang);

      // aliases used in the project
      hljs.registerLanguage("jsx", javascript);
    } catch {
      // ignore
    }
    REGISTERED = true;
  }

  w.hljs = w.hljs || hljs;
  w[HLJS_READY_KEY] = true;

  return w.hljs as typeof hljs;
}

/** Backward-friendly alias */
export function ensureHljsOnce() {
  return ensureHljsOnWindowOnce();
}

export default hljs;
