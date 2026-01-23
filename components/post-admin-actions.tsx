"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type PostType = "lesson" | "reference" | "quiz";

type Props = {
  postId: number;
  postType?: PostType;
  editHref?: string;
  setEditHref?: string;
  afterDeleteHref?: string;
  size?: "sm" | "default" | "lg";
};

export default function PostAdminActions({
  postId,
  postType,
  editHref,
  setEditHref,
  afterDeleteHref,
  size = "default",
}: Props) {
  const router = useRouter();

  // 일반 게시글 수정(lesson이 아닌 경우)
  const onEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(editHref ?? `/posts/${postId}/edit`);
  };

  const onSetEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(setEditHref ?? `/posts/${postId}/edit-set`);
  };

  const onDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("정말 삭제할까요?")) return;

    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.message ?? "삭제 실패");
      return;
    }

    router.push(afterDeleteHref ?? "/posts");
    router.refresh();
  };

  return (
    <div className="flex gap-2">
      {/* lesson은 edit-set을 '수정'으로 노출 (중복 '수정' 버튼 방지) */}
      {postType === "lesson" ? (
        <Button className="cursor-pointer" size={size} variant="secondary" onClick={onSetEdit}>
          수정
        </Button>
      ) : (
        <Button className="cursor-pointer" size={size} variant="secondary" onClick={onEdit}>
          수정
        </Button>
      )}
      <Button className="cursor-pointer" size={size} variant="destructive" onClick={onDelete}>
        삭제
      </Button>
    </div>
  );
}
