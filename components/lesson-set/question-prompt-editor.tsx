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
    <div className="rounded-xl border border-border bg-black/10 p-3">
      <QuillEditor
        value={value}
        onChange={onChange}
        stickyToolbar={false} // 문항 카드 안에서는 고정 X
        maxWidthPx={9999} // 문항 카드 폭에 맞게
        minHeightPx={180} // 기존 textarea 높이 느낌
        placeholder="질문을 입력하세요"
      />
    </div>
  );
}
