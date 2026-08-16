import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface BarDataPoint {
  category: string;
  primaryValue: number;
  secondaryValue?: number;
  [key: string]: any;
}

export interface ComparisonBarChartProps {
  title: string;
  subtitle?: string;
  data: BarDataPoint[];
  primaryKey?: string;
  secondaryKey?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  height?: number;
  valuePrefix?: string;
  valueSuffix?: string;
}

export const ComparisonBarChart: React.FC<ComparisonBarChartProps> = ({
  title,
  subtitle,
  data,
  primaryKey = "primaryValue",
  secondaryKey,
  primaryLabel = "Current Period",
  secondaryLabel = "Prior Period",
  primaryColor = "var(--primary)",
  secondaryColor = "var(--chart-2)",
  height = 280,
  valuePrefix = "",
  valueSuffix = "",
}) => {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
            <XAxis
              dataKey="category"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v) => `${valuePrefix}${v}${valueSuffix}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
                borderRadius: "0.5rem",
                fontSize: "12px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              formatter={(val: any, name: any) => [
                `${valuePrefix}${Number(val).toLocaleString()}${valueSuffix}`,
                name === primaryKey ? primaryLabel : secondaryLabel,
              ]}
            />
            {secondaryKey && (
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground font-medium">
                    {value === primaryKey ? primaryLabel : secondaryLabel}
                  </span>
                )}
              />
            )}
            <Bar
              dataKey={primaryKey}
              fill={primaryColor}
              radius={[4, 4, 0, 0]}
              maxBarSize={45}
            />
            {secondaryKey && (
              <Bar
                dataKey={secondaryKey}
                fill={secondaryColor}
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
