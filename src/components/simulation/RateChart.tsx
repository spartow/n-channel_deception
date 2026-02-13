import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface RateChartProps {
  rates: number[];
  sinr: number[];
  channelTypes: ("real" | "decoy" | "inactive")[];
  title: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    payload: {
      channel: number;
      rate: number;
      sinr: number;
      type: string;
    };
  }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const typeColors = {
    real: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30" },
    decoy: { bg: "bg-secondary/10", text: "text-secondary", border: "border-secondary/30" },
    inactive: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
  };

  const style = typeColors[data.type as keyof typeof typeColors] || typeColors.inactive;

  return (
    <div className={`${style.bg} ${style.border} border rounded-lg p-3 shadow-lg bg-card`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono font-bold">Channel {data.channel}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${style.text}`}>
          {data.type}
        </span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Rate (R):</span>
          <span className="font-mono font-medium text-primary">{data.rate.toFixed(4)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">SINR:</span>
          <span className="font-mono font-medium">{data.sinr.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
};

export function RateChart({ rates, sinr, channelTypes, title }: RateChartProps) {
  const data = rates.map((rate, i) => ({
    channel: i + 1,
    rate,
    sinr: sinr[i],
    type: channelTypes[i],
    isReal: channelTypes[i] === "real",
    isDecoy: channelTypes[i] === "decoy",
  }));

  return (
    <div className="panel p-4">
      <h3 className="panel-header mb-4 -mx-4 -mt-4 rounded-t-lg">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220, 15%, 88%)"
            />
            <XAxis
              dataKey="channel"
              stroke="hsl(215, 15%, 55%)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 15%, 85%)" }}
            />
            <YAxis
              stroke="hsl(215, 15%, 55%)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 15%, 85%)" }}
              tickFormatter={(v) => v.toFixed(2)}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="hsl(220, 15%, 80%)" />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="hsl(185, 70%, 45%)"
              strokeWidth={2}
              animationDuration={600}
              animationEasing="ease-out"
              dot={(props) => {
                const { cx, cy, payload } = props;
                const color =
                  payload.type === "real"
                    ? "hsl(185, 70%, 45%)"
                    : payload.type === "decoy"
                    ? "hsl(38, 90%, 50%)"
                    : "hsl(220, 10%, 75%)";
                return (
                  <circle
                    key={payload.channel}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={color}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                );
              }}
              activeDot={{ r: 6, stroke: "hsl(185, 70%, 45%)", strokeWidth: 2, fill: "white" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}