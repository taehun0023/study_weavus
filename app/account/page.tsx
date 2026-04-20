import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardHeader from "@/components/dashboard-header";
import UserProfileForm from "./user-profile-form";
import JapaneseWritingOkTab from "./japanese-writing-ok-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-xl space-y-6">
          <div>
            <h1 className="page-title">내 계정</h1>
            <p className="page-subtitle">
              아이디/표시 이름/비밀번호를 수정할 수 있습니다.
            </p>
          </div>

          <Tabs defaultValue="profile" className="space-y-4">
            <TabsList>
              <TabsTrigger value="profile">프로필</TabsTrigger>
              <TabsTrigger value="japanese-writing">일본어작문</TabsTrigger>
            </TabsList>
            <TabsContent value="profile">
              <UserProfileForm
                initialUsername={user.username}
                initialDisplayName={user.display_name ?? ""}
              />
            </TabsContent>
            <TabsContent value="japanese-writing">
              <JapaneseWritingOkTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
