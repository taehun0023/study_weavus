"use client";

import PostEditor, { Course, Difficulty } from "@/components/post-editor";

type EditClientProps = {
  postId: number;
  courses: Course[];
  initial: {
    title: string;
    content: string;
    courseId: number;
    difficulty: Difficulty;
  };
};

export default function EditClient({
  postId,
  courses,
  initial,
}: EditClientProps) {
  return (
    <PostEditor
      courses={courses}
      // ✅ PostEditor는 initial.id가 있으면 수정 모드(isEdit)로 동작함
      initial={{
        id: postId,
        title: initial.title,
        content: initial.content,
        courseId: initial.courseId,
        difficulty: initial.difficulty,
        // type은 안 넘기면 기본 "lesson"이라 그대로 둬도 됨
        // type: "lesson",
      }}
    />
  );
}
