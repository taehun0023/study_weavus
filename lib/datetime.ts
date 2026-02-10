// lib/datetime.ts
export function formatDateTime(
  value: string | number | Date | null | undefined,
): string {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export function formatDateOnly(
  value: string | number | Date | null | undefined,
): string {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}
