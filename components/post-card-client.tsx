"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PostAdminActions from "@/components/post-admin-actions";
import { difficultyBadgeClass, difficultyLabel } from "@/lib/difficulty";

type Difficulty = "easy" | "medium" | "hard" | "project" | null;
type PostType = "lesson" | "reference" | "quiz";

export default function PostCardClient({
  postId,
  title,
  courseName,
  difficulty,
  postType,
  isAdmin,
  returnHref,
}: {
  postId: number;
  title: string;
  courseName: string;
  difficulty: Difficulty;
  postType: PostType;
  isAdmin: boolean;
  returnHref: string;
}) {
  const router = useRouter();

  const goDetail = () => {
    if (!Number.isFinite(postId) || postId <= 0) return;
    router.push(`/posts/${postId}`);
  };

  const label = difficultyLabel(difficulty);

  return (
    <Card
      className="p-4 cursor-pointer hover:bg-muted/30 transition"
      onClick={goDetail}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-lg font-semibold truncate">{title}</div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{courseName}</Badge>

            {postType === "lesson" && label ? (
              <Badge
                // ✅ 난이도 컬러 복구
                className={`border ${difficultyBadgeClass(label)}`}
              >
                {label}
              </Badge>
            ) : null}
          </div>
        </div>

        {isAdmin && (
          <div
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <PostAdminActions
              postId={postId}
              postType={postType}
              editHref={`/posts/${postId}/edit`}
              setEditHref={`/posts/${postId}/edit-set`}
              afterDeleteHref={returnHref}
              size="sm"
            />
          </div>
        )}
      </div>
    </Card>
  );
}
