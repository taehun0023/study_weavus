"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function PostAdminActions({
  postId,
}: {
  postId: number
}) {
  const router = useRouter()

  const onDelete = async () => {
    if (!confirm("정말 삭제할까요?")) return

    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" })
    if (!res.ok) {
      alert("삭제 실패")
      return
    }

    router.push("/posts")
    router.refresh()
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        onClick={() => router.push(`/posts/${postId}/edit`)}
      >
        수정
      </Button>
      <Button variant="destructive" onClick={onDelete}>
        삭제
      </Button>
    </div>
  )
}
