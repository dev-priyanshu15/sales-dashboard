import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// All charts are single-series (one measure split by an axis), so
// identity comes from axis labels and ONE validated hue carries the
// marks — no legend needed for a single series.

const SERIES = 'var(--series-1)';
const MUTED = 'var(--text-muted)';
const GRID = 'var(--gridline)';

const money = (v: number) =>
  v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const tooltipStyle = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontSize: 13,
};

export function RevenueBarChart({
  data,
  nameKey,
}: {
  data: Record<string, string | number>[];
  nameKey: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={nameKey} tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tickFormatter={money} tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={false} width={70} />
        <Tooltip
          formatter={(v) => [money(Number(v)), 'Revenue']}
          contentStyle={tooltipStyle}
          cursor={{ fill: 'var(--gridline)', opacity: 0.4 }}
        />
        <Bar dataKey="revenue" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({ data }: { data: { date: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="date" tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tickFormatter={money} tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={false} width={70} />
        <Tooltip formatter={(v) => [money(Number(v)), 'Revenue']} contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke={SERIES}
          strokeWidth={2}
          dot={{ r: 3, fill: SERIES }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
