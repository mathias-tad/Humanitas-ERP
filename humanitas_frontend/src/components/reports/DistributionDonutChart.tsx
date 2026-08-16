import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

export interface DistributionItem {
  name: string;
  value: number;
  color?: string;
}

export interface DistributionDonutChartProps {
  title: string;
  subtitle?: string;
  data: DistributionItem[];
  height?: number;
  valuePrefix?: string;
  valueSuffix?: string;
}

const DEFAULT_COLORS = [
  "var(--primary)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.65 0.18 145)",
];

export const DistributionDonutChart: React.FC<DistributionDonutChartProps> = ({
  title,
  subtitle,
  data,
  height = 280,
  valuePrefix = "",
  valueSuffix = "",
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
                borderRadius: "0.5rem",
                fontSize: "12px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              formatter={(val: any, name: any) => {
                const percent = total > 0 ? ((Number(val) / total) * 100).toFixed(1) : "0";
                return [
                  `${valuePrefix}${Number(val).toLocaleString()}${valueSuffix} (${percent}%)`,
                  name,
                ];
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-xs text-muted-foreground font-medium">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
