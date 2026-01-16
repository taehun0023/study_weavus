import AdminUsersProgressOverviewClient from "@/components/admin-users-progress-overview-client"

export default async function AdminUsersProgressOverview() {
  // 클라이언트에서 course/from/to를 선택하면서 API를 호출하는 구조라
  // 서버 컴포넌트는 UI 컨테이너 역할만 수행
  return <AdminUsersProgressOverviewClient />
}
