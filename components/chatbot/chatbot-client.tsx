"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMessage } from "@/types/chatbot";

type EndpointMode = "image" | "url" | "text";

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readStreamedText(response: Response, onChunk: (chunk: string) => void) {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

export function ChatbotClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [url, setUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => question.trim().length > 0 && !isLoading, [question, isLoading]);

  async function submit() {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isLoading) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmedQuestion,
    };

    const assistantMessageId = createId();
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);

    setError("");
    setIsLoading(true);

    let mode: EndpointMode = "text";
    if (imageFile) mode = "image";
    else if (url.trim()) mode = "url";

    try {
      let response: Response;

      if (mode === "image") {
        const formData = new FormData();
        formData.append("image", imageFile as File);
        formData.append("question", trimmedQuestion);
        response = await fetch("/api/chatbot/analyze-image", {
          method: "POST",
          body: formData,
        });
      } else if (mode === "url") {
        response = await fetch("/api/chatbot/extract-from-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), question: trimmedQuestion }),
        });
      } else {
        response = await fetch("/api/chatbot/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmedQuestion }),
        });
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || "Request failed");
      }

      await readStreamedText(response, (chunk) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: `${msg.content}${chunk}` }
              : msg,
          ),
        );
      });

      setQuestion("");
      setImageFile(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      setError(message);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, content: `Error: ${message}` } : msg,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Multimodal Chatbot</h1>

      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Question</label>
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask a question..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Webpage URL (optional)</label>
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </div>

        <div className="mb-4 space-y-2">
          <label className="text-sm text-muted-foreground">Image upload (optional)</label>
          <Input
            type="file"
            accept="image/*"
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={!canSubmit}>
            {isLoading ? "Processing..." : "Send"}
          </Button>
          {isLoading ? <span className="text-sm text-muted-foreground">Loading...</span> : null}
          {imageFile ? <span className="text-xs text-muted-foreground">Image: {imageFile.name}</span> : null}
        </div>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      </div>

      <div className="min-h-[320px] space-y-3 rounded-lg border border-white/10 bg-black/10 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-md px-3 py-2 text-sm ${
                msg.role === "user" ? "bg-white/10" : "bg-white/5"
              }`}
            >
              <p className="mb-1 text-xs uppercase text-muted-foreground">{msg.role}</p>
              <p className="whitespace-pre-wrap">{msg.content || "..."}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
