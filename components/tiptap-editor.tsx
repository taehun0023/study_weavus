"use client"

import { useEffect, useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"
import { Button } from "@/components/ui/button"

type UploadKind = "image" | "file"

export default function TiptapEditor({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (html: string) => void
  className?: string
}) {
  const imgInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState<null | UploadKind>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: "noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({
        placeholder: "",
      }),
    ],
    // ✅ 초기 content는 빈값으로 두고, useEffect에서 안전하게 동기화
    content: "",
    editorProps: {
      attributes: {
        class:
          // Tistory-like: focus on the content itself (no boxed editor feel)
          "tistory-editor min-h-[520px] outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // ✅ 외부 value 동기화(수정 페이지/초기 로딩)
  useEffect(() => {
    if (!editor) return
    if (editor.isDestroyed) return

    const next = value || ""
    const current = editor.getHTML()

    // 완전 동일할 때는 setContent를 안 걸어야 무한루프/커서튐 방지
    if (next !== current) {
      // tiptap v3: setContent(content, emitUpdate)
      editor.commands.setContent(next, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  async function upload(kind: UploadKind, file: File) {
    if (!editor) return
    setUploading(kind)
    try {
      const fd = new FormData()
      fd.append("file", file)

      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({} as any))

      if (!res.ok) {
        alert(data?.message ?? `Upload failed (${res.status})`)
        return
      }

      const url = data?.url as string | undefined
      const filename = (data?.filename as string) || file.name

      if (!url) {
        alert("Upload succeeded but no url was returned from /api/upload")
        return
      }

      if (kind === "image") {
        editor.chain().focus().setImage({ src: url, alt: filename }).run()
      } else {
        // ✅ href/텍스트 모두 escape
        editor
          .chain()
          .focus()
          .insertContent(
            `<p><a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">${escapeText(
              filename
            )}</a></p>`
          )
          .run()
      }
    } finally {
      setUploading(null)
    }
  }

  function setLink() {
    if (!editor) return
    const prev = (editor.getAttributes("link").href as string | undefined) ?? ""
    const url = window.prompt("링크 URL", prev)
    if (url === null) return

    const next = url.trim()
    if (next === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: next }).run()
  }

  if (!editor) return null

  return (
    <div className={className}>
      <div className="tistory-toolbar flex flex-wrap gap-2 pb-3">
        <Button
          type="button"
          variant={editor.isActive("bold") ? "default" : "secondary"}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </Button>
        <Button
          type="button"
          variant={editor.isActive("italic") ? "default" : "secondary"}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </Button>
        <Button
          type="button"
          variant={editor.isActive("underline") ? "default" : "secondary"}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          U
        </Button>
        <Button
          type="button"
          variant={editor.isActive("strike") ? "default" : "secondary"}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          S
        </Button>

        <div className="w-px bg-border mx-1" />

        <Button
          type="button"
          variant={editor.isActive("heading", { level: 1 }) ? "default" : "secondary"}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </Button>
        <Button
          type="button"
          variant={editor.isActive("heading", { level: 2 }) ? "default" : "secondary"}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </Button>
        <Button
          type="button"
          variant={editor.isActive("heading", { level: 3 }) ? "default" : "secondary"}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </Button>

        <div className="w-px bg-border mx-1" />

        <Button
          type="button"
          variant={editor.isActive("bulletList") ? "default" : "secondary"}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • List
        </Button>
        <Button
          type="button"
          variant={editor.isActive("orderedList") ? "default" : "secondary"}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </Button>
        <Button
          type="button"
          variant={editor.isActive("blockquote") ? "default" : "secondary"}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          “ ”
        </Button>
        <Button
          type="button"
          variant={editor.isActive("codeBlock") ? "default" : "secondary"}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          {"</>"}
        </Button>

        <div className="w-px bg-border mx-1" />

        <Button type="button" variant="secondary" onClick={setLink}>
          링크
        </Button>

        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload("image", f)
            e.currentTarget.value = ""
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload("file", f)
            e.currentTarget.value = ""
          }}
        />

        <Button
          type="button"
          variant="secondary"
          disabled={uploading !== null}
          onClick={() => imgInputRef.current?.click()}
        >
          {uploading === "image" ? "업로드 중..." : "이미지"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={uploading !== null}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading === "file" ? "업로드 중..." : "파일"}
        </Button>

        <div className="flex-1" />

        <Button
          type="button"
          variant="secondary"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          서식 지우기
        </Button>
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}

function escapeText(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
function escapeAttr(s: string) {
  return escapeText(s)
}
