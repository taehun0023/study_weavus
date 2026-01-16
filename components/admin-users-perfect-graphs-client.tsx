"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import PerfectScoreChart, { type PerfectPoint } from "@/components/perfect-score-chart"

type UserSeries = {
  userId: number
  username: string
  displayName: string
  points: PerfectPoint[]
}

export default function AdminUsersPerfectGraphsClient() {
  const [users, setUsers] = useState<UserSeries[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let ignore = false
    ;(async () => {
      const res = await fetch("/api/stats/perfect/admin", { cache: "no-store" })
      if (!res.ok) {
        setLoaded(true)
        return
      }
      const json = await res.json()
      if (ignore) return
      setUsers(Array.isArray(json?.users) ? json.users : [])
      setLoaded(true)
    })()
    return () => {
      ignore = true
    }
  }, [])

  if (!loaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">전체 유저 만점 그래프</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">불러오는 중...</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">전체 유저 만점 그래프</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          최근 30일 기준 (일자별 만점 시도 수)
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {users.map((u) => (
          <Card key={u.userId}>
            <CardHeader>
              <CardTitle className="text-sm">
                {u.displayName} <span className="text-muted-foreground">({u.username})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PerfectScoreChart data={u.points} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
