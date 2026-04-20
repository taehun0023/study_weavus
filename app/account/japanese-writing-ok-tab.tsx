"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type OkItem = {
  level: "N1" | "N2" | "N3" | "N4" | "N5";
  promptId: string;
  promptKo: string;
  correctedText: string;
  firstOkAt: string;
};

async function safeJson<T>(res: Response): Promise<T | null> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function JapaneseWritingOkTab() {
  const [items, setItems] = useState<OkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/japanese-writing/ok-list", {
          method: "GET",
          cache: "no-store",
        });
        const data = await safeJson<{ items: OkItem[]; message?: string }>(res);
        if (!mounted) return;
        if (!res.ok) {
          setError(data?.message || "목록을 불러오지 못했습니다.");
          setItems([]);
          return;
        }
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!mounted) return;
        setError("목록을 불러오지 못했습니다.");
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">일본어작문 (OK 문장)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">불러오는 중...</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!loading && !error && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 OK 받은 문장이 없습니다.</p>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={`${item.level}-${item.promptId}-${item.firstOkAt}`}
                className="rounded-lg border border-border/60 bg-card/70 p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{item.level}</Badge>
                  <span className="text-xs text-muted-foreground">{item.firstOkAt}</span>
                </div>
                <div className="text-sm">
                  <p className="text-xs text-muted-foreground">한국어 원문</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{item.promptKo}</p>
                </div>
                <div className="text-sm">
                  <p className="text-xs text-muted-foreground">정답 일본어</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{item.correctedText}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

