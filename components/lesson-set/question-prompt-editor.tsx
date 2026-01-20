"use client";

import QuillEditor from "@/components/quill-editor";

export default function QuestionPromptEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-black/10 overflow-hidden">
      <QuillEditor
        value={value}
        onChange={onChange}
        placeholder="질문을 입력하세요 (코드블록 가능)"
      />
    </div>
  );
}
