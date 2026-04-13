"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Faq = {
  id: number;
  question: string;
  answer: string;
  is_active: boolean;
};

type KnowledgeDoc = {
  id: number;
  title: string;
  source_type: string;
  source_id: number | null;
  mime: string | null;
  is_active: boolean;
  updated_at: string;
};

type ChatLog = {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  question: string;
  answer: string;
  mode: string;
  created_at: string;
};

type ReviewItem = {
  id: number;
  question: string;
  proposed_answer: string;
  source_titles: string;
  status: string;
  created_at: string;
};

export default function AdminAssistantFaqClient() {
  const [rows, setRows] = useState<Faq[]>([]);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [urlSaving, setUrlSaving] = useState(false);
  const [knowledgeUrl, setKnowledgeUrl] = useState("");
  const [docBusyId, setDocBusyId] = useState<number | null>(null);
  const [bulkDeletingDocs, setBulkDeletingDocs] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [limitSaving, setLimitSaving] = useState(false);
  const [learningEnabled, setLearningEnabled] = useState(true);
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [dailyBudget, setDailyBudget] = useState("");
  const [dailyTokenLimit, setDailyTokenLimit] = useState("");
  const [userDailyLimit, setUserDailyLimit] = useState("");
  const [userMonthlyLimit, setUserMonthlyLimit] = useState("");
  const [learningDailyLimit, setLearningDailyLimit] = useState("");
  const [ocrDailyPageLimit, setOcrDailyPageLimit] = useState("");
  const [usageInfo, setUsageInfo] = useState<{
    today_total_tokens: number;
    today_user_tokens: number;
    today_total_cost_usd: number;
    month_user_tokens: number;
    month_total_cost_usd: number;
  } | null>(null);
  const [learningUsageInfo, setLearningUsageInfo] = useState<{
    today_total_learning: number;
    today_user_learning: number;
    today_total_ocr_pages: number;
  } | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/assistant-faqs", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "목록 로드 실패");
        setRows([]);
        setDocs([]);
        return;
      }
      setRows(Array.isArray(data?.rows) ? data.rows : []);

      const dRes = await fetch("/api/admin/assistant-knowledge", {
        cache: "no-store",
      });
      const dJson = await dRes.json().catch(() => ({}));
      if (dRes.ok) {
        const nextDocs: KnowledgeDoc[] = Array.isArray(dJson?.rows)
          ? (dJson.rows as KnowledgeDoc[])
          : [];
        setDocs(nextDocs);
        setSelectedDocIds((prev) =>
          prev.filter((id) => nextDocs.some((d) => d.id === id)),
        );
      } else {
        setDocs([]);
        setSelectedDocIds([]);
      }

      const sRes = await fetch("/api/admin/assistant-settings", {
        cache: "no-store",
      });
      const sJson = await sRes.json().catch(() => ({}));
      if (sRes.ok) {
        const s = sJson?.settings ?? {};
        setLearningEnabled(s.learning_enabled !== false);
        setMonthlyBudget(
          s.monthly_budget_usd == null ? "" : String(s.monthly_budget_usd),
        );
        setDailyBudget(s.daily_budget_usd == null ? "" : String(s.daily_budget_usd));
        setDailyTokenLimit(
          s.daily_token_limit == null ? "" : String(s.daily_token_limit),
        );
        setUserDailyLimit(
          s.user_daily_token_limit == null
            ? ""
            : String(s.user_daily_token_limit),
        );
        setUserMonthlyLimit(
          s.user_monthly_token_limit == null
            ? ""
            : String(s.user_monthly_token_limit),
        );
        setLearningDailyLimit(
          s.learning_daily_limit == null ? "" : String(s.learning_daily_limit),
        );
        setOcrDailyPageLimit(
          s.ocr_daily_page_limit == null ? "" : String(s.ocr_daily_page_limit),
        );
        setUsageInfo(sJson?.usage ?? null);
        setLearningUsageInfo(sJson?.learningUsage ?? null);
      } else {
        setUsageInfo(null);
        setLearningUsageInfo(null);
      }

      const lRes = await fetch("/api/admin/assistant-chat-logs?limit=100", {
        cache: "no-store",
      });
      const lJson = await lRes.json().catch(() => ({}));
      if (lRes.ok) {
        setChatLogs(Array.isArray(lJson?.rows) ? lJson.rows : []);
      } else {
        setChatLogs([]);
      }

      const rRes = await fetch("/api/admin/assistant-review-items", {
        cache: "no-store",
      });
      const rJson = await rRes.json().catch(() => ({}));
      if (rRes.ok) {
        setReviewItems(Array.isArray(rJson?.rows) ? rJson.rows : []);
      } else {
        setReviewItems([]);
      }
    } catch {
      setError("목록 로드 실패");
      setRows([]);
      setDocs([]);
      setChatLogs([]);
      setReviewItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function reviewAction(id: number, action: "approve" | "reject") {
    if (docBusyId) return;
    setDocBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/assistant-review-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "검수 처리 실패");
        return;
      }
      await load();
    } catch {
      setError("검수 처리 실패");
    } finally {
      setDocBusyId(null);
    }
  }

  async function saveLimits() {
    if (limitSaving) return;
    setLimitSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/assistant-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learning_enabled: learningEnabled,
          monthly_budget_usd: monthlyBudget.trim(),
          daily_budget_usd: dailyBudget.trim(),
          daily_token_limit: dailyTokenLimit.trim(),
          user_daily_token_limit: userDailyLimit.trim(),
          user_monthly_token_limit: userMonthlyLimit.trim(),
          learning_daily_limit: learningDailyLimit.trim(),
          ocr_daily_page_limit: ocrDailyPageLimit.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "제한 설정 저장 실패");
        return;
      }
      await load();
    } catch {
      setError("제한 설정 저장 실패");
    } finally {
      setLimitSaving(false);
    }
  }

  async function uploadAndIngest(file: File) {
    if (uploading) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const up = await upRes.json().catch(() => ({}));
      if (!upRes.ok || !up?.id) {
        setError(up?.message || "업로드 실패");
        return;
      }

      const inRes = await fetch("/api/admin/assistant-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: Number(up.id), title: file.name }),
      });
      const ing = await inRes.json().catch(() => ({}));
      if (!inRes.ok) {
        setError(ing?.message || "학습 등록 실패");
        return;
      }
      await load();
    } catch {
      setError("학습 등록 실패");
    } finally {
      setUploading(false);
    }
  }

  async function ingestUrl() {
    const url = knowledgeUrl.trim();
    if (!url || urlSaving) return;
    setUrlSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/assistant-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "URL 학습 등록 실패");
        return;
      }
      setKnowledgeUrl("");
      await load();
    } catch {
      setError("URL 학습 등록 실패");
    } finally {
      setUrlSaving(false);
    }
  }

  async function toggleDoc(row: KnowledgeDoc) {
    if (docBusyId) return;
    setDocBusyId(row.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/assistant-knowledge/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "문서 상태 변경 실패");
        return;
      }
      setDocs((prev) =>
        prev.map((d) =>
          d.id === row.id ? { ...d, is_active: !d.is_active } : d,
        ),
      );
      setDocBusyId(null);
      void load();
      return;
    } catch {
      setError("문서 상태 변경 실패");
    } finally {
      setDocBusyId(null);
    }
  }

  async function deleteDoc(row: KnowledgeDoc) {
    if (docBusyId || bulkDeletingDocs) return;
    if (!window.confirm("이 학습 문서를 삭제할까요?")) return;
    setDocBusyId(row.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/assistant-knowledge/${row.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "문서 삭제 실패");
        return;
      }
      setDocs((prev) => prev.filter((d) => d.id !== row.id));
      setSelectedDocIds((prev) => prev.filter((id) => id !== row.id));
      setDocBusyId(null);
      void load();
      return;
    } catch {
      setError("문서 삭제 실패");
    } finally {
      setDocBusyId(null);
    }
  }

  async function deleteSelectedDocs() {
    if (selectedDocIds.length === 0 || bulkDeletingDocs || docBusyId) return;
    if (!window.confirm(`선택한 ${selectedDocIds.length}개 문서를 삭제할까요?`)) return;
    setBulkDeletingDocs(true);
    setError("");
    const failed: number[] = [];
    try {
      for (const id of selectedDocIds) {
        try {
          const res = await fetch(`/api/admin/assistant-knowledge/${id}`, {
            method: "DELETE",
          });
          if (!res.ok) failed.push(id);
        } catch {
          failed.push(id);
        }
      }
      if (failed.length > 0) {
        setError(`${failed.length}개 문서 삭제 실패`);
      }
      setDocs((prev) => prev.filter((d) => !selectedDocIds.includes(d.id)));
      setSelectedDocIds(failed);
      void load();
    } finally {
      setBulkDeletingDocs(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createFaq() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/assistant-faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          answer: answer.trim(),
          isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "등록 실패");
        return;
      }
      setQuestion("");
      setAnswer("");
      setIsActive(true);
      await load();
    } catch {
      setError("등록 실패");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: Faq) {
    if (busyId) return;
    setBusyId(row.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/assistant-faqs/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "상태 변경 실패");
        return;
      }
      await load();
    } catch {
      setError("상태 변경 실패");
    } finally {
      setBusyId(null);
    }
  }

  async function editFaq(row: Faq) {
    if (busyId) return;
    const nextQ = window.prompt("질문 수정", row.question);
    if (nextQ == null) return;
    const nextA = window.prompt("답변 수정", row.answer);
    if (nextA == null) return;
    setBusyId(row.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/assistant-faqs/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: nextQ.trim(), answer: nextA.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "수정 실패");
        return;
      }
      await load();
    } catch {
      setError("수정 실패");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteFaq(row: Faq) {
    if (busyId) return;
    if (!window.confirm("이 FAQ를 삭제할까요?")) return;
    setBusyId(row.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/assistant-faqs/${row.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "삭제 실패");
        return;
      }
      await load();
    } catch {
      setError("삭제 실패");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="space-y-2 rounded-xl border border-white/10 p-4">
        <div className="text-sm font-semibold">사용량/제한 설정</div>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={learningEnabled}
            onChange={(e) => setLearningEnabled(e.target.checked)}
          />
          학습 모드 활성화 (OFF면 새 학습 등록 차단)
        </label>
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            value={monthlyBudget}
            onChange={(e) => setMonthlyBudget(e.target.value)}
            placeholder="월 예산 상한 USD (예: 10)"
          />
          <Input
            value={dailyBudget}
            onChange={(e) => setDailyBudget(e.target.value)}
            placeholder="일 예산 상한 USD (예: 0.2)"
          />
          <Input
            value={dailyTokenLimit}
            onChange={(e) => setDailyTokenLimit(e.target.value)}
            placeholder="일일 토큰 제한 (전체)"
          />
          <Input
            value={userDailyLimit}
            onChange={(e) => setUserDailyLimit(e.target.value)}
            placeholder="사용자 일일 토큰 제한"
          />
          <Input
            value={userMonthlyLimit}
            onChange={(e) => setUserMonthlyLimit(e.target.value)}
            placeholder="사용자 월간 토큰 제한"
          />
          <Input
            value={learningDailyLimit}
            onChange={(e) => setLearningDailyLimit(e.target.value)}
            placeholder="일일 문서 학습 횟수 제한 (전체)"
          />
          <Input
            value={ocrDailyPageLimit}
            onChange={(e) => setOcrDailyPageLimit(e.target.value)}
            placeholder="일일 OCR 페이지 제한 (전체)"
          />
        </div>
        {usageInfo ? (
          <div className="text-xs text-muted-foreground">
            오늘 전체 토큰: {usageInfo.today_total_tokens} · 오늘 내 토큰:{" "}
            {usageInfo.today_user_tokens} · 오늘 추정비용: $
            {usageInfo.today_total_cost_usd.toFixed(4)} · 이번 달 내 토큰:{" "}
            {usageInfo.month_user_tokens} · 이번 달 추정비용: $
            {usageInfo.month_total_cost_usd.toFixed(4)}
          </div>
        ) : null}
        {learningUsageInfo ? (
          <div className="text-xs text-muted-foreground">
            오늘 학습 횟수(전체/내): {learningUsageInfo.today_total_learning}/
            {learningUsageInfo.today_user_learning} · 오늘 OCR 페이지:{" "}
            {learningUsageInfo.today_total_ocr_pages}
          </div>
        ) : null}
        <Button type="button" onClick={saveLimits} disabled={limitSaving}>
          {limitSaving ? "저장 중..." : "제한 설정 저장"}
        </Button>
      </div>

      <div className="space-y-2 rounded-xl border border-white/10 p-4">
        <div className="text-sm font-semibold">FAQ 등록</div>
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="질문 (예: 급여 몇일이야?)"
        />
        <Input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="답변 (예: 매월 20일 입니다.)"
        />
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          활성화
        </label>
        <Button
          type="button"
          onClick={createFaq}
          disabled={saving || !learningEnabled}
        >
          {saving ? "등록 중..." : "등록"}
        </Button>
      </div>

      <div className="space-y-2 rounded-xl border border-white/10 p-4">
        <div className="text-sm font-semibold">파일 업로드 학습</div>
        <div className="text-xs text-muted-foreground">
          지원 형식: txt, md, csv, json, xml, pdf, png, jpg, jpeg, webp
        </div>
        <Input
          type="file"
          disabled={!learningEnabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadAndIngest(file);
            e.currentTarget.value = "";
          }}
        />
        <div className="text-xs text-muted-foreground">
          PDF는 OCR/레이아웃 분석으로 처리됩니다. XLSX는 다음 버전에서 지원됩니다.
        </div>
        {uploading ? (
          <div className="text-sm text-muted-foreground">업로드/학습 중...</div>
        ) : null}
      </div>

      <div className="space-y-2 rounded-xl border border-white/10 p-4">
        <div className="text-sm font-semibold">URL 학습</div>
        <div className="flex items-center gap-2">
          <Input
            value={knowledgeUrl}
            onChange={(e) => setKnowledgeUrl(e.target.value)}
            placeholder="https://example.com/wiki"
            disabled={!learningEnabled}
          />
          <Button
            type="button"
            onClick={ingestUrl}
            disabled={urlSaving || !learningEnabled}
          >
            {urlSaving ? "등록 중..." : "URL 등록"}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          공개 페이지는 본문을 추출해 학습됩니다. 로그인/권한 페이지는 실패할 수
          있습니다.
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">학습 문서 목록</div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                if (docs.length === 0) return;
                if (selectedDocIds.length === docs.length) {
                  setSelectedDocIds([]);
                  return;
                }
                setSelectedDocIds(docs.map((d) => d.id));
              }}
              disabled={docs.length === 0 || bulkDeletingDocs}
            >
              {selectedDocIds.length === docs.length && docs.length > 0
                ? "전체 해제"
                : "전체 선택"}
            </Button>
            <Button
              size="sm"
              type="button"
              variant="destructive"
              onClick={deleteSelectedDocs}
              disabled={selectedDocIds.length === 0 || bulkDeletingDocs || docBusyId !== null}
            >
              {bulkDeletingDocs
                ? `삭제 중...`
                : `선택 삭제${selectedDocIds.length > 0 ? ` (${selectedDocIds.length})` : ""}`}
            </Button>
          </div>
        </div>
        {docs.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            등록된 학습 문서가 없습니다.
          </div>
        ) : (
          docs.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-white/10 p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <label className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={selectedDocIds.includes(d.id)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedDocIds((prev) =>
                        checked
                          ? Array.from(new Set([...prev, d.id]))
                          : prev.filter((id) => id !== d.id),
                      );
                    }}
                    disabled={bulkDeletingDocs}
                  />
                  선택
                </label>
                <div className="font-medium break-words">{d.title}</div>
                <div className="text-xs text-muted-foreground">
                  source: {d.source_type}
                  {d.mime ? ` · ${d.mime}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  상태: {d.is_active ? "활성" : "비활성"}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => toggleDoc(d)}
                  disabled={docBusyId === d.id || bulkDeletingDocs}
                >
                  {d.is_active ? "비활성화" : "활성화"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  type="button"
                  onClick={() => deleteDoc(d)}
                  disabled={docBusyId === d.id || bulkDeletingDocs}
                >
                  삭제
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">검증/승인 대기 답변</div>
        {reviewItems.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            검증 대기 항목이 없습니다.
          </div>
        ) : (
          reviewItems.map((it) => (
            <div key={it.id} className="rounded-xl border border-white/10 p-3">
              <div className="text-sm font-medium break-words">Q. {it.question}</div>
              <div className="mt-1 text-sm text-muted-foreground break-words">
                A(초안). {it.proposed_answer}
              </div>
              {it.source_titles ? (
                <div className="mt-1 text-xs text-muted-foreground break-words">
                  근거: {it.source_titles}
                </div>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  type="button"
                  onClick={() => reviewAction(it.id, "approve")}
                  disabled={docBusyId === it.id}
                >
                  승인
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  type="button"
                  onClick={() => reviewAction(it.id, "reject")}
                  disabled={docBusyId === it.id}
                >
                  반려
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">사용자 질문/답변 로그</div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.open(
                "/api/admin/assistant-chat-logs?format=csv&limit=5000",
                "_blank",
              );
            }}
          >
            CSV 다운로드
          </Button>
        </div>
        {chatLogs.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            로그가 없습니다.
          </div>
        ) : (
          chatLogs.map((log) => (
            <div key={log.id} className="rounded-xl border border-white/10 p-3">
              <div className="text-xs text-muted-foreground">
                #{log.id} · {log.display_name} ({log.username}) · mode:{log.mode}
              </div>
              <div className="mt-1 text-sm">
                <span className="font-semibold">Q.</span> {log.question}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                <span className="font-semibold">A.</span> {log.answer}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">FAQ 목록</div>
        {loading ? (
          <div className="text-sm text-muted-foreground">불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">등록된 FAQ가 없습니다.</div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-white/10 p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-medium break-words">{r.question}</div>
                <div className="text-sm text-muted-foreground break-words">
                  {r.answer}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  상태: {r.is_active ? "활성" : "비활성"}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => toggleActive(r)}
                  disabled={busyId === r.id}
                >
                  {r.is_active ? "비활성화" : "활성화"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => editFaq(r)}
                  disabled={busyId === r.id}
                >
                  수정
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  type="button"
                  onClick={() => deleteFaq(r)}
                  disabled={busyId === r.id}
                >
                  삭제
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
