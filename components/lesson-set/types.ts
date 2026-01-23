// components/lesson-set/types.ts

export type Course = { id: number; name: string; slug: string };

export type Difficulty = "easy" | "medium" | "project";

export type QuestionType = "multiple_choice" | "true_false" | "number" | "short_answer";

export type AnswerType = "choice" | "boolean" | "number" | "string";

// 공통 퀴즈 문항(UI state)
export type QuizQuestion = {
  /** create 화면에서는 client-side key, edit 화면에서는 DB id(문자열)도 들어올 수 있음 */
  key: string;
  questionText: string; // Quill HTML 저장
  questionType: QuestionType;
  options: string[];
  correctAnswer: string;
  answerType?: AnswerType;
  explanation?: string;
};

export type UploadedFile = {
  id: number;
  name: string;
  url: string;
  size?: number;
  contentType?: string;
};
