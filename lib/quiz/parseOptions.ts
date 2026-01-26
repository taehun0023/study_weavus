// lib/quiz/parseOptions.ts
// ✅ options 파싱(배열/JSON 문자열/기타 형태 방어)
// (기존 로직 그대로 분리: UI/기능 영향 없음)
export function parseOptions(raw: any): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    } catch {
      // ignore
    }
  }
  return [];
}
