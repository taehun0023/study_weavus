"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ArrowLeft, ArrowRight, Send, Loader2 } from "lucide-react"

interface Question {
  id: number
  questionText: string
  questionType: "multiple_choice" | "short_answer"
  options: string[] | null
}

interface Quiz {
  id: number
  title: string
  difficulty: string | null
  courseName: string
  courseSlug: string
}

interface QuizContainerProps {
  quiz: Quiz
  questions: Question[]
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function QuizContainer({ quiz, questions }: QuizContainerProps) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Randomize questions on mount
  const randomizedQuestions = useMemo(() => shuffleArray(questions), [questions])

  const currentQuestion = randomizedQuestions[currentIndex]
  const totalQuestions = randomizedQuestions.length
  const progress = ((currentIndex + 1) / totalQuestions) * 100

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/quiz/${quiz.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          questionOrder: randomizedQuestions.map((q) => q.id),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        router.push(`/quiz/${quiz.id}/result/${data.attemptId}`)
      } else {
        alert(data.error || "제출 중 오류가 발생했습니다.")
      }
    } catch {
      alert("서버 연결에 실패했습니다.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const answeredCount = Object.keys(answers).length
  const allAnswered = answeredCount === totalQuestions

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/posts?course=${quiz.courseSlug}`}>
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            목록으로
          </Button>
        </Link>
        <Badge variant="secondary">{quiz.courseName}</Badge>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-xl text-foreground">{quiz.title}</CardTitle>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / {totalQuestions}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="min-h-[200px]">
            <p className="text-lg font-medium text-foreground mb-6">{currentQuestion.questionText}</p>

            {currentQuestion.questionType === "multiple_choice" && currentQuestion.options ? (
              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
              >
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
                    >
                      <RadioGroupItem value={option} id={`option-${index}`} />
                      <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer text-foreground">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            ) : (
              <Input
                type="text"
                placeholder="답을 입력하세요"
                value={answers[currentQuestion.id] || ""}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                className="max-w-md"
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              이전
            </Button>

            {currentIndex === totalQuestions - 1 ? (
              <Button onClick={handleSubmit} disabled={!allAnswered || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    제출 중...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    제출 ({answeredCount}/{totalQuestions})
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleNext}>
                다음
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 justify-center">
        {randomizedQuestions.map((q, index) => (
          <button
            type="button"
            key={q.id}
            onClick={() => setCurrentIndex(index)}
            className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              index === currentIndex
                ? "bg-primary text-primary-foreground"
                : answers[q.id]
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-secondary text-secondary-foreground"
            }`}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  )
}
