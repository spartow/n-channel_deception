import { useMemo, useRef, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

interface ChannelAllocationChartProps {
  x: number[];
  y: number[];
  channelTypes: ("real" | "decoy" | "inactive")[];
  title: string;
  showJammer?: boolean;
  animationEnabled?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    payload: {
      channel: number;
      x: number;
      y: number;
      type: string;
    };
  }>;
  label?: string;
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
    <div className={`${style.bg} ${style.border} border rounded-lg p-3 shadow-lg backdrop-blur-sm`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono font-bold">Channel {data.channel}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${style.text} ${style.bg}`}>
          {data.type}
        </span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Defender (x):</span>
          <span className="font-mono font-medium text-primary">{data.x.toFixed(4)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Jammer (y):</span>
          <span className="font-mono font-medium text-jammer">{data.y.toFixed(4)}</span>
        </div>
        {data.x > 0 && (
          <div className="flex justify-between gap-4 pt-1 border-t border-border/50">
            <span className="text-muted-foreground">Status:</span>
            <span className="font-medium text-emerald-600">Active</span>
          </div>
        )}
      </div>
    </div>
  );
};

export function ChannelAllocationChart({
  x,
  y,
  channelTypes,
  title,
  showJammer = true,
  animationEnabled = true,
}: ChannelAllocationChartProps) {
  const [key, setKey] = useState(0);
  const prevDataRef = useRef<string>("");

  // Trigger re-animation when data changes
  useEffect(() => {
    const dataString = JSON.stringify({ x, y, channelTypes });
    if (prevDataRef.current !== dataString) {
      prevDataRef.current = dataString;
      if (animationEnabled) {
        setKey((k) => k + 1);
      }
    }
  }, [x, y, channelTypes, animationEnabled]);

  const data = useMemo(
    () =>
      x.map((xi, i) => ({
        channel: i + 1,
        x: xi,
        y: y[i],
        type: channelTypes[i],
      })),
    [x, y, channelTypes]
  );

  const getBarColor = (type: string) => {
    switch (type) {
      case "real":
        return "hsl(185, 70%, 45%)";
      case "decoy":
        return "hsl(38, 90%, 50%)";
      default:
        return "hsl(220, 10%, 75%)";
    }
  };

  const activeCount = channelTypes.filter((t) => t !== "inactive").length;

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-4 -mx-4 -mt-4 px-4 py-3 border-b border-border bg-muted/30 rounded-t-lg">
        <h3 className="font-mono text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {animationEnabled && (
            <span className="live-indicator bg-emerald-50 text-emerald-700">
              Live
            </span>
          )}
          <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded">
            Active: {activeCount}
          </span>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%" key={key}>
          <BarChart data={data} barGap={0} barCategoryGap="10%">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220, 15%, 88%)"
              vertical={false}
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
              tickFormatter={(v) => v.toFixed(1)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(value) =>
                value === "x" ? "Defender Allocation" : "Jammer Allocation"
              }
            />
            <Bar
              dataKey="x"
              name="x"
              radius={[3, 3, 0, 0]}
              animationDuration={animationEnabled ? 600 : 0}
              animationEasing="ease-out"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.type)} />
              ))}
            </Bar>
            {showJammer && (
              <Bar
                dataKey="y"
                name="y"
                fill="hsl(340, 70%, 50%)"
                radius={[3, 3, 0, 0]}
                opacity={0.85}
                animationDuration={animationEnabled ? 600 : 0}
                animationEasing="ease-out"
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(185, 70%, 45%)" }} />
          <span className="text-muted-foreground">Real</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(38, 90%, 50%)" }} />
          <span className="text-muted-foreground">Decoy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(220, 10%, 75%)" }} />
          <span className="text-muted-foreground">Inactive</span>
        </div>
        {showJammer && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(340, 70%, 50%)" }} />
            <span className="text-muted-foreground">Jammer</span>
          </div>
        )}
      </div>
    </div>
  );
}