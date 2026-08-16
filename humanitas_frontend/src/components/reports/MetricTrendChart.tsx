import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface DataPoint {
  date: string;
  value: number;
  secondaryValue?: number;
  [key: string]: any;
}

export interface MetricTrendChartProps {
  title: string;
  subtitle?: string;
  data: DataPoint[];
  dataKey?: string;
  secondaryKey?: string;
  dataLabel?: string;
  secondaryLabel?: string;
  color?: string;
  secondaryColor?: string;
  height?: number;
  valuePrefix?: string;
  valueSuffix?: string;
}

export const MetricTrendChart: React.FC<MetricTrendChartProps> = ({
  title,
  subtitle,
  data,
  dataKey = "value",
  secondaryKey,
  dataLabel = "Value",
  secondaryLabel = "Target",
  color = "var(--primary)",
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
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0.0} />
              </linearGradient>
              {secondaryKey && (
                <linearGradient id={`grad-${secondaryKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={secondaryColor} stopOpacity={0.0} />
                </linearGradient>
              )}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
            <XAxis
              dataKey="date"
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
                name === dataKey ? dataLabel : (secondaryLabel || name),
              ]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#grad-${dataKey})`}
            />
            {secondaryKey && (
              <Area
                type="monotone"
                dataKey={secondaryKey}
                stroke={secondaryColor}
                strokeWidth={2}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill={`url(#grad-${secondaryKey})`}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
