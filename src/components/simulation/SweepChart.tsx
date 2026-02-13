import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Area,
  ComposedChart,
} from "recharts";

interface SweepChartProps {
  NDValues: number[];
  U_realValues: number[];
  bestND: number;
  bestU_real: number;
  title: string;
}

export function SweepChart({
  NDValues,
  U_realValues,
  bestND,
  bestU_real,
  title,
}: SweepChartProps) {
  const data = NDValues.map((nd, i) => ({
    ND: nd,
    U_real: U_realValues[i],
    isBest: nd === bestND,
  }));

  return (
    <div className="panel p-4">
      <h3 className="panel-header mb-4 -mx-4 -mt-4 rounded-t-lg">{title}</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(185, 80%, 50%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(185, 80%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220, 15%, 20%)"
            />
            <XAxis
              dataKey="ND"
              stroke="hsl(215, 15%, 45%)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 15%, 20%)" }}
              label={{
                value: "ND (Decoy Channels)",
                position: "insideBottom",
                offset: -5,
                fill: "hsl(215, 15%, 55%)",
                fontSize: 11,
              }}
            />
            <YAxis
              stroke="hsl(215, 15%, 45%)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 15%, 20%)" }}
              tickFormatter={(v) => v.toFixed(2)}
              label={{
                value: "U_real",
                angle: -90,
                position: "insideLeft",
                fill: "hsl(215, 15%, 55%)",
                fontSize: 11,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 12%)",
                border: "1px solid hsl(220, 15%, 20%)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(210, 20%, 92%)" }}
              formatter={(value: number) => [value.toFixed(4), "U_real"]}
              labelFormatter={(label) => `ND = ${label}`}
            />
            <Area
              type="monotone"
              dataKey="U_real"
              fill="url(#areaGradient)"
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="U_real"
              stroke="hsl(185, 80%, 50%)"
              strokeWidth={2}
              dot={{ fill: "hsl(185, 80%, 50%)", r: 3 }}
              activeDot={{ r: 6, stroke: "hsl(185, 80%, 60%)", strokeWidth: 2 }}
            />
            <ReferenceDot
              x={bestND}
              y={bestU_real}
              r={8}
              fill="hsl(38, 92%, 55%)"
              stroke="hsl(38, 92%, 70%)"
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-muted-foreground">U_real vs ND</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-secondary border-2 border-secondary/50" />
          <span className="text-muted-foreground">
            Optimal: ND* = {bestND}
          </span>
        </div>
      </div>
    </div>
  );
}