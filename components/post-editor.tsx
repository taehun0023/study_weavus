"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const NONE = "__none__";

import QuillEditor from "@/components/quill-editor";

export type Course = { id: number; name: string; slug: string };

// 기존 Difficulty 유지 (UI는 easy/medium/project만 씀)
export type Difficulty = "easy" | "medium" | "project";

// ✅ 새로 추가: 글 타입
export type PostType = "lesson" | "reference" | "quiz";

// ✅ 기존 payload 확장: type 포함 + lesson이면 세트 연결 id 포함
export type PostEditorPayload = {
  title: string;
  courseId: number;
  difficulty: Difficulty;
  type: PostType;
  content: string;
  referencePostId?: number | null;
  quizPostId?: number | null;
};

type OptionItem = { id: number; title: string };

export default function PostEditor({
  initial,
  courses,
}: {
  initial?: Partial<PostEditorPayload> & { id?: number };
  courses: Course[];
}) {
  const router = useRouter();

  const isEdit = Boolean(initial?.id);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [courseId, setCourseId] = useState<number>(
    initial?.courseId ?? courses?.[0]?.id ?? 1
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    (initial?.difficulty as Difficulty) ?? "easy"
  );
  const [type, setType] = useState<PostType>(
    (initial?.type as PostType) ?? "lesson"
  );
  const [content, setContent] = useState(initial?.content ?? "");

  const [saving, setSaving] = useState(false);

  // lesson일 때만 세트 연결(참조/퀴즈) 가능
  const [referencePostId, setReferencePostId] = useState<number | null>(
    typeof initial?.referencePostId === "number"
      ? initial!.referencePostId
      : null
  );
  const [quizPostId, setQuizPostId] = useState<number | null>(
    typeof initial?.quizPostId === "number" ? initial!.quizPostId : null
  );

  // 같은 과목의 reference/quiz 선택 옵션
  const [referenceOptions, setReferenceOptions] = useState<OptionItem[]>([]);
  const [quizOptions, setQuizOptions] = useState<OptionItem[]>([]);

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && content.trim().length > 0 && !saving;
  }, [title, content, saving]);

  useEffect(() => {
    // lesson이 아니면 연결 해제
    if (type !== "lesson") {
      setReferencePostId(null);
      setQuizPostId(null);
    }
  }, [type]);

  useEffect(() => {
    // courseId/type 변경 시 옵션 로드
    async function load() {
      try {
        const res = await fetch(`/api/posts/options?courseId=${courseId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        setReferenceOptions(json.referenceOptions ?? []);
        setQuizOptions(json.quizOptions ?? []);
      } catch {
        // ignore
      }
    }
    load();
  }, [courseId]);

  async function defaultCreate(payload: PostEditorPayload) {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("CREATE_FAILED");
    return res.json();
  }

  async function defaultUpdate(id: number, payload: PostEditorPayload) {
    const res = await fetch(`/api/posts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("UPDATE_FAILED");
    return res.json();
  }

  async function handleSave() {
    if (!canSubmit) return;

    setSaving(true);
    try {
      const payload: PostEditorPayload = {
        title: title.trim(),
        courseId,
        difficulty,
        type,
        content,
        referencePostId: type === "lesson" ? referencePostId : null,
        quizPostId: type === "lesson" ? quizPostId : null,
      };

      if (isEdit && initial?.id) {
        await defaultUpdate(initial.id, payload);
        router.replace(`/posts/${initial.id}`);
        router.refresh();
      } else {
        const created = await defaultCreate(payload);
        router.replace(`/posts/${created?.id ?? ""}`);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">제목</div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">과목</div>
              <div className="w-[180px]">
                <Select
                  value={String(courseId)}
                  onValueChange={(v) => setCourseId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">글 종류</div>
              <div className="w-[160px]">
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as PostType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lesson">수업</SelectItem>
                    <SelectItem value="reference">참조자료</SelectItem>
                    <SelectItem value="quiz">문제풀이</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {type === "lesson" && (
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">난이도</div>
                <div className="w-[140px]">
                  <Select
                    value={difficulty}
                    onValueChange={(v) => setDifficulty(v as Difficulty)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">easy</SelectItem>
                      <SelectItem value="medium">medium</SelectItem>
                      <SelectItem value="project">project</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ✅ lesson일 때만: 세트 연결 선택 */}
        {type === "lesson" && (
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">참조자료 연결</div>
              <div className="w-[280px]">
                <Select
                  value={referencePostId ? String(referencePostId) : NONE}
                  onValueChange={(v) =>
                    setReferencePostId(v === NONE ? null : Number(v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="선택 안 함" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>선택 안 함</SelectItem>
                    {referenceOptions.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">문제풀이 연결</div>
              <div className="w-[280px]">
                <Select
                  value={quizPostId ? String(quizPostId) : NONE}
                  onValueChange={(v) =>
                    setQuizPostId(v === NONE ? null : Number(v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="선택 안 함" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>선택 안 함</SelectItem>
                    {quizOptions.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              ※ 같은 과목의 reference/quiz 글을 선택해 이 수업과 1:1로 묶습니다.
            </div>
          </div>
        )}

        <QuillEditor value={content} onChange={setContent} />

        <Button className="w-full" onClick={handleSave} disabled={!canSubmit}>
          {saving ? "저장 중..." : "저장하기"}
        </Button>
      </CardContent>
    </Card>
  );
}
