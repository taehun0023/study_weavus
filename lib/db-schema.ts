// lib/db-schema.ts
export const DB_SCHEMA = "public" as const

export const T = {
  users: `${DB_SCHEMA}.users`,
  posts: `${DB_SCHEMA}.posts`,
  quizzes: `${DB_SCHEMA}.quizzes`,
  // 필요한 테이블 추가
} as const
