import { SignupForm } from "@/components/signup-form"

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">회원가입</h1>
          <p className="text-muted-foreground">새 계정을 만들어 학습을 시작하세요</p>
        </div>
        <SignupForm />
      </div>
    </div>
  )
}
