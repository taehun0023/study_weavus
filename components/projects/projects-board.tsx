"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Course = { id: number; name: string; slug: string };
type Project = { id: number; name: string; slug: string };

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");
  if (!ct.includes("application/json")) {
    return { __raw: text, __status: res.status };
  }
  if (!text) return { __raw: "", __status: res.status };
  try {
    return JSON.parse(text);
  } catch {
    return { __raw: text, __status: res.status };
  }
}

export default function ProjectsBoard({
  courses,
  selectedCourse,
  initialProjectSlug,
  isAdmin,
}: {
  courses: Course[];
  selectedCourse: Course;
  initialProjectSlug: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const [newName, setNewName] = useState("");

  const selectedProjectSlug = useMemo(() => {
    const q = (sp.get("project") ?? initialProjectSlug ?? "").toLowerCase();
    return q;
  }, [sp, initialProjectSlug]);

  async function reloadList(courseId: number) {
    const r = await fetch(`/api/projects?courseId=${courseId}`, {
      cache: "no-store",
    });
    const data: any = await safeJson(r);

    if (!r.ok) {
      const msg =
        data?.message || data?.error || `프로젝트 로드 실패 (HTTP ${r.status})`;
      throw new Error(msg);
    }
    return (data?.items ?? []) as Project[];
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg("");
        const items = await reloadList(selectedCourse.id);
        if (!alive) return;
        setProjects(items);
      } catch (e) {
        if (!alive) return;
        setProjects([]);
        setErrorMsg(e instanceof Error ? e.message : "프로젝트 로드 실패");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedCourse.id]);

  const setCourse = (slug: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set("course", slug);
    next.delete("project");
    router.push(`/projects?${next.toString()}`);
  };

  const setProject = (slugOrAll: string) => {
    const next = new URLSearchParams(sp.toString());
    if (slugOrAll === "all") next.delete("project");
    else next.set("project", slugOrAll);
    router.push(`/projects?${next.toString()}`);
  };

  const filtered = useMemo(() => {
    if (!selectedProjectSlug) return projects;
    return projects.filter((p) => p.slug.toLowerCase() === selectedProjectSlug);
  }, [projects, selectedProjectSlug]);

  async function createProject() {
    const name = newName.trim();
    if (!name) {
      setErrorMsg("프로젝트 제목을 입력하세요.");
      return;
    }

    if (!isAdmin) {
      setErrorMsg("관리자만 프로젝트를 생성할 수 있습니다.");
      return;
    }

    const slug = slugify(name);

    try {
      setCreating(true);
      setErrorMsg("");

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          name,
          slug,
        }),
      });

      const data: any = await safeJson(res);

      if (!res.ok) {
        const msg =
          data?.message || data?.error || `생성 실패 (HTTP ${res.status})`;
        throw new Error(msg);
      }

      // ✅ 성공: 입력 초기화 + 목록 즉시 갱신 + 필터도 해당 프로젝트로 자동 선택(원하면)
      setNewName("");
      const items = await reloadList(selectedCourse.id);
      setProjects(items);

      // 생성한 프로젝트가 있으면 오른쪽 필터 자동 선택
      const created = items.find((p) => p.slug.toLowerCase() === slug);
      if (created) setProject(created.slug.toLowerCase());
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 상단 필터: 왼쪽 언어(과목) / 오른쪽 프로젝트명 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="w-[240px]">
          <Select value={selectedCourse.slug} onValueChange={setCourse}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c, idx) => (
                <SelectItem key={`${c.slug}-${c.id}-${idx}`} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border overflow-x-auto">
            <Button
              variant={!selectedProjectSlug ? "secondary" : "ghost"}
              className="rounded-none cursor-pointer whitespace-nowrap"
              onClick={() => setProject("all")}
              type="button"
            >
              전체
            </Button>

            {projects.map((p) => (
              <Button
                key={p.id}
                variant={
                  selectedProjectSlug === p.slug.toLowerCase()
                    ? "secondary"
                    : "ghost"
                }
                className="rounded-none cursor-pointer border-l border-border whitespace-nowrap"
                onClick={() => setProject(p.slug.toLowerCase())}
                type="button"
              >
                {p.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      {/* 관리자: 프로젝트 생성 */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="프로젝트 제목 (예: 영화 대여 관리 시스템)"
            className="h-9 w-[360px] rounded-md border border-border bg-background px-3 text-sm outline-none"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={createProject}
            disabled={creating}
            className="cursor-pointer"
            type="button"
          >
            {creating ? "생성 중..." : "프로젝트 생성"}
          </Button>
        </div>
      )}

      {/* 목록 */}
      <div className="grid gap-3">
        {loading && (
          <div className="text-sm text-muted-foreground">불러오는 중...</div>
        )}

        {!loading && filtered.length === 0 && !errorMsg && (
          <div className="text-sm text-muted-foreground">
            프로젝트가 없습니다.
          </div>
        )}

        {filtered.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-border bg-card p-4 flex items-center justify-between"
          >
            <div className="space-y-1 min-w-0">
              <div className="font-semibold truncate">{p.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {p.slug}
              </div>
            </div>

            <Button
              asChild
              variant="secondary"
              size="sm"
              className="cursor-pointer"
            >
              <Link href={`/projects/${p.id}`}>열기</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
