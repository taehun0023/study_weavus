import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { OverallProgress } from "@/components/overall-progress"
import { CourseCards } from "@/components/course-cards"
import { RecentActivity } from "@/components/recent-activity"

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8 space-y-8">
        <OverallProgress userId={user.id} />
        <CourseCards userId={user.id} />
        <RecentActivity userId={user.id} />
      </main>
    </div>
  )
}
