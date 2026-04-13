export type TextChunk = {
  index: number;
  content: string;
};

export function chunkText(
  text: string,
  opts?: { chunkSize?: number; overlap?: number },
): TextChunk[] {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunkSize = Math.max(400, Math.min(2000, opts?.chunkSize ?? 1000));
  const overlap = Math.max(0, Math.min(Math.floor(chunkSize / 2), opts?.overlap ?? 150));
  const step = Math.max(1, chunkSize - overlap);

  const chunks: TextChunk[] = [];
  let index = 0;
  for (let start = 0; start < normalized.length; start += step) {
    const end = Math.min(normalized.length, start + chunkSize);
    const piece = normalized.slice(start, end).trim();
    if (!piece) continue;
    chunks.push({ index, content: piece });
    index += 1;
    if (end >= normalized.length) break;
  }
  return chunks;
}
