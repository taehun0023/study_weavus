import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Study</h1>
          <p className="text-muted-foreground">학습 플랫폼에 로그인하세요</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
