"use client";

import * as React from "react";

/**
 * Lightweight (dependency-free) HTML sanitizer for admin-authored Quill content.
 *
 * 목표: Quill 기본 서식(p/br/strong/em/ul/ol/li/code/pre/blockquote/table)은 살리고
 * script/iframe/onClick 같은 위험 요소는 제거.
 *
 * 나중에 DOMPurify 같은 걸 붙이면 sanitizeHtml()만 갈아끼우면 됨.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "span",
  "div",
  "ul",
  "ol",
  "li",
  "code",
  "pre",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "sup",
  "sub",
]);

const ALLOWED_ATTRS = new Set([
  "class",
  "title",
  "aria-label",
  "aria-hidden",
  "role",
]);

function sanitizeNode(node: Node) {
  // Remove comments
  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentNode?.removeChild(node);
    return;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Drop disallowed tags entirely (keep text content)
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = el.parentNode;
      if (!parent) return;

      // Replace element with its children/text
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      return;
    }

    // Remove dangerous attributes
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }

      // style/src/href 등은 여기서 전부 제거 (필요하면 whitelist로 확장)
      if (!ALLOWED_ATTRS.has(name) && !name.startsWith("data-")) {
        el.removeAttribute(attr.name);
        continue;
      }

      // basic hardening: trim huge class strings
      if (name === "class" && value.length > 500) {
        el.setAttribute("class", value.slice(0, 500));
      }
    }
  }

  const children = Array.from(node.childNodes);
  for (const child of children) sanitizeNode(child);
}

/** SSR에서도 결과가 크게 어긋나지 않도록 최소한의 정규식 방어 */
function sanitizeHtmlSSR(html: string) {
  if (!html) return "";

  // Remove blocked tags
  html = html.replace(
    /<(script|style|iframe|object|embed|link|meta)[\s\S]*?>[\s\S]*?<\/\1>/gi,
    "",
  );
  html = html.replace(
    /<(script|style|iframe|object|embed|link|meta)[\s\S]*?\/>/gi,
    "",
  );

  // Remove on* handlers and style attr
  html = html.replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
  html = html.replace(/\sstyle\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");

  // Remove tags not in allowlist (keep inner text as much as possible)
  html = html.replace(/<\/?([a-z0-9-]+)(\s[^>]*)?>/gi, (m, tag) => {
    tag = String(tag).toLowerCase();
    return ALLOWED_TAGS.has(tag) ? m : "";
  });

  // Remove non-allowed attributes on allowed tags (best-effort)
  html = html.replace(/<([a-z0-9-]+)\s+([^>]+)>/gi, (m, tag, attrs) => {
    tag = String(tag).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return `<${tag}>`;

    const kept: string[] = [];
    const re = /([^\s=]+)\s*=\s*(".*?"|'.*?'|[^\s>]+)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(attrs))) {
      const name = match[1].toLowerCase();
      const value = match[2];
      if (name.startsWith("on")) continue;
      if (!ALLOWED_ATTRS.has(name) && !name.startsWith("data-")) continue;
      kept.push(`${match[1]}=${value}`);
    }
    return kept.length ? `<${tag} ${kept.join(" ")}>` : `<${tag}>`;
  });

  return html;
}

export function sanitizeHtml(html: string) {
  if (!html) return "";

  // SSR fallback: best-effort sanitize to avoid hydration mismatch.
  if (typeof window === "undefined") return sanitizeHtmlSSR(html);

  try {
    // DOMParser("text/html")은 환경/입력에 따라 body가 비거나 null인 케이스가 있어
    // 단순한 컨테이너(div)에 innerHTML로 파싱하는 방식이 더 안전합니다.
    const container = document.createElement("div");
    container.innerHTML = String(html);

    // remove obvious dangerous nodes
    container
      .querySelectorAll("script, style, iframe, object, embed, link, meta")
      .forEach((n) => n.remove());

    sanitizeNode(container);
    return container.innerHTML ?? "";
  } catch {
    // 파싱 실패 시 최소한 원본 반환(화면 렌더링이 깨지지 않도록)
    return String(html);
  }
}

export function stripHtml(html: string) {
  if (!html) return "";
  if (typeof window === "undefined") {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  try {
    const container = document.createElement("div");
    container.innerHTML = String(html);
    const text = container.textContent ?? "";
    return String(text)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return String(html)
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

type RichTextProps = {
  html: string;
  className?: string;
};

export function RichText({ html, className }: RichTextProps) {
  // NOTE:
  // Next.js에서 Client Component도 초기 HTML을 서버에서 렌더링한 뒤 hydrate 합니다.
  // 이때 서버/클라이언트의 __html 결과가 다르면 hydration mismatch가 발생할 수 있어,
  // SSR에서는 "텍스트"로 먼저 렌더링하고(동일 마크업 보장), 클라이언트 마운트 후에만
  // sanitize된 HTML로 교체합니다.
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const safe = React.useMemo(
    () => (mounted ? sanitizeHtml(html) : ""),
    [html, mounted],
  );

  if (!mounted) {
    return (
      <div className={className} suppressHydrationWarning>
        {stripHtml(html)}
      </div>
    );
  }

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: safe }} />
  );
}
