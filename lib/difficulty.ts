// lib/difficulty.ts
export type Difficulty = "easy" | "medium" | "hard" | "project" | null;

export function normalizeDifficulty(
  d: Difficulty
): "easy" | "medium" | "project" | null {
  if (!d) return null;
  if (d === "hard") return "project"; // legacy
  return d;
}

export function difficultyLabel(
  d: Difficulty
): "easy" | "medium" | "project" | null {
  return normalizeDifficulty(d);
}

/**
 * 공용 색상 (border 색만 반환)
 */
export function difficultyBadgeClass(d: "easy" | "medium" | "project"): string {
  switch (d) {
    case "easy":
      return "bg-emerald-600/20 text-emerald-300 border-emerald-600/30";
    case "medium":
      return "bg-yellow-600/20 text-yellow-200 border-yellow-600/30";
    case "project":
      return "bg-violet-600/20 text-violet-200 border-violet-600/30";
    default:
      return "bg-muted text-foreground border-border";
  }
}

/**
 * ✅ posts-filter.tsx 호환용 (기존 이름 유지)
 * 버튼/셀렉트에서 쓰는 클래스
 */
export function difficultyButtonClass(d: Difficulty): string {
  const label = normalizeDifficulty(d);
  if (!label) return "border border-border text-muted-foreground";

  return `border ${difficultyBadgeClass(label)}`;
}
