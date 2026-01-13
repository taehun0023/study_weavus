"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

export default function PostEditForm({
  post,
}: {
  post: { id: number; title: string; content: string | null; difficulty: string | null }
}) {
  const router = useRouter()
  const [title, setTitle] = useState(post.title)
  const [content, setContent] = useState(post.content ?? "")
  const [difficulty, setDifficulty] = useState(post.difficulty ?? "easy")
  const [saving, setSaving] = useState(false)

  async function onSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, difficulty }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.message ?? `수정 실패 (${res.status})`)
        return
      }
      router.push(`/posts/${post.id}`)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>게시글 수정</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm text-muted-foreground mb-2">제목</div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="flex items-center justify-end gap-2">
          <div className="text-sm text-muted-foreground">난이도</div>
          <div className="w-[160px]">
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">easy</SelectItem>
                <SelectItem value="medium">medium</SelectItem>
                <SelectItem value="project">project</SelectItem>
                <SelectItem value="hard">hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <div className="text-sm text-muted-foreground mb-2">내용</div>
          <Textarea className="min-h-[420px]" value={content} onChange={(e) => setContent(e.target.value)} />
        </div>

        <Button className="w-full" onClick={onSave} disabled={saving}>
          {saving ? "저장 중..." : "저장하기"}
        </Button>
      </CardContent>
    </Card>
  )
}
