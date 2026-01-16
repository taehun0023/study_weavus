"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { difficultyButtonClass } from "@/lib/difficulty";

type Course = { id: number; name: string; slug: string };

export function PostsFilter({
  courses,
  selectedCourseSlug,
  selectedDifficulty,
}: {
  courses: Course[];
  selectedCourseSlug: string;
  selectedDifficulty: string; // all|easy|medium|project
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const setCourse = (slug: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set("course", slug);
    next.delete("difficulty"); // 과목 바꾸면 난이도는 all로
    router.push(`/posts?${next.toString()}`);
  };

  const setDifficulty = (diff: string) => {
    const next = new URLSearchParams(sp.toString());
    if (diff === "all") next.delete("difficulty");
    else next.set("difficulty", diff);
    router.push(`/posts?${next.toString()}`);
  };

  const isAll = selectedDifficulty === "all";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="w-[240px]">
        <Select value={selectedCourseSlug} onValueChange={setCourse}>
          <SelectTrigger>
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
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <Button
            variant={isAll ? "secondary" : "ghost"}
            className="rounded-none"
            onClick={() => setDifficulty("all")}
          >
            전체
          </Button>

          <Button
            variant="ghost"
            className={`rounded-none border-l border-border ${
              selectedDifficulty === "easy"
                ? `border ${difficultyButtonClass("easy")}`
                : ""
            }`}
            onClick={() => setDifficulty("easy")}
          >
            easy
          </Button>

          <Button
            variant="ghost"
            className={`rounded-none border-l border-border ${
              selectedDifficulty === "medium"
                ? `border ${difficultyButtonClass("medium")}`
                : ""
            }`}
            onClick={() => setDifficulty("medium")}
          >
            medium
          </Button>

          <Button
            variant="ghost"
            className={`rounded-none border-l border-border ${
              selectedDifficulty === "project"
                ? `border ${difficultyButtonClass("project")}`
                : ""
            }`}
            onClick={() => setDifficulty("project")}
          >
            project
          </Button>
        </div>
      </div>
    </div>
  );
}
