"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

export default function QuillEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const modules = useMemo(() => {
    return {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "code-block"],
        ["link", "image"],
        ["clean"],
      ],
      // history 등도 원하면 여기 추가 가능
    };
  }, []);

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <ReactQuill
        value={value}
        onChange={onChange}
        modules={modules}
        theme="snow"
        className="quill-editor"
      />

      {/* ✅ 높이 늘리기 */}
      <style jsx global>{`
        .quill-editor .ql-container {
          min-height: 420px;
        }
        .quill-editor .ql-editor {
          min-height: 420px;
          font-size: 16px;
          line-height: 1.7;
        }
      `}</style>
    </div>
  );
}
