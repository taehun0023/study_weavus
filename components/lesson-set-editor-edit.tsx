"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

import QuillEditor from "@/components/quill-editor";
import QuestionPromptEditor from "@/components/lesson-set/question-prompt-editor";
import type {
  Course,
  Difficulty,
  QuestionType,
  QuizQuestion,
  UploadedFile,
} from "@/components/lesson-set/types";

type TabKey = "lesson" | "reference" | "quiz";

// NOTE: create/edit 화면의 문항 state를 동일하게 맞추기 위해 QuizQuestion 공용 타입 사용

type ApiQuestion = {
  id?: string;
  questionText: string;
  questionType: QuestionType;
  options?: string[];
  correctAnswer: string;
  explanation?: string; // ✅ 추가
  orderIndex: number;
};

type Attachment = {
  uploadId: number;
  label?: string | null;
  filename: string;
  mime: string;
  size: number;
  url: string;
};

type BundleGetResp = {
  courseId?: number;

  lesson?: { id?: number; title?: string; difficulty?: any; content?: string };
  reference?: { id?: number; title?: string; content?: string } | null;
  quiz?: { id?: number; title?: string; content?: string } | null;

  questions?: ApiQuestion[];

  attachmentsByType?: {
    lesson?: Attachment[];
    reference?: Attachment[];
    quiz?: Attachment[];
  };

  attachments?: Attachment[];
};

const genId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `q_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }
};

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

function isNonEmptyText(s: string) {
  return s.trim().length > 0;
}

function normalizeDifficulty(v: string): Difficulty {
  if (v === "medium" || v === "project") return v;
  return "easy";
}

function apiToUiQuestion(q: ApiQuestion): QuizQuestion {
  const options =
    q.questionType === "multiple_choice"
      ? Array.isArray(q.options)
        ? q.options
        : []
      : [];

  return {
    key: q.id ?? genId(),
    questionText: q.questionText ?? "",
    questionType: q.questionType ?? "multiple_choice",
    options: q.questionType === "multiple_choice" ? options : [],
    correctAnswer: q.correctAnswer ?? "",
    explanation: q.explanation ?? "",
  };
}

function uiToApiQuestion(q: QuizQuestion, orderIndex: number): ApiQuestion {
  const trimmedPrompt = (q.questionText ?? "").trim();

  if (q.questionType === "short_answer") {
    return {
      questionText: trimmedPrompt,
      questionType: "short_answer",
      correctAnswer: (q.correctAnswer ?? "").trim(),
      explanation: (q.explanation ?? "").trim(),
      orderIndex,
    };
  }

  const opts = (q.options ?? [])
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
  const ca = (q.correctAnswer ?? "").trim();

  return {
    questionText: trimmedPrompt,
    questionType: "multiple_choice",
    options: opts,
    correctAnswer: ca,
    explanation: (q.explanation ?? "").trim(),
    orderIndex,
  };
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
      <div className="flex flex-wrap items-center justify-between gap-3">
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

export default function LessonSetEditorEdit({
  courses,
  lessonId,
}: {
  courses: Course[];
  lessonId: number;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("lesson");

  const [courseId, setCourseId] = useState<number>(courses?.[0]?.id ?? 1);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");

  const [referenceTitle, setReferenceTitle] = useState("");
  const [referenceContent, setReferenceContent] = useState("");

  const [quizTitle, setQuizTitle] = useState("");
  const [quizIntro, setQuizIntro] = useState("");

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

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

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/lesson-bundles/${lessonId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("세트 정보를 불러오지 못했습니다.");
        const json = (await res.json()) as BundleGetResp;
        if (!alive) return;

        if (typeof json.courseId === "number") setCourseId(json.courseId);

        const diff = String(json.lesson?.difficulty ?? "easy");
        setDifficulty(normalizeDifficulty(diff === "hard" ? "project" : diff));

        setLessonTitle(json.lesson?.title ?? "");
        setLessonContent(json.lesson?.content ?? "");

        setReferenceTitle(json.reference?.title ?? "");
        setReferenceContent(json.reference?.content ?? "");

        setQuizTitle(json.quiz?.title ?? "");
        setQuizIntro(json.quiz?.content ?? "");

        const apiQs = Array.isArray(json.questions) ? json.questions : [];
        setQuestions(apiQs.map(apiToUiQuestion));

        const by = json.attachmentsByType ?? {
          lesson: json.attachments ?? [],
          reference: [],
          quiz: [],
        };

        const mapAtt = (atts?: Attachment[]) =>
          (Array.isArray(atts) ? atts : []).map((a) => ({
            id: Number(a.uploadId),
            name: a.label?.trim() ? String(a.label) : String(a.filename),
            url: String(a.url ?? `/api/upload/${a.uploadId}`),
            size: Number(a.size ?? 0) || undefined,
            contentType: a.mime ?? undefined,
          }));

        setLessonUploads(mapAtt(by.lesson));
        setRefUploads(mapAtt(by.reference));
        setQuizUploads(mapAtt(by.quiz));
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "불러오기 실패");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [lessonId]);

  const referenceHasAny =
    isNonEmptyText(referenceTitle) ||
    hasMeaningfulRichText(referenceContent) ||
    refUploads.length > 0;

  const quizHasAny =
    isNonEmptyText(quizTitle) ||
    hasMeaningfulRichText(quizIntro) ||
    quizUploads.length > 0 ||
    questions.length > 0;

  const referenceHalfFilled =
    (isNonEmptyText(referenceTitle) &&
      !hasMeaningfulRichText(referenceContent) &&
      refUploads.length === 0) ||
    (!isNonEmptyText(referenceTitle) &&
      hasMeaningfulRichText(referenceContent));

  const quizNeedsValidation = isNonEmptyText(quizTitle);

  const quizQuestionsValid = useMemo(() => {
    if (!quizNeedsValidation) return true;

    if (!isNonEmptyText(quizTitle)) return false;
    if (questions.length === 0) return false;

    for (const q of questions) {
      if (!hasMeaningfulRichText(q.questionText ?? "")) return false;

      if (q.questionType === "multiple_choice") {
        const opts = (q.options ?? [])
          .map((x) => String(x ?? "").trim())
          .filter(Boolean);
        if (opts.length < 2) return false;

        const ca = (q.correctAnswer ?? "").trim();
        if (!ca) return false;

        // ✅ 정답은 "보기 index"("0","1",...) 또는 (레거시) 보기 텍스트도 허용
        const idx = Number.parseInt(ca, 10);
        const isIndex =
          Number.isFinite(idx) &&
          String(idx) === ca &&
          idx >= 0 &&
          idx < opts.length;
        const isLegacyText = opts.includes(ca);

        if (!isIndex && !isLegacyText) return false;
      } else if (q.questionType === "true_false") {
        const ca = String(q.correctAnswer ?? "")
          .trim()
          .toLowerCase();
        if (!ca) return false;
        if (!["true", "false", "1", "0"].includes(ca)) return false;
      } else if (q.questionType === "number") {
        const ca = String(q.correctAnswer ?? "").trim();
        if (!ca) return false;
        if (Number.isNaN(Number(ca))) return false;
      } else {
        if (!isNonEmptyText(q.correctAnswer ?? "")) return false;
      }
    }

    return true;
  }, [quizNeedsValidation, quizTitle, questions]);

  const canSave = useMemo(() => {
    if (saving || loading) return false;

    if (!isNonEmptyText(lessonTitle) || !hasMeaningfulRichText(lessonContent))
      return false;

    if (refUploads.length > 0 && !isNonEmptyText(referenceTitle)) return false;
    if (referenceHalfFilled) return false;

    if (quizUploads.length > 0 && !isNonEmptyText(quizTitle)) return false;
    if (!quizQuestionsValid) return false;

    if (uploadingLesson || uploadingRef || uploadingQuiz) return false;

    return true;
  }, [
    saving,
    loading,
    lessonTitle,
    lessonContent,
    refUploads.length,
    referenceTitle,
    referenceHalfFilled,
    quizUploads.length,
    quizTitle,
    quizQuestionsValid,
    uploadingLesson,
    uploadingRef,
    uploadingQuiz,
  ]);

  async function uploadFiles(
    files: FileList | null,
    setUploading: (b: boolean) => void,
    setUploads: React.Dispatch<React.SetStateAction<UploadedFile[]>>,
    inputRef: React.RefObject<HTMLInputElement | null>,
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

  function insertLinks(uploads: UploadedFile[], setter: any) {
    if (uploads.length === 0) return;
    const links = uploads
      .map(
        (u) =>
          `<p><a href="${u.url}" target="_blank" rel="noopener noreferrer">${u.name}</a></p>`,
      )
      .join("");
    setter((prev: string) => (prev || "") + links);
  }

  function onAddQuestion() {
    setQuestions((prev) => [
      ...prev,
      {
        key: genId(),
        questionText: "",
        questionType: "multiple_choice",
        options: ["", ""],
        correctAnswer: "",
        explanation: "",
      },
    ]);
  }

  function onRemoveQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.key !== id));
  }

  function updateQuestion(id: string, patch: Partial<QuizQuestion>) {
    setQuestions((prev) =>
      prev.map((q) => (q.key === id ? { ...q, ...patch } : q)),
    );
  }

  function updateChoice(qid: string, idx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.key !== qid) return q;

        const next = [...(q.options ?? [])];
        const prevText = next[idx] ?? "";
        next[idx] = value;

        const nextCorrect =
          q.correctAnswer === prevText ? value : q.correctAnswer;

        return { ...q, options: next, correctAnswer: nextCorrect };
      }),
    );
  }

  function addChoice(qid: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === qid ? { ...q, options: [...(q.options ?? []), ""] } : q,
      ),
    );
  }

  function removeChoice(qid: string, idx: number) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.key !== qid) return q;
        if ((q.options ?? []).length <= 2) return q;

        const removing = q.options[idx];
        const next = q.options.filter((_, i) => i !== idx);

        const nextCorrect = q.correctAnswer === removing ? "" : q.correctAnswer;

        return { ...q, options: next, correctAnswer: nextCorrect };
      }),
    );
  }

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    try {
      const hasQuizTitle = isNonEmptyText(quizTitle);

      const apiQuestions: ApiQuestion[] = hasQuizTitle
        ? questions.map((q, i) => uiToApiQuestion(q, i + 1))
        : [];

      const payload = {
        courseId,
        lesson: {
          title: lessonTitle,
          difficulty: difficulty === "project" ? "hard" : difficulty,
          content: lessonContent,
        },
        reference: referenceHasAny
          ? { title: referenceTitle, content: referenceContent }
          : null,
        quiz: quizHasAny ? { title: quizTitle, content: quizIntro } : null,
        questions: apiQuestions,
        attachmentUploadIdsByType: {
          lesson: lessonUploads.map((u) => Number(u.id)),
          reference: refUploads.map((u) => Number(u.id)),
          quiz: quizUploads.map((u) => Number(u.id)),
        },
      };

      const res = await fetch(`/api/lesson-bundles/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "저장 실패");

      router.replace(`/posts/${lessonId}`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="text-sm text-muted-foreground">불러오는 중...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6 space-y-5">
        {error ? (
          <div className="mb-4 text-sm text-red-500">{error}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-muted-foreground">과목</div>
          <div className="w-[220px]">
            <Select
              value={String(courseId)}
              onValueChange={(v) => {
                const id = Number(v);
                if (id === -1) {
                  router.push("/posts/new?course=interview");
                  return;
                }
                setCourseId(id);
              }}
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

          <div className="text-sm text-muted-foreground">난이도(lesson)</div>
          <div className="w-[160px]">
            <Select
              value={difficulty}
              onValueChange={(v) => setDifficulty(normalizeDifficulty(v))}
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

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
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
              placeholder="수업 제목"
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
                  lessonFileRef,
                )
              }
              onInsertLinks={() => insertLinks(lessonUploads, setLessonContent)}
              onRemove={(id) =>
                setLessonUploads((p) => p.filter((x) => x.id !== id))
              }
            />

            <div className="text-sm text-muted-foreground pt-2">수업 내용</div>
            <QuillEditor value={lessonContent} onChange={setLessonContent} />

            <Button
              className="h-12 w-full"
              onClick={onSave}
              disabled={!canSave}
            >
              {saving ? "저장 중..." : "세트 수정 저장"}
            </Button>
          </TabsContent>

          <TabsContent value="reference" className="space-y-3 pt-4">
            <div className="text-sm text-muted-foreground">참조자료 제목</div>
            <Input
              value={referenceTitle}
              onChange={(e) => setReferenceTitle(e.target.value)}
              placeholder="예: 추가 설명/링크/요약 (첨부가 있으면 제목 필요)"
            />

            <AttachmentBox
              title="참조"
              uploads={refUploads}
              uploading={uploadingRef}
              inputRef={refFileRef}
              onPick={(files) =>
                uploadFiles(files, setUploadingRef, setRefUploads, refFileRef)
              }
              onInsertLinks={() => insertLinks(refUploads, setReferenceContent)}
              onRemove={(id) =>
                setRefUploads((p) => p.filter((x) => x.id !== id))
              }
            />

            <div className="text-sm text-muted-foreground pt-2">
              참조자료 내용
            </div>
            <QuillEditor
              value={referenceContent}
              onChange={setReferenceContent}
            />

            {referenceHalfFilled ? (
              <div className="text-xs text-red-500">
                참조자료는 제목과 내용을 둘 다 입력하거나, 둘 다 비워야 합니다.
              </div>
            ) : null}

            <Button
              className="h-12 w-full"
              onClick={onSave}
              disabled={!canSave}
            >
              {saving ? "저장 중..." : "세트 수정 저장"}
            </Button>
          </TabsContent>

          <TabsContent value="quiz" className="space-y-3 pt-4">
            <div className="text-sm text-muted-foreground">문제풀이 제목</div>
            <Input
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder="문제풀이 제목 (첨부가 있으면 제목 필요)"
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
                  quizFileRef,
                )
              }
              onInsertLinks={() => insertLinks(quizUploads, setQuizIntro)}
              onRemove={(id) =>
                setQuizUploads((p) => p.filter((x) => x.id !== id))
              }
            />

            <div className="text-sm text-muted-foreground pt-2">
              문제풀이 안내/설명(선택)
            </div>
            <QuillEditor value={quizIntro} onChange={setQuizIntro} />

            <div className="pt-2 flex items-center justify-between">
              <div className="font-semibold">문항</div>
              <Button variant="secondary" type="button" onClick={onAddQuestion}>
                + 문항 추가
              </Button>
            </div>

            <div className="space-y-4">
              {questions.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  문항이 없습니다. (퀴즈 제목이 있으면 1개 이상 필요)
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((q, idx) => (
                    <div
                      key={q.key}
                      className="rounded-lg border border-border p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">Q{idx + 1}</div>
                        <Button
                          variant="destructive"
                          size="sm"
                          type="button"
                          onClick={() => onRemoveQuestion(q.key)}
                        >
                          삭제
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">
                          문항 타입
                        </div>
                        <div className="w-[240px]">
                          <Select
                            value={q.questionType}
                            onValueChange={(v) => {
                              const t = v as QuestionType;
                              // questionType 변경 시 입력 UI 초기화
                              if (t === "multiple_choice") {
                                updateQuestion(q.key, {
                                  questionType: "multiple_choice",
                                  options: q.options?.length
                                    ? q.options
                                    : ["", ""],
                                  correctAnswer: "", // index 문자열로 저장
                                });
                              } else if (t === "true_false") {
                                updateQuestion(q.key, {
                                  questionType: "true_false",
                                  options: [],
                                  correctAnswer: "", // 'true' | 'false'
                                });
                              } else if (t === "number") {
                                updateQuestion(q.key, {
                                  questionType: "number",
                                  options: [],
                                  correctAnswer: "", // 숫자 문자열
                                });
                              } else {
                                updateQuestion(q.key, {
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
                              <SelectItem value="multiple_choice">
                                객관식
                              </SelectItem>
                              <SelectItem value="short_answer">
                                주관식
                              </SelectItem>
                              <SelectItem value="true_false">O/X</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="text-sm text-muted-foreground">
                          질문
                        </div>
                        <QuestionPromptEditor
                          value={q.questionText}
                          onChange={(value) =>
                            updateQuestion(q.key, { questionText: value })
                          }
                        />
                      </div>

                      {q.questionType === "multiple_choice" ? (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                              선택지 (정답은 라디오)
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              onClick={() => addChoice(q.key)}
                            >
                              + 선택지
                            </Button>
                          </div>

                          <div className="space-y-2">
                            {q.options.map((c, cIdx) => {
                              const checked =
                                q.correctAnswer !== "" && q.correctAnswer === c;
                              return (
                                <div
                                  key={`${q.key}_${cIdx}`}
                                  className="flex items-center gap-3"
                                >
                                  <label className="flex items-center gap-2 text-sm text-muted-foreground w-[90px]">
                                    <input
                                      type="radio"
                                      name={`correct-${q.key}`}
                                      checked={checked}
                                      onChange={() =>
                                        updateQuestion(q.key, {
                                          correctAnswer: c,
                                        })
                                      }
                                    />
                                    정답
                                  </label>

                                  <Input
                                    value={c}
                                    onChange={(e) =>
                                      updateChoice(q.key, cIdx, e.target.value)
                                    }
                                    className="h-10 rounded-xl bg-black/20 flex-1"
                                    placeholder={`선택지 ${cIdx + 1}`}
                                  />

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    onClick={() => removeChoice(q.key, cIdx)}
                                  >
                                    삭제
                                  </Button>
                                </div>
                              );
                            })}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            ※ 정답은 “선택지 번호(index)”로 저장됩니다.
                            (공백/줄바꿈 영향 없음)
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-2">
                          <div className="text-sm text-muted-foreground">
                            정답(텍스트 일치)
                          </div>
                          <Textarea
                            value={q.correctAnswer}
                            onChange={(e) =>
                              updateQuestion(q.key, {
                                correctAnswer: e.target.value,
                              })
                            }
                            placeholder="정답을 자유롭게 입력하세요"
                            className="min-h-[80px] rounded-xl bg-black/20"
                          />

                          <div className="text-xs text-muted-foreground">
                            ※ 사용자가 입력한 답이 이 텍스트와 “일치”하면 정답
                            처리됩니다.
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 pt-4">
                        <div className="text-sm text-muted-foreground">
                          문제풀이(해설)
                        </div>
                        <div className="rounded-xl border border-border bg-black/10 p-3">
                          <QuillEditor
                            value={q.explanation ?? ""}
                            onChange={(v) =>
                              updateQuestion(q.key, { explanation: v })
                            }
                            stickyToolbar={false}
                            maxWidthPx={9999}
                            minHeightPx={160}
                            placeholder="문제풀이/해설을 입력하세요"
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ※ 오답일 때 정답과 함께 표시됩니다.
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!quizQuestionsValid ? (
                <div className="text-sm text-red-500">
                  퀴즈 제목이 있으면 각 문항의 질문/정답을 채워야 저장됩니다.
                  (객관식은 라디오로 정답 선택, 주관식은 정답 텍스트 입력)
                </div>
              ) : null}
            </div>

            <Button
              className="h-12 w-full"
              onClick={onSave}
              disabled={!canSave}
            >
              {saving ? "저장 중..." : "세트 수정 저장"}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
