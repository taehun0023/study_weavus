"use client";

import { useEffect, type ReactNode } from "react";
import hljs, { ensureHljsOnWindowOnce } from "@/lib/hljs";
import "highlight.js/styles/github-dark.css";

function highlight(root: Element) {
  const blocks = Array.from(
    root.querySelectorAll("pre, .ql-syntax"),
  ) as HTMLElement[];

  blocks.forEach((block) => {
    if (block.querySelector(".hljs")) return;

    const code = (block.querySelector("code") ?? block) as HTMLElement;
    code.classList.add("hljs");

    try {
      hljs.highlightElement(code);
    } catch {}
  });
}

export default function HighlightOnView({
  selector = ".prose",
  children,
}: {
  selector?: string;
  children?: ReactNode;
}) {
  useEffect(() => {
    ensureHljsOnWindowOnce();

    const roots = Array.from(document.querySelectorAll(selector));
    if (roots.length === 0) return;

    roots.forEach(highlight);

    const observer = new MutationObserver(() => {
      roots.forEach(highlight);
    });

    roots.forEach((root) => {
      observer.observe(root, { childList: true, subtree: true });
    });

    return () => observer.disconnect();
  }, [selector]);

  return <>{children}</>;
}
