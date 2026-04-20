import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardHeader from "@/components/dashboard-header";
import JapaneseSpeakingPractice from "@/components/japanese-speaking/japanese-speaking-practice";

export const dynamic = "force-dynamic";

export default async function JapaneseSpeakingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-6 md:py-8">
        <section className="mx-auto max-w-4xl">
          <JapaneseSpeakingPractice />
        </section>
      </main>
    </div>
  );
}

