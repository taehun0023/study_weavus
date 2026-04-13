"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Msg = {
  role: "user" | "assistant";
  text: string;
  mode?:
    | "faq"
    | "llm"
    | "knowledge"
    | "miss"
    | "verified"
    | "pending_review";
};

export default function FloatingAiAssistant() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [threadId, setThreadId] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "안녕하세요. 궁금한 내용을 질문해 주세요.",
    },
  ]);

  async function ask() {
    const question = q.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setQ("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          threadId: threadId || undefined,
          mode: "hybrid",
        }),
      });
      const data = await res.json().catch(() => ({}));
      const nextThreadId = String(data?.threadId ?? "").trim();
      if (nextThreadId) setThreadId(nextThreadId);
      const answer = String(data?.answer ?? data?.message ?? "응답 실패");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: answer,
          mode: data?.mode,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "요청 중 오류가 발생했습니다." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[70]">
      {open ? (
        <div className="w-[340px] rounded-xl border border-white/10 bg-black/90 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">AI 도우미</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              닫기
            </Button>
          </div>

          <div className="mb-3 h-72 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-2 text-sm">
            <div className="space-y-2">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "rounded-md bg-white/10 p-2"
                      : "rounded-md bg-white/5 p-2"
                  }
                >
                  {m.role === "assistant" && m.mode ? (
                    <div className="mb-1 text-[11px] text-muted-foreground">
                      모드: {m.mode}
                    </div>
                  ) : null}
                  {m.text}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="질문을 입력하세요"
              onKeyDown={(e) => {
                // IME(한글/일본어) 조합 중 Enter를 누르면 마지막 글자가 입력창에
                // 남는 문제가 있어 조합 완료 전에는 전송하지 않는다.
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  ask();
                }
              }}
            />
            <Button type="button" onClick={ask} disabled={loading}>
              {loading ? "전송 중" : "전송"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          className="h-12 rounded-full px-4 shadow-xl"
          onClick={() => setOpen(true)}
        >
          AI
        </Button>
      )}
    </div>
  );
}
