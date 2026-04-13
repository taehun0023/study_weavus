// app/login/page.tsx
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[28rem] w-[28rem] rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/15 border border-primary/25 mb-4">
            <span className="text-lg font-bold text-primary">S</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Study</h1>
          <p className="text-sm text-muted-foreground mt-1">학습 플랫폼에 로그인하세요</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-2xl shadow-black/30">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
