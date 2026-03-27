'use client';

// All recharts imports are isolated here so next/dynamic can split them into
// a separate lazy chunk -- keeps the main /dashboard/[id] page chunk small.
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

export function QuestionAccuracyChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis dataKey="question" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
        <Tooltip
          cursor={{ fill: '#27272a' }}
          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }}
          formatter={(val: any) => [`${val}%`, 'Correct']}
          labelFormatter={(label: any, payload: readonly any[]) => payload?.[0]?.payload?.fullQuestion || label}
        />
        <Bar dataKey="pct" fill="#1f1bc3" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ResponsesOverTimeChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
        <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip cursor={{ fill: '#27272a' }} contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
        <Bar dataKey="count" fill="#1f1bc3" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
