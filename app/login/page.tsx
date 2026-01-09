// app/login/page.tsx
import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold tracking-tight">Study</h1>
          <p className="text-muted-foreground mt-3">학습 플랫폼에 로그인하세요</p>
        </div>

        <LoginForm />
      </div>
    </div>
  )
}
