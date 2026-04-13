import { chromium } from "playwright";
import type { ExtractImagesResult } from "@/types/chatbot";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function normalizeUrl(url: string, base: string) {
  try {
    return new URL(url, base).toString();
  } catch {
    return "";
  }
}

export async function extractImagesFromPage(url: string): Promise<ExtractImagesResult> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: USER_AGENT });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });

    const imgSrcs = await page.$$eval("img[src]", (elements: Element[]) =>
      elements
        .map((el: Element) => el.getAttribute("src") ?? "")
        .filter((src: string) => src.length > 0),
    );

    const ogImage = await page
      .$eval('meta[property="og:image"]', (el: Element) => el.getAttribute("content") ?? "")
      .catch(() => "");

    const bgImages = await page.evaluate(() => {
      const urls = new Set<string>();
      const allElements = Array.from(document.querySelectorAll("*"));
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        const value = style.getPropertyValue("background-image");
        if (!value || value === "none") continue;

        const matches = value.matchAll(/url\(["']?(.*?)["']?\)/g);
        for (const match of matches) {
          const maybeUrl = String(match[1] ?? "").trim();
          if (maybeUrl) {
            urls.add(maybeUrl);
          }
        }
      }
      return Array.from(urls);
    });

    const screenshot = await page.screenshot({ fullPage: true, type: "png" });
    const screenshotBase64 = Buffer.from(screenshot).toString("base64");

    const allUrls = new Set<string>();
    for (const src of imgSrcs) {
      const normalized = normalizeUrl(src, page.url());
      if (normalized) allUrls.add(normalized);
    }

    if (ogImage) {
      const normalized = normalizeUrl(ogImage, page.url());
      if (normalized) allUrls.add(normalized);
    }

    for (const src of bgImages) {
      const normalized = normalizeUrl(src, page.url());
      if (normalized) allUrls.add(normalized);
    }

    return {
      imageUrls: Array.from(allUrls),
      screenshotBase64,
    };
  } finally {
    await page.close();
    await browser.close();
  }
}
