"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function PostAdminActions({
  postId,
  editHref,
  afterDeleteHref,
  size = "sm",
}: {
  postId: string // ✅ string으로 고정 (NaN/BigInt 깨짐 방지)
  editHref: string
  afterDeleteHref: string
  size?: "sm" | "default"
}) {
  const router = useRouter()

  function kill(e: React.SyntheticEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  async function onEdit(e: React.MouseEvent) {
    kill(e)
    router.push(editHref)
  }

  async function onDelete(e: React.MouseEvent) {
    kill(e)

    const ok = confirm("정말 삭제할까요?")
    if (!ok) return

    const res = await fetch(`/api/posts/${encodeURIComponent(postId)}`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      alert(data?.message ?? `삭제 실패 (${res.status})`)
      return
    }

    router.push(afterDeleteHref)
    router.refresh()
  }

  return (
    <div
      className="flex items-center gap-2"
      onMouseDown={kill as any}
      onClick={kill as any}
    >
      <Button variant="secondary" size={size} onClick={onEdit}>
        수정
      </Button>
      <Button variant="destructive" size={size} onClick={onDelete}>
        삭제
      </Button>
    </div>
  )
}
