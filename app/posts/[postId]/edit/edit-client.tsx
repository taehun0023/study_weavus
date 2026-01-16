"use client";

import PostEditor, {
  Course,
  Difficulty,
  PostEditorPayload,
} from "@/components/post-editor";

export default function EditClient({
  postId,
  courses,
  initial,
}: {
  postId: number;
  courses: Course[];
  initial: {
    title: string;
    content: string;
    courseId: number;
    difficulty: Difficulty;
  };
}) {
  return (
    <PostEditor
      courses={courses}
      initial={initial}
      onSubmit={async (payload: PostEditorPayload) => {
        const res = await fetch(`/api/posts/${postId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(data?.message ?? `수정 실패 (${res.status})`);
          return;
        }

        // 수정 완료 후 상세로 이동
        window.location.href = `/posts/${postId}`;
      }}
    />
  );
}
