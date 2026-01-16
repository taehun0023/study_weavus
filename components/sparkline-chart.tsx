"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export function SparklineChart({
  data,
  height = 120,
}: {
  data: { day: string; value: number }[];
  height?: number;
}) {
  if (!data || data.length === 0) {
    return <div className="text-sm text-neutral-400">데이터가 없습니다.</div>;
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" tickMargin={8} tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} width={30} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
