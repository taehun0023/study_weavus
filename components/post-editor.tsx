"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"

type Difficulty = "easy" | "medium" | "hard" | "project" | null

type Course = {
  id: number
  name: string
  slug: string
}

type InitialPost = {
  title: string
  courseId: number
  difficulty: Difficulty
  content: string
}

export default function PostEditor({
  courses,
  mode = "create",
  postId,
  initial,
}: {
  courses: Course[]
  mode?: "create" | "edit"
  postId?: string
  initial?: Partial<InitialPost>
}) {
  const router = useRouter()
  const imgRef = useRef<HTMLInputElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const safeCourses = Array.isArray(courses) ? courses : []

  const [title, setTitle] = useState(initial?.title ?? "")
  const [courseId, setCourseId] = useState<number>(initial?.courseId ?? (safeCourses[0]?.id ?? 0))
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? null)
  const [content, setContent] = useState<string>(initial?.content ?? "")

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<null | "image" | "file">(null)

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
        placeholder: "내용을 입력하세요…",
      }),
    ],
    content: initial?.content ?? "",
    editorProps: {
      attributes: {
        class:
          "min-h-[520px] rounded-md border border-border bg-background/40 p-4 outline-none prose prose-invert max-w-none",
      },
    },
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML())
    },
  })

  const canSubmit = useMemo(() => {
    const hasTitle = title.trim().length > 0
    const hasCourse = Number.isFinite(courseId) && courseId > 0
    const hasEditor = !!editor
    return hasTitle && hasCourse && hasEditor && !saving && uploading === null
  }, [title, courseId, editor, saving, uploading])

  function escapeHtmlText(s: string) {
    return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  }
  function escapeHtmlAttr(s: string) {
    return escapeHtmlText(s).replaceAll('"', "&quot;")
  }

  async function uploadAndInsert(kind: "image" | "file", file: File) {
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
      const name = (data?.filename as string) || file.name

      if (!url) {
        alert("Upload succeeded but no url was returned from /api/upload")
        return
      }

      if (kind === "image") {
        editor.chain().focus().setImage({ src: url, alt: name }).run()
      } else {
        editor
          .chain()
          .focus()
          .insertContent(
            `<p><a href="${escapeHtmlAttr(url)}" target="_blank" rel="noreferrer">${escapeHtmlText(
              name
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
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }

  async function submit() {
    if (!canSubmit) return
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        courseId,
        difficulty,
        content: content ?? "",
      }

      if (mode === "edit") {
        if (!postId) {
          alert("postId가 없습니다.")
          return
        }
        const res = await fetch(`/api/posts/${encodeURIComponent(postId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({} as any))
        if (!res.ok) {
          alert(data?.message ?? `수정 실패 (${res.status})`)
          return
        }
        router.push(`/posts/${postId}`)
        router.refresh()
        return
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          type: "lesson",
        }),
      })

      const data = await res.json().catch(() => ({} as any))
      if (!res.ok) {
        alert(data?.message ?? `저장 실패 (${res.status})`)
        return
      }

      const newId = data?.id
      if (newId) router.push(`/posts/${newId}`)
      else router.push("/posts")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6 space-y-4">
        {/* 제목 */}
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">제목</div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: Java 기초 문법" />
        </div>

        {/* 과목/난이도/첨부 한 줄 */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 과목 */}
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">과목</div>
            <div className="w-[160px]">
              <Select
                value={String(courseId)}
                onValueChange={(v) => setCourseId(Number(v))}
                disabled={safeCourses.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={safeCourses.length ? "선택" : "과목 없음"} />
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
          </div>

          {/* 난이도 */}
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">난이도</div>
            <div className="w-[140px]">
              <Select
                value={difficulty ?? "none"}
                onValueChange={(v) => setDifficulty(v === "none" ? null : (v as any))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">none</SelectItem>
                  <SelectItem value="easy">easy</SelectItem>
                  <SelectItem value="medium">medium</SelectItem>
                  <SelectItem value="project">project</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 첨부 */}
          <div className="flex items-center gap-2">
            <input
              ref={imgRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadAndInsert("image", f)
                e.currentTarget.value = ""
              }}
            />
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadAndInsert("file", f)
                e.currentTarget.value = ""
              }}
            />

            <Button type="button" variant="secondary" onClick={() => imgRef.current?.click()} disabled={uploading !== null}>
              {uploading === "image" ? "업로드 중..." : "이미지 첨부"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              disabled={uploading !== null}
            >
              {uploading === "file" ? "업로드 중..." : "파일 첨부"}
            </Button>
          </div>
        </div>

        {/* 툴바 */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={editor?.isActive("bold") ? "default" : "secondary"}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            B
          </Button>
          <Button
            type="button"
            variant={editor?.isActive("italic") ? "default" : "secondary"}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            I
          </Button>
          <Button
            type="button"
            variant={editor?.isActive("underline") ? "default" : "secondary"}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            U
          </Button>

          <Button type="button" variant="secondary" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
            H1
          </Button>
          <Button type="button" variant="secondary" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
            H2
          </Button>
          <Button type="button" variant="secondary" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            • List
          </Button>

          <Button type="button" variant="secondary" onClick={setLink}>
            Link
          </Button>

          <Button type="button" variant="secondary" onClick={() => editor?.chain().focus().undo().run()}>
            Undo
          </Button>
          <Button type="button" variant="secondary" onClick={() => editor?.chain().focus().redo().run()}>
            Redo
          </Button>
        </div>

        {/* 에디터 */}
        <div className="rounded-md border border-border bg-background/30">
          <EditorContent editor={editor} />
        </div>

        {/* 저장 */}
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={saving || uploading !== null}>
            취소
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {mode === "edit" ? (saving ? "수정 중..." : "수정") : saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
