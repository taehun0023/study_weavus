"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PerfectScoreChart, {
  type PerfectPoint,
} from "@/components/perfect-score-chart";

type ApiResp = { points: PerfectPoint[]; hasAnyPerfect: boolean };

export default function UserPerfectGraph() {
  const [data, setData] = useState<PerfectPoint[]>([]);
  const [show, setShow] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // ✅ boolean으로만 계산되게 고정
  const invalidRange = (!!from && !to) || (!from && !!to);

  async function fetchData(opts?: { resetRange?: boolean }) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const qFrom = opts?.resetRange ? "" : from;
      const qTo = opts?.resetRange ? "" : to;

      if (qFrom && qTo) {
        params.set("from", qFrom);
        params.set("to", qTo);
      }

      const res = await fetch(`/api/stats/perfect/me?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;

      const json = (await res.json()) as ApiResp;
      setData(json.points ?? []);
      setShow(Boolean(json.hasAnyPerfect));

      if (opts?.resetRange) {
        setFrom("");
        setTo("");
      }
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return null;
  if (!show) return null;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">만점 그래프</CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">From</span>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9 w-[160px]"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">To</span>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9 w-[160px]"
                />
              </div>
            </div>

            <Button
              variant="secondary"
              className="h-9"
              onClick={() => fetchData()}
              disabled={loading || invalidRange}
            >
              적용
            </Button>

            <Button
              variant="outline"
              className="h-9"
              onClick={() => fetchData({ resetRange: true })}
              disabled={loading}
            >
              최근 30일
            </Button>
          </div>
        </div>

        {invalidRange ? (
          <p className="text-sm text-red-500">
            From/To를 둘 다 선택해야 적용됩니다.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            기간을 선택하지 않으면 최근 30일(오늘 포함) 기준으로 표시됩니다.
          </p>
        )}
      </CardHeader>

      <CardContent>
        <PerfectScoreChart data={data} />
      </CardContent>
    </Card>
  );
}
