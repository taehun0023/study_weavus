import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardHeader from "@/components/dashboard-header";
import JapaneseWritingPractice from "@/components/japanese-writing/japanese-writing-practice";

export const dynamic = "force-dynamic";

export default async function JapaneseWritingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-6 md:py-8">
        <section className="mx-auto max-w-4xl">
          <JapaneseWritingPractice />
        </section>
      </main>
    </div>
  );
}

