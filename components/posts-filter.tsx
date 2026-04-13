"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type Course = { id: number; name: string; slug: string };

const DIFFICULTIES = [
  { key: "all", label: "전체", cls: "" },
  { key: "easy",    label: "easy",    cls: "diff-easy" },
  { key: "medium",  label: "medium",  cls: "diff-medium" },
  { key: "project", label: "project", cls: "diff-project" },
] as const;

export function PostsFilter({
  courses,
  selectedCourseSlug,
  selectedDifficulty,
}: {
  courses: Course[];
  selectedCourseSlug: string;
  selectedDifficulty: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const setCourse = (slug: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set("course", slug);
    next.delete("difficulty");
    router.push(`/posts?${next.toString()}`);
  };

  const setDifficulty = (diff: string) => {
    const next = new URLSearchParams(sp.toString());
    if (diff === "all") next.delete("difficulty");
    else next.set("difficulty", diff);
    router.push(`/posts?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Course selector */}
      <Select value={selectedCourseSlug} onValueChange={setCourse}>
        <SelectTrigger className="w-[200px] h-8 text-sm">
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

      {/* Difficulty filter — pill segmented control */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/40 border border-border/60">
        {DIFFICULTIES.map(({ key, label, cls }) => {
          const isActive = selectedDifficulty === key;
          return (
            <button
              key={key}
              onClick={() => setDifficulty(key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? key === "all"
                    ? "bg-card shadow-sm text-foreground border border-border/60"
                    : `${cls} shadow-sm`
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
