"use client";

import { useRouter } from "next/navigation";
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
  isPassed,
}: {
  postId: number;
  title: string;
  courseName: string;
  difficulty: Difficulty;
  postType: PostType;
  isAdmin: boolean;
  returnHref: string;
  isPassed: boolean;
}) {
  const router = useRouter();

  const goDetail = () => {
    if (!Number.isFinite(postId) || postId <= 0) return;
    router.push(`/posts/${postId}`);
  };

  const label = difficultyLabel(difficulty);

  /* Extract leading number from title like "01. ...", "3. ...", "10 ..." */
  const numMatch = title.match(/^(\d+)[.\s]/);
  const numPrefix = numMatch ? numMatch[1] : null;
  const titleBody = numMatch ? title.slice(numMatch[0].length).trim() : title;

  return (
    <div
      className="group flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border/50 bg-card cursor-pointer transition-all duration-150 hover:border-primary/30 hover:bg-accent/30 hover:shadow-sm"
      onClick={goDetail}
    >
      {/* Number badge */}
      {numPrefix ? (
        <span className="shrink-0 w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold text-primary tabular-nums">
          {numPrefix}
        </span>
      ) : (
        <span className="shrink-0 w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center text-xs text-muted-foreground">
          •
        </span>
      )}

      {/* Title + meta */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {titleBody}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[11px] text-muted-foreground">{courseName}</span>
          {postType === "lesson" && label && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span
                className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md ${difficultyBadgeClass(label)}`}
              >
                {label}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: pass badge + admin actions */}
      <div className="flex items-center gap-2 shrink-0">
        {isPassed && postType === "lesson" && (
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md diff-pass">
            합격
          </span>
        )}

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
              setEditHref={`/posts/${postId}/edit-set`}
              afterDeleteHref={returnHref}
              size="sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
