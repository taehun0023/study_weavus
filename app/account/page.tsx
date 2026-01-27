import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardHeader from "@/components/dashboard-header";
import UserProfileForm from "./user-profile-form";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold">내 계정</h1>
            <p className="text-muted-foreground text-sm mt-1">
              아이디/표시 이름을 수정할 수 있습니다.
            </p>
          </div>

          <UserProfileForm
            initialUsername={user.username}
            initialDisplayName={user.display_name ?? ""}
          />
        </div>
      </main>
    </div>
  );
}
