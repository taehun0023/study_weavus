// ✅ HTML 여부 대략 판정 유틸 (기존 로직 그대로 분리)
// - posts 페이지에서 사용하던 판정 로직
export function looksLikeHtmlPost(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

// - quiz 결과 페이지에서 사용하던 판정 로직 (any -> string)
export function looksLikeHtmlAny(s: any): boolean {
  const v = String(s ?? "");
  return /<\w[\s\S]*>/.test(v);
}
