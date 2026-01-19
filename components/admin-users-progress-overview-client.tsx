"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

import UserCourseLessonStatus from "@/components/admin/user-detail/user-course-lesson-status";

type ProgressUserRow = {
  user_id: number;
  username: string;
  display_name: string | null;
  completed: number;
  last_raised_at: string | null;
};

type ProgressDetailRow = {
  username: string;
  display_name: string | null;
  post_id: number;
  title: string;
  first_at: string;
  course_slug: string;
};

type ApiResp = {
  course: string;
  range: { from: string; to: string };
  total: number;
  users: ProgressUserRow[];
  detail: ProgressDetailRow[];
  timelineByUser: Record<string, { day: string; cumulative: number }[]>;
};

function toISODateOnly(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseISODateOnly(s: string): Date | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const d = new Date(y, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function displayKoreanDate(iso: string) {
  const d = parseISODateOnly(iso);
  if (!d) return "연도. 월. 일.";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}. ${m}. ${dd}.`;
}

function DatePickerButton({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder: string;
}) {
  const selected = parseISODateOnly(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 w-[170px] justify-start rounded-xl border-white/10 bg-white/5 text-left font-normal",
            !value && "text-muted-foreground",
          )}
        >
          {value ? displayKoreanDate(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            onChange(toISODateOnly(d));
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function DateRangePicker({
  from,
  to,
  setFrom,
  setTo,
  onApply,
  onReset,
  loading,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  onApply: () => void;
  onReset: () => void;
  loading: boolean;
}) {
  const invalidRange = (!!from && !to) || (!from && !!to);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <DatePickerButton
          value={from}
          onChange={setFrom}
          placeholder="연도. 월. 일."
        />
        <span className="text-xs text-muted-foreground">~</span>
        <DatePickerButton
          value={to}
          onChange={setTo}
          placeholder="연도. 월. 일."
        />
      </div>

      <Button
        variant="secondary"
        className="h-9 rounded-xl"
        onClick={onApply}
        disabled={loading || invalidRange}
      >
        적용
      </Button>

      <Button
        variant="outline"
        className="h-9 rounded-xl"
        onClick={onReset}
        disabled={loading}
      >
        전체
      </Button>

      {invalidRange ? (
        <span className="text-xs text-red-500">
          From/To를 둘 다 선택해야 적용됩니다.
        </span>
      ) : null}
    </div>
  );
}

export default function AdminUsersProgressOverviewClient() {
  const [course, setCourse] = useState<"java" | "react">("java");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"completed" | "last">("completed");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ✅ 보기(상세) 상태
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);

  async function fetchData(opts?: { resetRange?: boolean }) {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("course", course);

      const qFrom = opts?.resetRange ? "" : from;
      const qTo = opts?.resetRange ? "" : to;

      if (qFrom && qTo) {
        params.set("from", qFrom);
        params.set("to", qTo);
      }

      const res = await fetch(`/api/admin/progress?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || "진척도 조회 실패");
      }

      const json = (await res.json()) as ApiResp;
      setData(json);

      if (opts?.resetRange) {
        setFrom("");
        setTo("");
      }

      setSelectedUsername(null);
    } catch (e: any) {
      setError(e?.message || "에러");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course]);

  const users = useMemo(() => {
    const list = data?.users ?? [];
    const q = query.trim().toLowerCase();

    const filtered = q
      ? list.filter((u) => {
          const dn = (u.display_name ?? "").toLowerCase();
          const un = (u.username ?? "").toLowerCase();
          return dn.includes(q) || un.includes(q);
        })
      : list;

    const sorted = [...filtered].sort((a, b) => {
      if (sort === "completed") {
        if (b.completed !== a.completed) return b.completed - a.completed;
        return a.username.localeCompare(b.username);
      }
      const al = a.last_raised_at ?? "";
      const bl = b.last_raised_at ?? "";
      if (bl !== al) return bl.localeCompare(al);
      return a.username.localeCompare(b.username);
    });

    return sorted;
  }, [data, query, sort]);

  const selectedUser = useMemo(() => {
    if (!selectedUsername) return null;
    return (
      (data?.users ?? []).find((u) => u.username === selectedUsername) ?? null
    );
  }, [data, selectedUsername]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-4 pb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">전체 유저 진척도</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              기본: 전체 유저 · 기간 지정 시: 기간 내 진척(최초 만점)이 있는
              유저만 표시
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={course === "java" ? "secondary" : "outline"}
              className="h-9 rounded-xl"
              onClick={() => setCourse("java")}
            >
              Java
            </Button>
            <Button
              variant={course === "react" ? "secondary" : "outline"}
              className="h-9 rounded-xl"
              onClick={() => setCourse("react")}
            >
              React
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <DateRangePicker
            from={from}
            to={to}
            setFrom={setFrom}
            setTo={setTo}
            loading={loading}
            onApply={() => fetchData()}
            onReset={() => fetchData({ resetRange: true })}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="유저 검색 (username / 표시이름)"
              className="h-9 w-[260px] rounded-xl bg-white/5"
            />

            <Button
              variant={sort === "completed" ? "secondary" : "outline"}
              className="h-9 rounded-xl"
              onClick={() => setSort("completed")}
            >
              완료순
            </Button>
            <Button
              variant={sort === "last" ? "secondary" : "outline"}
              className="h-9 rounded-xl"
              onClick={() => setSort("last")}
            >
              최근상승순
            </Button>

            <div className="ml-1 text-xs text-muted-foreground">
              총 퀴즈: {data?.total ?? 0} · 유저: {data?.users?.length ?? 0}
            </div>
          </div>
        </div>

        {error ? <div className="text-sm text-red-500">{error}</div> : null}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 리스트 */}
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-[1fr_120px_160px_90px] gap-2 bg-white/5 px-4 py-3 text-xs text-muted-foreground">
            <div>유저</div>
            <div className="text-center">완료/전체</div>
            <div className="text-center">진척도/마지막 상승</div>
            <div className="text-center">상세</div>
          </div>

          <div className="divide-y divide-white/10">
            {users.map((u) => {
              const total = data?.total ?? 0;
              const percent =
                total > 0 ? Math.round((u.completed / total) * 100) : 0;
              return (
                <div
                  key={u.user_id}
                  className="grid grid-cols-[1fr_120px_160px_90px] gap-2 px-4 py-4"
                >
                  <div>
                    <div className="font-medium">
                      {u.display_name ?? u.username}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {u.username}
                    </div>
                  </div>

                  <div className="flex items-center justify-center text-sm">
                    {u.completed}/{total}
                  </div>

                  <div className="flex flex-col items-center justify-center text-sm">
                    <div>{percent}%</div>
                    <div className="text-xs text-muted-foreground">
                      {u.last_raised_at ? u.last_raised_at : "-"}
                    </div>
                  </div>

                  <div className="flex items-center justify-center">
                    <Button
                      variant="secondary"
                      className="h-9 rounded-xl px-4"
                      onClick={() => setSelectedUsername(u.username)}
                    >
                      보기
                    </Button>
                  </div>
                </div>
              );
            })}

            {users.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                표시할 유저가 없습니다.
              </div>
            ) : null}
          </div>
        </div>

        {/* ✅ 상세 (교체됨) */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {!selectedUser ? (
            <div className="text-sm text-muted-foreground">
              유저를 선택하세요. 선택한 코스({course.toUpperCase()})의 모든
              수업에 대해 문제풀이 제출/합격 여부를 표시합니다.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">
                    {selectedUser.display_name ?? selectedUser.username}{" "}
                    <span className="text-muted-foreground">
                      ({selectedUser.username})
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {course.toUpperCase()} 수업 전체 ·
                    제출/점수/합격(만점)/불합격
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="h-9 rounded-xl"
                  onClick={() => setSelectedUsername(null)}
                >
                  닫기
                </Button>
              </div>

              <UserCourseLessonStatus
                userId={selectedUser.user_id}
                course={course}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
