import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ensureAssistantKnowledgeTable } from "@/lib/assistant-knowledge";
import {
  checkAssistantLearningLimits,
  getAssistantLimitSettings,
  recordAssistantLearningUsage,
} from "@/lib/assistant-limits";
import {
  ensureAssistantKnowledgeChunksTable,
  ensureAssistantKnowledgeDocMetadata,
  indexKnowledgeDoc,
} from "@/lib/assistant-knowledge-chunks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PDF_PARSE_MODEL = process.env.OPENAI_PDF_PARSE_MODEL || "gpt-4o-mini";
const OCR_PARSE_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o";

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function extractTextFromHtml(raw: string) {
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = decodeHtmlEntities(String(titleMatch?.[1] ?? "").trim());
  const noScriptStyle = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const noTags = noScriptStyle.replace(/<[^>]+>/g, " ");
  const text = decodeHtmlEntities(noTags).replace(/\s+/g, " ").trim();
  return { title, text };
}

function isGoogleSitesUrl(url: URL) {
  return url.hostname.toLowerCase().includes("sites.google.com");
}

function compactText(input: string) {
  return String(input ?? "").replace(/\r/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

function canonicalizeUrl(raw: string) {
  const u = new URL(raw);
  u.hash = "";
  u.searchParams.sort();
  return u.toString();
}

const GOOGLE_SITES_NOISE = [
  "Search this site",
  "Skip to main content",
  "Report abuse",
  "Google Sites",
  "Page updated",
  "Sign in",
  "URL Source:",
  "Markdown Content:",
];

function removeGoogleSitesNoise(input: string) {
  const lines = String(input ?? "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const lower = line.toLowerCase();
      if (GOOGLE_SITES_NOISE.some((noise) => lower.includes(noise.toLowerCase()))) {
        return false;
      }
      if (/^(home|menu|navigation|share|more)$/i.test(line)) return false;
      if (/^\[.+\]\(https?:\/\/[^\s)]+\)$/.test(line) && line.length < 80) return false;
      return true;
    });
  return compactText(lines.join("\n"));
}

function looksLikeNavigationOnly(input: string) {
  const lines = String(input ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return true;
  const linkLike = lines.filter((line) => /^(\[.+\]\(https?:\/\/|https?:\/\/)/i.test(line)).length;
  const shortLines = lines.filter((line) => line.length <= 18).length;
  const meaningful = lines.filter((line) => /[가-힣ぁ-んァ-ヶ一-龯]{2,}/.test(line)).length;
  return meaningful < 8 && (linkLike >= Math.ceil(lines.length * 0.45) || shortLines >= Math.ceil(lines.length * 0.7));
}

function withScheduleSection(text: string) {
  const source = String(text ?? "").trim();
  if (!source) return source;
  const lines = source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const events: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    let label = line;
    const jp = line.match(/(\d{1,2})月\s*(\d{1,2})日/);
    const kr = line.match(/(\d{1,2})월\s*(\d{1,2})일/);
    const slash = line.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    const iso = line.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);

    let mm = "";
    let dd = "";
    if (iso) {
      mm = String(iso[2]).padStart(2, "0");
      dd = String(iso[3]).padStart(2, "0");
      label = line.replace(iso[0], "").trim();
    } else if (jp) {
      mm = String(jp[1]).padStart(2, "0");
      dd = String(jp[2]).padStart(2, "0");
      label = line.replace(jp[0], "").trim();
    } else if (kr) {
      mm = String(kr[1]).padStart(2, "0");
      dd = String(kr[2]).padStart(2, "0");
      label = line.replace(kr[0], "").trim();
    } else if (slash) {
      mm = String(slash[1]).padStart(2, "0");
      dd = String(slash[2]).padStart(2, "0");
      label = line.replace(slash[0], "").trim();
    }

    if (!mm || !dd) continue;
    const row = `${mm}-${dd}: ${label || "일정"}`;
    if (!seen.has(row)) {
      seen.add(row);
      events.push(row);
    }
  }

  if (events.length === 0) return source;
  return `${source}\n\n[EVENTS]\n${events.join("\n")}`;
}

async function fetchGoogleSiteWithJina(targetUrl: string) {
  const normalized = targetUrl.startsWith("http://") || targetUrl.startsWith("https://")
    ? targetUrl
    : `https://${targetUrl}`;
  const jinaUrl = `https://r.jina.ai/${normalized}`;
  const res = await fetch(jinaUrl, {
    cache: "no-store",
    headers: {
      "User-Agent": "StudyPlatformBot/1.0 (+AI knowledge ingestion)",
      Accept: "text/plain,text/markdown;q=0.9,*/*;q=0.1",
    },
  });
  if (!res.ok) {
    throw new Error(`jina fetch failed status=${res.status}`);
  }
  const txt = removeGoogleSitesNoise(await res.text());
  if (txt.length < 1000) {
    throw new Error("본문 추출 실패");
  }
  if (looksLikeNavigationOnly(txt)) {
    throw new Error("본문 추출 실패");
  }
  return txt;
}

function extractUrlsFromText(input: string, baseUrl: URL, max = 50) {
  const out: string[] = [];
  const seen = new Set<string>();
  const mdLinkRe = /\[[^\]]*?\]\((https?:\/\/[^)\s]+)\)/gi;
  const plainRe = /https?:\/\/[^\s)<>"']+/gi;
  const pushUrl = (raw: string) => {
    try {
      const u = new URL(raw, baseUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") return;
      const key = u.toString();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    } catch {}
  };
  for (const m of String(input ?? "").matchAll(mdLinkRe)) {
    pushUrl(String(m[1] ?? ""));
    if (out.length >= max) return out;
  }
  for (const m of String(input ?? "").matchAll(plainRe)) {
    pushUrl(String(m[0] ?? ""));
    if (out.length >= max) return out;
  }
  return out;
}

function normalizeBasePath(pathname: string) {
  const p = pathname.replace(/\/+$/, "");
  return p || "/";
}

function isGoogleSitesInternalLink(candidate: URL, root: URL) {
  if (!candidate.hostname.toLowerCase().includes("sites.google.com")) return false;
  if (candidate.origin !== root.origin) return false;
  const rootPath = normalizeBasePath(root.pathname);
  const candidatePath = normalizeBasePath(candidate.pathname);
  if (candidatePath === rootPath) return true;
  return candidatePath.startsWith(`${rootPath}/`);
}

function inferGoogleDocTitle(url: string, text: string) {
  const firstHeading = String(text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("#"));
  if (firstHeading) return firstHeading.replace(/^#+\s*/, "").trim();
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split("/").filter(Boolean).at(-1) ?? "";
    const decoded = decodeURIComponent(segment).replace(/[-_]+/g, " ").trim();
    if (decoded) return decoded;
  } catch {}
  return url;
}

async function extractGoogleImageOcrFromText(pageText: string, sourceUrl: URL) {
  const urls = extractUrlsFromText(pageText, sourceUrl, 40).filter((u) => {
    try {
      const parsed = new URL(u);
      return (
        parsed.hostname.toLowerCase().includes("googleusercontent.com") &&
        (/\.(png|jpe?g|webp|gif)($|\?)/i.test(parsed.pathname) ||
          parsed.pathname.toLowerCase().includes("image"))
      );
    } catch {
      return false;
    }
  });
  if (urls.length === 0) return "";
  const chunks: string[] = [];
  for (const imageUrl of urls.slice(0, 8)) {
    try {
      const img = await downloadImageAsBuffer(imageUrl);
      if (!img) continue;
      const ocr = await extractStructuredVisionText(img.data, img.mime);
      const cleaned = compactText(ocr);
      if (!cleaned) continue;
      chunks.push(`- ${imageUrl}\n${cleaned}`);
    } catch (e: any) {
      await logIngestionEvent({
        level: "WARN",
        stage: "url.google_sites.image_ocr",
        sourceType: "url",
        sourceRef: imageUrl,
        message: String(e?.message ?? "google image OCR failed"),
      });
    }
  }
  if (chunks.length === 0) return "";
  return `\n\n[OCR_EXTRACTED_TEXT]\n${chunks.join("\n\n")}`;
}

async function crawlSubpages(startUrl: string, maxPages = 12) {
  const root = new URL(canonicalizeUrl(startUrl));
  const queue: string[] = [root.toString()];
  const visited = new Set<string>();
  const pages: Array<{ url: string; title: string; text: string; mime: string }> = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const current = String(queue.shift() ?? "").trim();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    let text = "";
    try {
      text = await fetchGoogleSiteWithJina(current);
    } catch (e: any) {
      await logIngestionEvent({
        level: current === root.toString() ? "ERROR" : "WARN",
        stage: "url.google_sites.jina_page",
        sourceType: "url",
        sourceRef: current,
        message: String(e?.message ?? "본문 추출 실패"),
      });
      if (current === root.toString()) throw new Error("본문 추출 실패");
      continue;
    }

    const sourceUrl = new URL(current);
    const ocrSuffix = await extractGoogleImageOcrFromText(text, sourceUrl);
    const merged = withScheduleSection(removeGoogleSitesNoise(`${text}${ocrSuffix}`));
    if (merged.length >= 500) {
      pages.push({
        url: current,
        title: inferGoogleDocTitle(current, text),
        text: merged,
        mime: "text/markdown",
      });
    } else {
      await logIngestionEvent({
        level: "WARN",
        stage: "url.google_sites.page_too_short",
        sourceType: "url",
        sourceRef: current,
        message: `length=${merged.length}`,
      });
    }

    const links = extractUrlsFromText(text, sourceUrl, 80);
    for (const link of links) {
      try {
        const parsed = new URL(link);
        if (!isGoogleSitesInternalLink(parsed, root)) continue;
        const canonical = canonicalizeUrl(parsed.toString());
        if (visited.has(canonical)) continue;
        if (!queue.includes(canonical)) queue.push(canonical);
      } catch {}
    }
  }

  return pages;
}

function extractPdfLinksFromText(input: string, baseUrl: URL, max = 6) {
  const links = new Set<string>();
  const re = /https?:\/\/[^\s)]+/gi;
  for (const m of String(input ?? "").matchAll(re)) {
    const raw = String(m[0] ?? "").trim();
    if (!raw) continue;
    try {
      const u = new URL(raw, baseUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      if (/\.pdf($|\?)/i.test(u.toString())) links.add(u.toString());
      if (links.size >= max) break;
    } catch {}
  }
  return Array.from(links);
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.user_role !== "ADMIN") return null;
  return user;
}

function isBlockedHost(hostname: string) {
  const h = hostname.trim().toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (h.startsWith("10.")) return true;
  if (h.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

function extractImageUrlsFromHtml(raw: string, baseUrl: URL, max = 3) {
  const urls: string[] = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(raw)) && urls.length < max) {
    const src = String(m[1] ?? "").trim();
    if (!src) continue;
    try {
      const u = new URL(src, baseUrl);
      if (u.protocol === "http:" || u.protocol === "https:") {
        urls.push(u.toString());
      }
    } catch {}
  }
  return Array.from(new Set(urls));
}

function extractAssetUrlsFromHtml(raw: string, baseUrl: URL, max = 8) {
  const urls: string[] = [];
  const patterns = [
    /<img[^>]+src=["']([^"']+)["']/gi,
    /<iframe[^>]+src=["']([^"']+)["']/gi,
    /<embed[^>]+src=["']([^"']+)["']/gi,
    /<object[^>]+data=["']([^"']+)["']/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null = null;
    while ((m = re.exec(raw)) && urls.length < max) {
      const src = String(m[1] ?? "").trim();
      if (!src) continue;
      try {
        const u = new URL(src, baseUrl);
        if (u.protocol === "http:" || u.protocol === "https:") {
          urls.push(u.toString());
        }
      } catch {}
    }
  }
  return Array.from(new Set(urls)).slice(0, max);
}

function extractChildLinksFromHtml(raw: string, baseUrl: URL, max = 6) {
  const urls: string[] = [];
  const re = /<a[^>]+href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(raw)) && urls.length < max) {
    const href = String(m[1] ?? "").trim();
    if (!href) continue;
    try {
      const u = new URL(href, baseUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      if (u.hostname !== baseUrl.hostname) continue;
      if (!u.pathname.startsWith("/view/")) continue;
      urls.push(u.toString());
    } catch {}
  }
  return Array.from(new Set(urls));
}

async function ensureIngestionLogTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS public.assistant_ingestion_logs (
      id BIGSERIAL PRIMARY KEY,
      level TEXT NOT NULL,
      stage TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function logIngestionEvent(args: {
  level: "INFO" | "WARN" | "ERROR";
  stage: string;
  sourceType: "url" | "upload";
  sourceRef: string;
  message: string;
}) {
  try {
    await ensureIngestionLogTable();
    await sql`
      INSERT INTO public.assistant_ingestion_logs
        (level, stage, source_type, source_ref, message)
      VALUES
        (${args.level}, ${args.stage}, ${args.sourceType}, ${args.sourceRef}, ${args.message})
    `;
  } catch {
    // Keep ingestion flow alive.
  }
}

async function downloadImageAsBuffer(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "StudyPlatformBot/1.0 (+AI knowledge ingestion)",
    },
  });
  if (!res.ok) return null;
  const mime = String(res.headers.get("content-type") ?? "").toLowerCase();
  if (!mime.startsWith("image/")) return null;
  const ab = await res.arrayBuffer().catch(() => null);
  if (!ab) return null;
  return { mime, data: Buffer.from(ab) };
}

async function downloadAssetAsBuffer(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "StudyPlatformBot/1.0 (+AI knowledge ingestion)",
    },
  });
  if (!res.ok) return null;
  const mime = String(res.headers.get("content-type") ?? "").toLowerCase();
  const ab = await res.arrayBuffer().catch(() => null);
  if (!ab) return null;
  return { mime, data: Buffer.from(ab) };
}

async function extractTextFromUrl(rawUrl: string) {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("유효한 URL을 입력해주세요.");
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("http/https URL만 지원됩니다.");
  }
  if (isBlockedHost(u.hostname)) {
    throw new Error("내부/로컬 주소는 URL 학습에서 허용되지 않습니다.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(u.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "StudyPlatformBot/1.0 (+AI knowledge ingestion)",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`URL 로드 실패 (status=${res.status})`);
    }

    const contentType = String(
      res.headers.get("content-type") ?? "",
    ).toLowerCase();

    // Direct image URL: run OCR on binary payload.
    if (contentType.startsWith("image/")) {
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);
      const ocr = withScheduleSection(
        compactText(await extractStructuredVisionText(buf, contentType)),
      );
      return { title: u.toString(), text: ocr, mime: contentType };
    }

    // Direct PDF URL: run PDF extraction on binary payload.
    if (contentType.includes("pdf")) {
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);
      const txt = withScheduleSection(compactText(await extractPdfWithOpenAI(buf)));
      return { title: u.toString(), text: txt, mime: "application/pdf" };
    }

    const raw = await res.text();
    if (!raw.trim()) {
      throw new Error("URL 본문이 비어 있습니다.");
    }

    if (contentType.includes("text/html") || raw.includes("<html")) {
      const { title, text } = extractTextFromHtml(raw);
      const chunks: string[] = [];
      if (text) chunks.push(text);

      const imageUrls = extractImageUrlsFromHtml(raw, u, 3);
      for (const imgUrl of imageUrls) {
        try {
          const img = await downloadImageAsBuffer(imgUrl);
          if (!img) continue;
          const ocr = await extractStructuredVisionText(img.data, img.mime);
          if (ocr.trim()) chunks.push(ocr.trim());
        } catch (e: any) {
          await logIngestionEvent({
            level: "WARN",
            stage: "url.html.img_ocr",
            sourceType: "url",
            sourceRef: imgUrl,
            message: String(e?.message ?? "image OCR failed"),
          });
        }
      }

      const assetUrls = extractAssetUrlsFromHtml(raw, u, 8);
      for (const assetUrl of assetUrls) {
        try {
          const asset = await downloadAssetAsBuffer(assetUrl);
          if (!asset) continue;
          if (asset.mime.includes("pdf")) {
            const txt = await extractPdfWithOpenAI(asset.data);
            if (txt.trim()) chunks.push(txt.trim());
            continue;
          }
          if (asset.mime.startsWith("image/")) {
            const txt = await extractStructuredVisionText(asset.data, asset.mime);
            if (txt.trim()) chunks.push(txt.trim());
            continue;
          }
          if (
            asset.mime.includes("text/html") ||
            asset.mime.includes("application/xhtml")
          ) {
            const html = asset.data.toString("utf8");
            const { text } = extractTextFromHtml(html);
            if (text.trim()) chunks.push(text.trim());
            continue;
          }
        } catch (e: any) {
          await logIngestionEvent({
            level: "WARN",
            stage: "url.html.asset_extract",
            sourceType: "url",
            sourceRef: assetUrl,
            message: String(e?.message ?? "asset extraction failed"),
          });
        }
      }

      const childLinks = extractChildLinksFromHtml(raw, u, 6);
      for (const childUrl of childLinks) {
        try {
          const childRes = await fetch(childUrl, {
            cache: "no-store",
            headers: {
              "User-Agent": "StudyPlatformBot/1.0 (+AI knowledge ingestion)",
            },
          });
          if (!childRes.ok) continue;
          const childRaw = await childRes.text();
          const childText = extractTextFromHtml(childRaw).text;
          if (childText) chunks.push(childText);
        } catch (e: any) {
          await logIngestionEvent({
            level: "WARN",
            stage: "url.child_link",
            sourceType: "url",
            sourceRef: childUrl,
            message: String(e?.message ?? "child page parse failed"),
          });
        }
      }

      // Always try rendered extraction for JS-heavy/embedded-image pages.
      const rendered = await extractTextFromUrlWithPlaywright(u.toString());
      if (rendered?.text) chunks.push(rendered.text);

      const merged = withScheduleSection(compactText(chunks.join("\n\n")));
      if (merged) {
        return { title, text: merged, mime: "text/html" };
      }
    }

    const plainText = withScheduleSection(compactText(raw));
    if (plainText) {
      return {
        title: "",
        text: plainText,
        mime: contentType || "text/plain",
      };
    }

    // Static fetch may fail on JS-heavy pages. Try browser-rendered extraction.
    const rendered = await extractTextFromUrlWithPlaywright(u.toString());
    if (rendered) return rendered;
    throw new Error("URL 본문을 추출하지 못했습니다.");
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("URL 요청 시간이 초과되었습니다.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

async function extractTextFromUrlWithPlaywright(url: string) {
  try {
    const mod = await import("node:module");
    const req = mod.createRequire(import.meta.url);
    const playwright = req("playwright");
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForTimeout(1_000);
      const title = (await page.title().catch(() => "")) || "";
      const domText = await page
        .evaluate(() => {
          const doc = document;
          doc
            .querySelectorAll("script,style,noscript")
            .forEach((el) => el.remove());
          return (doc.body?.innerText || "").trim();
        })
        .catch(() => "");
      const chunks: string[] = [];
      if (domText) chunks.push(domText);

      // Vision OCR on full rendered page screenshot (generic for all sites).
      const shot = await page.screenshot({ fullPage: true }).catch(() => null);
      if (shot) {
        try {
          const ocr = await extractStructuredVisionText(
            Buffer.isBuffer(shot) ? shot : Buffer.from(shot),
            "image/png",
          );
          if (ocr.trim()) chunks.push(ocr.trim());
        } catch (e: any) {
          await logIngestionEvent({
            level: "WARN",
            stage: "url.playwright.screenshot_ocr",
            sourceType: "url",
            sourceRef: url,
            message: String(e?.message ?? "screenshot structured extraction failed"),
          });
        }
      }

      const text = compactText(chunks.join("\n\n"));
      if (!text) return null;
      return {
        title: title.trim(),
        text: withScheduleSection(compactText(text)),
        mime: "text/html",
      };
    } finally {
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  } catch {
    return null;
  }
}

function parseResponseText(payload: any): string {
  const direct = String(payload?.output_text ?? "").trim();
  if (direct) return direct;

  const out = Array.isArray(payload?.output) ? payload.output : [];
  const parts: string[] = [];
  for (const item of out) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      const t = String(c?.text ?? c?.output_text ?? "").trim();
      if (t) parts.push(t);
    }
  }
  return parts.join("\n").trim();
}

async function loadOptionalModule<T = unknown>(name: string): Promise<T> {
  try {
    // Keep module resolution runtime-only so missing optional deps don't break boot.
    const importer = new Function("n", "return import(n);") as (
      n: string,
    ) => Promise<T>;
    return await importer(name);
  } catch {
    throw new Error(
      `${name} 모듈을 찾을 수 없습니다. 서버에서 \`npm install ${name}\` 후 다시 시도해주세요.`,
    );
  }
}

async function extractPdfWithOpenAI(data: Buffer) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY가 없어 PDF OCR/레이아웃 분석을 실행할 수 없습니다.",
    );
  }

  const base64 = data.toString("base64");
  const dataUrl = `data:application/pdf;base64,${base64}`;
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OCR_PARSE_MODEL,
      temperature: 0,
      max_output_tokens: 4000,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "PDF의 레이아웃을 고려해 텍스트를 정확히 추출하라.",
                "표/조직도는 팀 단위와 구성원 관계가 섞이지 않게 줄바꿈으로 정리한다.",
                "출력은 순수 텍스트만 반환하고 설명은 붙이지 않는다.",
              ].join("\n"),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: "document.pdf",
              file_data: dataUrl,
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`PDF OCR 실패(status=${resp.status}): ${err || "unknown"}`);
  }

  const payload = await resp.json().catch(() => ({}));
  const text = parseResponseText(payload);
  if (!text) {
    throw new Error("PDF OCR 결과가 비어 있습니다.");
  }
  return text;
}

async function extractImageWithOpenAI(data: Buffer, mime: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 없어 이미지 OCR을 실행할 수 없습니다.");
  }
  const base64 = data.toString("base64");
  const dataUrl = `data:${mime || "image/png"};base64,${base64}`;

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: PDF_PARSE_MODEL,
      temperature: 0,
      max_output_tokens: 2500,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "이미지에서 보이는 텍스트만 추출하라.",
                "추측/보정 금지.",
                "날짜와 숫자는 원문 그대로 유지.",
                "불명확하면 (判読不能)로 표시.",
              ].join("\n"),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: {
                url: dataUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(
      `이미지 OCR 실패(status=${resp.status}): ${err || "unknown"}`,
    );
  }

  const payload = await resp.json().catch(() => ({}));
  const text = parseResponseText(payload);
  if (!text) throw new Error("이미지 OCR 결과가 비어 있습니다.");
  return text;
}

async function extractStructuredVisionText(data: Buffer, mime: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 없어 이미지 구조 추출을 실행할 수 없습니다.");
  }
  const base64 = data.toString("base64");
  const dataUrl = `data:${mime || "image/png"};base64,${base64}`;

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OCR_PARSE_MODEL,
      temperature: 0,
      max_output_tokens: 3500,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "이미지 내용을 검색 가능한 텍스트로 구조화해 추출하라.",
                "반드시 아래 섹션 형식으로 출력:",
                "[VISIBLE_TEXT]",
                "[LEGEND]",
                "[CALENDAR_EVENTS]",
                "규칙:",
                "- 화면 텍스트를 최대한 보존",
                "- 숫자/날짜/고유명사는 절대 보정하지 말고 원문을 그대로 복사",
                "- 13을 14로 바꾸는 등 숫자 변경 금지",
                "- 추측 금지: 읽기 불확실한 문자는 (判読不能)로 표시",
                "- 달력/표가 보이면 월/날짜 기준으로 라인화",
                "- 범례(색상 의미)가 보이면 색상과 라벨을 적고,",
                "  날짜 셀이 색으로 표시된 경우 `YYYY-MM-DD: 라벨(색상)` 형식으로 적는다.",
                "- 연/월이 안 보이면 `MM-DD: 라벨(색상)` 형식으로 적고, 보이는 숫자는 그대로 유지",
                "- 행사명이 없으면 `MM-DD: 회사지정휴일(녹색)`처럼 확인 가능한 범주만 적는다.",
                "- 출력은 불필요한 설명 없이 항목 리스트 위주로 간결하게 작성",
              ].join("\n"),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: {
                url: dataUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`이미지 구조 추출 실패(status=${resp.status}): ${err || "unknown"}`);
  }
  const payload = await resp.json().catch(() => ({}));
  const text = parseResponseText(payload);
  if (!text) throw new Error("이미지 구조 추출 결과가 비어 있습니다.");
  return text;
}

function estimatePdfPagesHeuristic(data: Buffer) {
  const raw = data.toString("latin1");
  const matches = raw.match(/\/Type\s*\/Page\b/g);
  const n = matches?.length ?? 1;
  return Math.max(1, Math.min(300, n));
}

async function extractPdfWithLocalParser(data: Buffer) {
  const mod = await loadOptionalModule<{ default?: (buf: Buffer) => Promise<{ text?: string }> }>(
    "pdf-parse",
  );
  const parser = (mod.default ?? mod) as (buf: Buffer) => Promise<{ text?: string }>;
  const parsed = await parser(data);
  return String(parsed?.text ?? "").trim();
}

async function extractTextFromUpload(mime: string, data: Buffer) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("pdf")) {
    const chunks: string[] = [];
    try {
      const local = await extractPdfWithLocalParser(data);
      if (local) chunks.push(local);
    } catch (e: any) {
      await logIngestionEvent({
        level: "WARN",
        stage: "upload.pdf.local_parse",
        sourceType: "upload",
        sourceRef: "upload",
        message: String(e?.message ?? "pdf-parse failed"),
      });
    }
    try {
      const vision = await extractPdfWithOpenAI(data);
      if (vision) chunks.push(vision);
    } catch (e: any) {
      await logIngestionEvent({
        level: "WARN",
        stage: "upload.pdf.vision_parse",
        sourceType: "upload",
        sourceRef: "upload",
        message: String(e?.message ?? "vision pdf parse failed"),
      });
    }
    const merged = chunks.join("\n\n").trim();
    if (!merged) throw new Error("PDF에서 텍스트를 추출하지 못했습니다.");
    return merged;
  }
  if (m.startsWith("image/")) {
    return extractStructuredVisionText(data, m);
  }
  if (
    m.startsWith("text/") ||
    m.includes("json") ||
    m.includes("csv") ||
    m.includes("xml")
  ) {
    return data.toString("utf8");
  }

  if (
    m.includes("sheet") ||
    m.includes("excel") ||
    m.includes("spreadsheetml")
  ) {
    const xlsxModule = await loadOptionalModule<{
      default?: unknown;
      read: (
        buffer: Buffer,
        opts: { type: "buffer" },
      ) => {
        SheetNames: string[];
        Sheets: Record<string, unknown>;
      };
      utils: {
        sheet_to_csv: (sheet: unknown, opts: { FS: string }) => string;
      };
    }>("xlsx");
    const xlsx = (xlsxModule.default ?? xlsxModule) as {
      read: (
        buffer: Buffer,
        opts: { type: "buffer" },
      ) => {
        SheetNames: string[];
        Sheets: Record<string, unknown>;
      };
      utils: {
        sheet_to_csv: (sheet: unknown, opts: { FS: string }) => string;
      };
    };
    const wb = xlsx.read(data, { type: "buffer" });
    const chunks: string[] = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      if (!ws) continue;
      const csv = xlsx.utils.sheet_to_csv(ws, { FS: "\t" }).trim();
      if (csv) chunks.push(`SHEET: ${name}\n${csv}`);
    }
    const out = chunks.join("\n\n").trim();
    if (!out) {
      throw new Error("XLSX에서 텍스트를 추출하지 못했습니다.");
    }
    return out;
  }

  if (
    m.includes("wordprocessingml") ||
    m.includes("msword") ||
    m.includes("officedocument.wordprocessingml.document")
  ) {
    const mammothModule = await loadOptionalModule<{
      default?: unknown;
      extractRawText: (args: { buffer: Buffer }) => Promise<{ value?: string }>;
    }>("mammoth");
    const mammoth = (mammothModule.default ?? mammothModule) as {
      extractRawText: (args: { buffer: Buffer }) => Promise<{ value?: string }>;
    };
    const result = await mammoth.extractRawText({ buffer: data });
    const text = String(result?.value ?? "").trim();
    if (!text) {
      throw new Error("DOCX에서 텍스트를 추출하지 못했습니다.");
    }
    return text;
  }
  throw new Error("지원하지 않는 파일 형식입니다.");
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureAssistantKnowledgeTable();
    const rows = await sql<{
      id: number;
      title: string;
      source_type: string;
      source_id: number | null;
      mime: string | null;
      is_active: boolean;
      updated_at: string;
    }>`
      SELECT id, title, source_type, source_id, mime, is_active, updated_at
      FROM public.assistant_knowledge_docs
      ORDER BY id DESC
      LIMIT 200
    `;
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to load knowledge docs" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getAssistantLimitSettings();
    if (!settings.learning_enabled) {
      return NextResponse.json(
        {
          message:
            "학습 모드가 비활성화되어 있어 새 학습 등록이 차단되었습니다.",
        },
        { status: 409 },
      );
    }
    await ensureAssistantKnowledgeTable();
    await ensureAssistantKnowledgeDocMetadata();
    await ensureAssistantKnowledgeChunksTable();
    const body = await req.json().catch(() => ({}));

    const rawUrl = String(body?.url ?? "").trim();
    if (rawUrl) {
      const gate = await checkAssistantLearningLimits({
        userId: user.id,
        projectedOcrPages: 1,
      });
      if (!gate.ok) {
        return NextResponse.json({ message: gate.message }, { status: 429 });
      }

      const isActive = body?.isActive !== false;
      const inputUrl = new URL(rawUrl);
      const canonicalInputUrl = canonicalizeUrl(inputUrl.toString());
      const insertedIds: number[] = [];

      if (isGoogleSitesUrl(inputUrl)) {
        const pages = await crawlSubpages(rawUrl, 12);
        if (pages.length === 0) {
          return NextResponse.json({ message: "본문 추출 실패" }, { status: 422 });
        }
        for (const page of pages) {
          const extractedText = compactText(page.text);
          if (extractedText.length < 500) continue;
          const canonicalPageUrl = canonicalizeUrl(page.url);
          const metadata = {
            sourceType: "url",
            sourceRef: canonicalPageUrl,
            parentUrl: canonicalInputUrl,
            mime: page.mime,
            extractedAt: new Date().toISOString(),
          };
          const existing = await sql<{ id: number }>`
            SELECT id
            FROM public.assistant_knowledge_docs
            WHERE source_type = 'url'
              AND COALESCE(metadata->>'sourceRef', '') = ${canonicalPageUrl}
            ORDER BY id DESC
            LIMIT 1
          `;
          let docId = Number(existing[0]?.id ?? 0);
          if (docId > 0) {
            await sql`
              UPDATE public.assistant_knowledge_docs
              SET title = ${page.title || page.url},
                  content = ${extractedText},
                  mime = ${page.mime},
                  is_active = ${isActive},
                  metadata = ${JSON.stringify(metadata)}::jsonb,
                  updated_at = NOW()
              WHERE id = ${docId}
            `;
          } else {
            const rows = await sql<{ id: number }>`
              INSERT INTO public.assistant_knowledge_docs
                (title, content, source_type, source_id, mime, is_active, metadata)
              VALUES
                (
                  ${page.title || page.url},
                  ${extractedText},
                  'url',
                  NULL,
                  ${page.mime},
                  ${isActive},
                  ${JSON.stringify(metadata)}::jsonb
                )
            RETURNING id
            `;
            docId = rows[0].id;
          }
          insertedIds.push(docId);
          await indexKnowledgeDoc({
            docId,
            title: page.title || page.url,
            content: extractedText,
            metadata,
          });
        }
        if (insertedIds.length === 0) {
          return NextResponse.json({ message: "본문 추출 실패" }, { status: 422 });
        }
      } else {
        const extracted = await extractTextFromUrl(rawUrl);
        const extractedText = compactText(extracted.text);
        if (extractedText.length < 500) {
          await logIngestionEvent({
            level: "ERROR",
            stage: "url.ingested_too_short",
            sourceType: "url",
            sourceRef: rawUrl,
            message: `content length too short: ${extractedText.length}`,
          });
          return NextResponse.json({ message: "본문 추출 실패" }, { status: 422 });
        }
        const title =
          String(body?.title ?? "").trim() || extracted.title || rawUrl;
        const canonicalRef = canonicalizeUrl(rawUrl);
        const metadata = {
          sourceType: "url",
          sourceRef: canonicalRef,
          mime: extracted.mime,
          extractedAt: new Date().toISOString(),
        };
        const existing = await sql<{ id: number }>`
          SELECT id
          FROM public.assistant_knowledge_docs
          WHERE source_type = 'url'
            AND COALESCE(metadata->>'sourceRef', '') = ${canonicalRef}
          ORDER BY id DESC
          LIMIT 1
        `;
        let docId = Number(existing[0]?.id ?? 0);
        if (docId > 0) {
          await sql`
            UPDATE public.assistant_knowledge_docs
            SET title = ${title},
                content = ${extractedText},
                mime = ${extracted.mime},
                is_active = ${isActive},
                metadata = ${JSON.stringify(metadata)}::jsonb,
                updated_at = NOW()
            WHERE id = ${docId}
          `;
        } else {
          const rows = await sql<{ id: number }>`
            INSERT INTO public.assistant_knowledge_docs
              (title, content, source_type, source_id, mime, is_active, metadata)
            VALUES
              (
                ${title},
                ${extractedText},
                'url',
                NULL,
                ${extracted.mime},
                ${isActive},
                ${JSON.stringify(metadata)}::jsonb
              )
          RETURNING id
          `;
          docId = rows[0].id;
        }
        insertedIds.push(docId);
        await indexKnowledgeDoc({
          docId,
          title,
          content: extractedText,
          metadata,
        });
      }
      await recordAssistantLearningUsage({
        userId: user.id,
        sourceType: "url",
        ocrPages: 1,
      });
      await logIngestionEvent({
        level: "INFO",
        stage: "url.ingested",
        sourceType: "url",
        sourceRef: rawUrl,
        message: `doc_ids=${insertedIds.join(",")}`,
      });
      return NextResponse.json({ ok: true, id: insertedIds[0], ids: insertedIds });
    }

    const uploadId = Number(body?.uploadId ?? NaN);
    if (!Number.isFinite(uploadId) || uploadId <= 0) {
      return NextResponse.json(
        { message: "uploadId required" },
        { status: 400 },
      );
    }

    const upRows = await sql<{
      id: number;
      filename: string;
      mime: string;
      data: Buffer;
    }>`
      SELECT id, filename, mime, data
      FROM public.uploads
      WHERE id = ${uploadId}
      LIMIT 1
    `;
    const upload = upRows[0];
    if (!upload) {
      return NextResponse.json(
        { message: "Upload not found" },
        { status: 404 },
      );
    }

    const mime = String(upload.mime ?? "").toLowerCase();
    const projectedOcrPages = mime.includes("pdf")
      ? estimatePdfPagesHeuristic(upload.data)
      : mime.startsWith("image/")
        ? 1
        : 0;
    const gate = await checkAssistantLearningLimits({
      userId: user.id,
      projectedOcrPages,
    });
    if (!gate.ok) {
      return NextResponse.json({ message: gate.message }, { status: 429 });
    }

    const content = await extractTextFromUpload(upload.mime, upload.data);
    const title = String(body?.title ?? "").trim() || upload.filename;
    const isActive = body?.isActive !== false;
    const metadata = {
      sourceType: "upload",
      uploadId: upload.id,
      filename: upload.filename,
      mime: upload.mime,
      extractedAt: new Date().toISOString(),
    };

    const rows = await sql<{ id: number }>`
      INSERT INTO public.assistant_knowledge_docs
        (title, content, source_type, source_id, mime, is_active, metadata)
      VALUES
        (
          ${title},
          ${content},
          'upload',
          ${upload.id},
          ${upload.mime},
          ${isActive},
          ${JSON.stringify(metadata)}::jsonb
        )
      RETURNING id
    `;
    await indexKnowledgeDoc({
      docId: rows[0].id,
      title,
      content,
      metadata,
    });

    await recordAssistantLearningUsage({
      userId: user.id,
      sourceType: "upload",
      ocrPages: projectedOcrPages,
    });
    await logIngestionEvent({
      level: "INFO",
      stage: "upload.ingested",
      sourceType: "upload",
      sourceRef: String(upload.id),
      message: `doc_id=${rows[0].id}`,
    });

    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (e: any) {
    await logIngestionEvent({
      level: "ERROR",
      stage: "ingestion.failed",
      sourceType: "upload",
      sourceRef: "unknown",
      message: String(e?.message ?? "Failed to ingest upload"),
    });
    return NextResponse.json(
      { message: e?.message ?? "Failed to ingest upload" },
      { status: 500 },
    );
  }
}
