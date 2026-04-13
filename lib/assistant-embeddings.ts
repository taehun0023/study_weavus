const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

export const EMBEDDING_DIM = Number(process.env.OPENAI_EMBEDDING_DIM || 1536);

function getApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return key;
}

export async function createEmbedding(input: string): Promise<number[]> {
  const text = String(input ?? "").trim();
  if (!text) return [];

  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`EMBEDDING_ERROR status=${resp.status} body=${body}`);
  }

  const payload = (await resp.json().catch(() => ({}))) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const vector = payload?.data?.[0]?.embedding ?? [];
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("EMBEDDING_EMPTY");
  }
  return vector;
}

export function toVectorLiteral(values: number[]) {
  if (!Array.isArray(values) || values.length === 0) return "[]";
  const cleaned = values.map((v) => (Number.isFinite(v) ? Number(v) : 0));
  return `[${cleaned.join(",")}]`;
}
