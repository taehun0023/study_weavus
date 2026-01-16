"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuillEditor from "@/components/quill-editor";

type Course = { id: number; name: string; slug: string };
type Difficulty = "easy" | "medium" | "project";
type QuestionType = "multiple_choice" | "short_answer";

type Q = {
  key: string;
  questionText: string;
  questionType: QuestionType;
  options: string[]; // 객관식 선택지
  correctAnswer: string; // 객관식: 선택지 텍스트 / 주관식: 정답 텍스트
};

type UploadedFile = {
  id: number;
  name: string;
  url: string;
  size?: number;
  contentType?: string;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function hasMeaningfulRichText(html: string) {
  if (!html) return false;
  if (/<img\b/i.test(html)) return true;

  const text = html
    .replace(/&nbsp;/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 0;
}

function AttachmentBox({
  title,
  uploads,
  uploading,
  onPick,
  onInsertLinks,
  onRemove,
  inputRef,
}: {
  title: string;
  uploads: UploadedFile[];
  uploading: boolean;
  onPick: (files: FileList | null) => void;
  onInsertLinks: () => void;
  onRemove: (id: number) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/30 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{title} 첨부파일</div>
          <div className="text-xs text-muted-foreground">
            zip/pdf/image 등 업로드 가능 (여러개 가능)
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".zip,.tar,.gz,.tgz,.7z,.rar,.pdf,.txt,.md,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.mp3,.mp4,*/*"
            onChange={(e) => onPick(e.target.files)}
            className="hidden"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "업로드 중..." : "파일 선택"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onInsertLinks}
            disabled={uploads.length === 0}
          >
            이 탭 내용에 링크 삽입
          </Button>
        </div>
      </div>

      {uploads.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          업로드된 파일이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {uploads.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm">{u.name}</div>
                <div className="text-xs text-muted-foreground">{u.url}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(u.url)}
                >
                  링크복사
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => onRemove(u.id)}
                >
                  제거
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LessonSetEditor({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const safeCourses = Array.isArray(courses) ? courses : [];
  const [courseId, setCourseId] = useState<number>(safeCourses[0]?.id ?? 0);

  // lesson
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDifficulty, setLessonDifficulty] = useState<Difficulty>("easy");
  const [lessonContent, setLessonContent] = useState("");

  // reference
  const [refTitle, setRefTitle] = useState("");
  const [refContent, setRefContent] = useState("");

  // quiz
  const [quizTitle, setQuizTitle] = useState("");
  const [quizContent, setQuizContent] = useState("");
  const [questions, setQuestions] = useState<Q[]>([]);

  // 탭별 업로드
  const lessonFileRef = useRef<HTMLInputElement | null>(null);
  const refFileRef = useRef<HTMLInputElement | null>(null);
  const quizFileRef = useRef<HTMLInputElement | null>(null);

  const [lessonUploads, setLessonUploads] = useState<UploadedFile[]>([]);
  const [refUploads, setRefUploads] = useState<UploadedFile[]>([]);
  const [quizUploads, setQuizUploads] = useState<UploadedFile[]>([]);

  const [uploadingLesson, setUploadingLesson] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [uploadingQuiz, setUploadingQuiz] = useState(false);

  const [saving, setSaving] = useState(false);

  const hasRefAny =
    refTitle.trim().length > 0 ||
    hasMeaningfulRichText(refContent) ||
    refUploads.length > 0;

  const hasQuizTitle = quizTitle.trim().length > 0;
  const hasQuizAny = hasQuizTitle || quizUploads.length > 0;

  const canSave = useMemo(() => {
    if (!courseId) return false;

    // lesson 필수
    if (!lessonTitle.trim() || !hasMeaningfulRichText(lessonContent))
      return false;

    // reference: 첨부 있으면 title 필요 / 내용 쓰면 title+content 둘다
    if (refUploads.length > 0 && !refTitle.trim()) return false;
    if (
      (refTitle.trim().length > 0 || hasMeaningfulRichText(refContent)) &&
      (!refTitle.trim() || !hasMeaningfulRichText(refContent))
    )
      return false;

    // quiz: 첨부만 있어도 title 필요
    if (quizUploads.length > 0 && !quizTitle.trim()) return false;

    // quiz title 있으면 문항 1개 이상 + 각 문항 정답 유효
    if (hasQuizTitle) {
      if (questions.length === 0) return false;
      for (const q of questions) {
        if (!q.questionText.trim()) return false;

        if (q.questionType === "multiple_choice") {
          const opts = q.options.map((x) => x.trim()).filter(Boolean);
          if (opts.length < 2) return false;
          // 정답은 선택지 중 하나여야 함
          if (!q.correctAnswer.trim()) return false;
          if (!opts.includes(q.correctAnswer.trim())) return false;
        } else {
          // 주관식: 정답 텍스트 필수
          if (!q.correctAnswer.trim()) return false;
        }
      }
    }

    return !saving && !uploadingLesson && !uploadingRef && !uploadingQuiz;
  }, [
    courseId,
    lessonTitle,
    lessonContent,
    refTitle,
    refContent,
    refUploads.length,
    quizTitle,
    quizUploads.length,
    questions,
    saving,
    uploadingLesson,
    uploadingRef,
    uploadingQuiz,
    hasQuizTitle,
  ]);

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      {
        key: uid(),
        questionText: "",
        questionType: "multiple_choice",
        options: ["", ""],
        correctAnswer: "",
      },
    ]);
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveQuestion(idx: number, dir: -1 | 1) {
    setQuestions((prev) => {
      const next = [...prev];
      const ni = idx + dir;
      if (ni < 0 || ni >= next.length) return prev;
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return next;
    });
  }

  function updateQuestion(idx: number, patch: Partial<Q>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q))
    );
  }

  function addOption(idx: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === idx ? { ...q, options: [...q.options, ""] } : q
      )
    );
  }

  function removeOption(qIdx: number, optIdx: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        if (q.options.length <= 2) return q;

        const removing = q.options[optIdx];
        const nextOpts = q.options.filter((_, j) => j !== optIdx);

        // 정답이 지워지는 선택지였다면 정답 초기화
        const nextCorrect = q.correctAnswer === removing ? "" : q.correctAnswer;

        return { ...q, options: nextOpts, correctAnswer: nextCorrect };
      })
    );
  }

  async function uploadFiles(
    files: FileList | null,
    setUploading: (b: boolean) => void,
    setUploads: React.Dispatch<React.SetStateAction<UploadedFile[]>>,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const next: UploadedFile[] = [];
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", f);

        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          alert(data?.message ?? `업로드 실패: ${f.name}`);
          continue;
        }

        const id = Number(data?.id);
        if (!Number.isFinite(id)) {
          alert(`업로드 응답이 이상함: ${f.name}`);
          continue;
        }

        next.push({
          id,
          name: data?.originalName ?? f.name,
          size: data?.size ?? f.size,
          contentType: data?.contentType ?? f.type,
          url: `/api/upload/${id}`,
        });
      }

      setUploads((prev) => [...prev, ...next]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function insertLinks(uploads: UploadedFile[], setter: (fn: any) => void) {
    if (uploads.length === 0) return;
    const links = uploads
      .map(
        (u) =>
          `<p><a href="${u.url}" target="_blank" rel="noopener noreferrer">${u.name}</a></p>`
      )
      .join("");
    setter((prev: string) => (prev || "") + links);
  }

  async function saveBundle() {
    if (!canSave) return;
    setSaving(true);

    try {
      const payload: any = {
        courseId,
        lesson: {
          title: lessonTitle.trim(),
          difficulty:
            lessonDifficulty === "project" ? "hard" : lessonDifficulty,
          content: lessonContent,
        },
        reference: hasRefAny
          ? { title: refTitle.trim(), content: refContent }
          : null,
        quiz: hasQuizAny
          ? { title: quizTitle.trim(), content: quizContent }
          : null,
        questions: hasQuizTitle
          ? questions.map((q, idx) => {
              const opts =
                q.questionType === "multiple_choice"
                  ? q.options.map((x) => x.trim()).filter(Boolean)
                  : undefined;

              return {
                questionText: q.questionText.trim(),
                questionType: q.questionType,
                options: opts,
                correctAnswer: q.correctAnswer.trim(),
                orderIndex: idx + 1,
              };
            })
          : [],
        attachmentUploadIdsByType: {
          lesson: lessonUploads.map((u) => Number(u.id)),
          reference: refUploads.map((u) => Number(u.id)),
          quiz: quizUploads.map((u) => Number(u.id)),
        },
      };

      const res = await fetch("/api/lesson-bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.message ?? `저장 실패 (${res.status})`);
        return;
      }

      router.push(`/posts/${data.lessonId}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-muted-foreground">과목</div>
          <div className="w-[220px]">
            <Select
              value={String(courseId)}
              onValueChange={(v) => setCourseId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {safeCourses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">난이도(lesson)</div>
          <div className="w-[160px]">
            <Select
              value={lessonDifficulty}
              onValueChange={(v) => setLessonDifficulty(v as Difficulty)}
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

        <Tabs defaultValue="lesson" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="lesson">수업(lesson)</TabsTrigger>
            <TabsTrigger value="reference">참조(reference)</TabsTrigger>
            <TabsTrigger value="quiz">문제(quiz)</TabsTrigger>
          </TabsList>

          <TabsContent value="lesson" className="space-y-3 pt-4">
            <div className="text-sm text-muted-foreground">수업 제목</div>
            <Input
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="예: Java 기초 문법"
            />

            <AttachmentBox
              title="수업"
              uploads={lessonUploads}
              uploading={uploadingLesson}
              inputRef={lessonFileRef}
              onPick={(files) =>
                uploadFiles(
                  files,
                  setUploadingLesson,
                  setLessonUploads,
                  lessonFileRef
                )
              }
              onInsertLinks={() => insertLinks(lessonUploads, setLessonContent)}
              onRemove={(id) =>
                setLessonUploads((p) => p.filter((x) => x.id !== id))
              }
            />

            <div className="text-sm text-muted-foreground pt-2">수업 내용</div>
            <QuillEditor value={lessonContent} onChange={setLessonContent} />
          </TabsContent>

          <TabsContent value="reference" className="space-y-3 pt-4">
            <div className="text-sm text-muted-foreground">참조자료 제목</div>
            <Input
              value={refTitle}
              onChange={(e) => setRefTitle(e.target.value)}
              placeholder="예: 추가 설명/링크/요약"
            />

            <AttachmentBox
              title="참조"
              uploads={refUploads}
              uploading={uploadingRef}
              inputRef={refFileRef}
              onPick={(files) =>
                uploadFiles(files, setUploadingRef, setRefUploads, refFileRef)
              }
              onInsertLinks={() => insertLinks(refUploads, setRefContent)}
              onRemove={(id) =>
                setRefUploads((p) => p.filter((x) => x.id !== id))
              }
            />

            <div className="text-sm text-muted-foreground pt-2">
              참조자료 내용
            </div>
            <QuillEditor value={refContent} onChange={setRefContent} />
            <div className="text-xs text-muted-foreground">
              비워두면 참조자료는 생성되지 않습니다. (단, 참조 첨부가 있으면
              제목은 필요)
            </div>
          </TabsContent>

          <TabsContent value="quiz" className="space-y-3 pt-4">
            <div className="text-sm text-muted-foreground">문제풀이 제목</div>
            <Input
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder="예: 0901 Java - 퀴즈"
            />

            <AttachmentBox
              title="문제풀이"
              uploads={quizUploads}
              uploading={uploadingQuiz}
              inputRef={quizFileRef}
              onPick={(files) =>
                uploadFiles(
                  files,
                  setUploadingQuiz,
                  setQuizUploads,
                  quizFileRef
                )
              }
              onInsertLinks={() => insertLinks(quizUploads, setQuizContent)}
              onRemove={(id) =>
                setQuizUploads((p) => p.filter((x) => x.id !== id))
              }
            />

            <div className="text-sm text-muted-foreground pt-2">
              문제풀이 안내/설명(선택)
            </div>
            <QuillEditor value={quizContent} onChange={setQuizContent} />

            <div className="pt-2 flex items-center justify-between">
              <div className="font-semibold">문항</div>
              <Button type="button" variant="secondary" onClick={addQuestion}>
                + 문항 추가
              </Button>
            </div>

            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div
                  key={q.key}
                  className="rounded-lg border border-border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">Q{idx + 1}</div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => moveQuestion(idx, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => moveQuestion(idx, 1)}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => removeQuestion(idx)}
                      >
                        삭제
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">문항 타입</div>
                  <div className="w-[240px]">
                    <Select
                      value={q.questionType}
                      onValueChange={(v) => {
                        const t = v as QuestionType;
                        if (t === "multiple_choice") {
                          updateQuestion(idx, {
                            questionType: "multiple_choice",
                            options: q.options?.length ? q.options : ["", ""],
                            correctAnswer: "",
                          });
                        } else {
                          updateQuestion(idx, {
                            questionType: "short_answer",
                            options: [],
                            correctAnswer: "",
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiple_choice">객관식</SelectItem>
                        <SelectItem value="short_answer">주관식</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-sm text-muted-foreground pt-2">문항</div>
                  <Textarea
                    value={q.questionText}
                    onChange={(e) =>
                      updateQuestion(idx, { questionText: e.target.value })
                    }
                    placeholder="질문을 입력하세요"
                    className="min-h-[96px] rounded-xl bg-black/20"
                  />

                  {q.questionType === "multiple_choice" ? (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          선택지 (정답은 라디오로 선택)
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => addOption(idx)}
                        >
                          + 선택지
                        </Button>
                      </div>

                      {q.options.map((opt, j) => {
                        const optText = opt ?? "";
                        const checked =
                          q.correctAnswer.trim() !== "" &&
                          q.correctAnswer === optText;
                        return (
                          <div key={j} className="flex items-center gap-2">
                            <label className="flex items-center gap-2 text-sm text-muted-foreground w-[90px]">
                              <input
                                type="radio"
                                name={`correct-${q.key}`}
                                checked={checked}
                                onChange={() =>
                                  updateQuestion(idx, {
                                    correctAnswer: optText,
                                  })
                                }
                              />
                              정답
                            </label>

                            <Input
                              value={optText}
                              onChange={(e) => {
                                const next = [...q.options];
                                const prevText = next[j];
                                next[j] = e.target.value;

                                // 정답이 이 선택지였다면 정답도 함께 갱신
                                const nextCorrect =
                                  q.correctAnswer === prevText
                                    ? e.target.value
                                    : q.correctAnswer;

                                updateQuestion(idx, {
                                  options: next,
                                  correctAnswer: nextCorrect,
                                });
                              }}
                              placeholder={`선택지 ${j + 1}`}
                            />

                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => removeOption(idx, j)}
                            >
                              삭제
                            </Button>
                          </div>
                        );
                      })}

                      <div className="text-xs text-muted-foreground">
                        ※ 정답은 “선택지 텍스트”로 저장됩니다.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-2">
                      <div className="text-sm text-muted-foreground">
                        정답(텍스트 일치)
                      </div>
                      <Textarea
                        value={q.correctAnswer}
                        onChange={(e) =>
                          updateQuestion(idx, { correctAnswer: e.target.value })
                        }
                        placeholder="정답을 자유롭게 입력하세요 (여러 줄 가능)"
                        className="min-h-[80px] rounded-xl bg-black/20"
                      />

                      <div className="text-xs text-muted-foreground">
                        ※ 사용자가 입력한 답이 이 텍스트와 “일치”하면 정답
                        처리됩니다.
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {hasQuizTitle ? (
              <div className="text-xs text-muted-foreground">
                퀴즈 제목이 있으면 문항/정답을 채워야 저장됩니다.
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                퀴즈 제목을 비우면 문제풀이(퀴즈)는 생성되지 않습니다. (단,
                문제풀이 첨부가 있으면 제목 필요)
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Button onClick={saveBundle} disabled={!canSave}>
          {saving ? "저장 중..." : "세트 저장"}
        </Button>
      </CardContent>
    </Card>
  );
}
