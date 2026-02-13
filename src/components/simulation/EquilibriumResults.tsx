import { EquilibriumResult, EquilibriumParams, countChannelTypes } from "@/lib/equilibrium";
import { MetricCard } from "./MetricCard";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, TrendingUp, AlertTriangle, Target, Zap } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface EquilibriumResultsProps {
  result: EquilibriumResult | null;
  params: EquilibriumParams;
}

const DEFENDER_COLORS = [
  "hsl(var(--primary))",
  "hsl(175, 70%, 40%)",
  "hsl(190, 70%, 45%)",
  "hsl(200, 70%, 50%)",
  "hsl(210, 70%, 55%)",
];

const ATTACKER_COLORS = [
  "hsl(var(--jammer))",
  "hsl(25, 90%, 55%)",
  "hsl(35, 90%, 50%)",
  "hsl(45, 90%, 45%)",
  "hsl(15, 90%, 60%)",
];

const CHANNEL_TYPE_COLORS: Record<string, string> = {
  real: "hsl(var(--primary))",
  decoy: "hsl(var(--secondary))",
  inactive: "hsl(var(--muted))",
};

export function EquilibriumResults({ result, params }: EquilibriumResultsProps) {
  if (!result) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-muted-foreground">
          Configure parameters and run equilibrium computation to see results.
        </p>
      </div>
    );
  }

  const totalDefenderUtility = result.defenders.reduce((s, d) => s + d.utility, 0);
  const totalAttackerUtility = result.attackers.reduce((s, a) => s + a.utility, 0);
  const counts = countChannelTypes(params.channelConfig);
  const { metrics } = result;

  // Prepare convergence chart data
  const convergenceData = result.convergenceHistory.map((h) => ({
    iteration: h.iter,
    maxChange: h.maxChange,
    ...h.defenderUtilities.reduce((acc, u, i) => ({ ...acc, [`D${i + 1}`]: u }), {}),
  }));

  // Prepare per-player delta data
  const deltaData = result.convergenceHistory.slice(-20).map((h) => ({
    iteration: h.iter,
    ...h.defenderDeltas.reduce((acc, d, i) => ({ ...acc, [`D${i + 1} Δ`]: d }), {}),
    ...h.attackerDeltas.reduce((acc, d, i) => ({ ...acc, [`A${i + 1} Δ`]: d }), {}),
  }));

  // Prepare channel allocation data
  const channelData = result.channelSummary.map((ch) => ({
    channel: `Ch ${ch.channel + 1}`,
    defenderPower: ch.totalDefenderPower,
    attackerPower: ch.totalAttackerPower,
    owner: ch.owner,
    channelType: ch.channelType,
    rate: ch.rate,
    sinr: ch.sinr,
    isActive: ch.isActive,
  }));

  return (
    <div className="space-y-6">
      {/* Convergence Status */}
      <div className="panel p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {result.converged ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <div>
                  <span className="font-semibold text-green-600">Converged</span>
                  <p className="text-sm text-muted-foreground">
                    After {result.iterations} iterations (Δ = {result.maxChange.toExponential(2)})
                  </p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-amber-500" />
                <div>
                  <span className="font-semibold text-amber-600">Not Converged</span>
                  <p className="text-sm text-muted-foreground">
                    Reached max {result.iterations} iterations (Δ = {result.maxChange.toExponential(2)})
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge 
              variant={result.converged ? "default" : "secondary"}
              className={result.converged ? "bg-green-500/15 text-green-600 border-green-500/30" : "bg-amber-500/15 text-amber-600 border-amber-500/30"}
            >
              ε = {params.epsilon}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {params.jammerStrategy.replace('_', ': ')}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {params.jammerObjective === 'oracle' ? '👁️ Oracle' : '🎭 Deception'}
            </Badge>
          </div>
        </div>
        
        {/* Warnings */}
        {metrics.symmetricEquilibrium && (
          <div className="mt-3 flex items-center gap-2 text-amber-600 bg-amber-500/10 p-2 rounded text-sm">
            <AlertTriangle className="w-4 h-4" />
            Symmetric equilibrium detected - all players converged to similar allocations
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Total Defender Utility"
          value={totalDefenderUtility}
          variant="primary"
        />
        <MetricCard
          label="Jammer Waste on Decoys"
          value={`${(metrics.jammerWasteOnDecoys * 100).toFixed(1)}%`}
          variant="secondary"
          tooltip="Fraction of jammer power wasted on decoy channels"
        />
        <MetricCard
          label="Dilution Factor"
          value={metrics.dilutionFactor.toFixed(2)}
          tooltip={`|A|/|R| = ${metrics.activeChannelCount}/${metrics.realChannelCount}`}
        />
        <MetricCard
          label="Real Throughput"
          value={metrics.totalRealThroughput.toFixed(3)}
          unit="bps/Hz"
          variant="primary"
        />
        <MetricCard
          label="Active Channels"
          value={metrics.activeChannelCount}
          tooltip={`${counts.real} real + ${counts.decoy} decoy`}
        />
        <MetricCard
          label="Iterations"
          value={result.iterations}
        />
      </div>

      {/* Per-Player Utilities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="panel p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            Defender Utilities
          </h4>
          <div className="space-y-2">
            {result.defenders.map((d, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">Defender {d.playerId + 1}</span>
                  <span className="text-xs text-muted-foreground">
                    ({params.channelConfig.filter(c => c.owner === i && c.type === 'real').length}R /
                    {params.channelConfig.filter(c => c.owner === i && c.type === 'decoy').length}D)
                  </span>
                </div>
                <Badge variant="outline" className="font-mono">
                  {d.utility.toFixed(4)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-jammer" />
            Attacker Utilities
          </h4>
          <div className="space-y-2">
            {result.attackers.map((a, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">Attacker {a.playerId + 1}</span>
                  <Badge variant="outline" className="text-[10px]">
                    P = {params.PJ[i]}W
                  </Badge>
                </div>
                <Badge variant="outline" className="font-mono">
                  {a.utility.toFixed(4)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Convergence Chart */}
      <div className="panel">
        <h3 className="panel-header flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Convergence History
        </h3>
        <div className="p-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={convergenceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="iteration" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              {result.defenders.map((_, i) => (
                <Line
                  key={`D${i + 1}`}
                  type="monotone"
                  dataKey={`D${i + 1}`}
                  stroke={DEFENDER_COLORS[i % DEFENDER_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  name={`Defender ${i + 1}`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-Player Delta Chart */}
      <div className="panel">
        <h3 className="panel-header flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Per-Player Convergence (Last 20 Iterations)
        </h3>
        <div className="p-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={deltaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="iteration" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickFormatter={(v) => v.toExponential(0)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => value.toExponential(3)}
              />
              <Legend />
              {result.defenders.map((_, i) => (
                <Line
                  key={`D${i + 1} Δ`}
                  type="monotone"
                  dataKey={`D${i + 1} Δ`}
                  stroke={DEFENDER_COLORS[i % DEFENDER_COLORS.length]}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
              ))}
              {result.attackers.map((_, i) => (
                <Line
                  key={`A${i + 1} Δ`}
                  type="monotone"
                  dataKey={`A${i + 1} Δ`}
                  stroke={ATTACKER_COLORS[i % ATTACKER_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Channel Allocation */}
      <div className="panel">
        <h3 className="panel-header flex items-center gap-2">
          <Target className="w-4 h-4" />
          Channel Power Distribution
        </h3>
        <div className="p-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={channelData} barGap={0}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="channel" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [value.toFixed(3), name]}
              />
              <Legend />
              <Bar 
                dataKey="defenderPower" 
                name="Defender Power" 
                stackId="a"
              >
                {channelData.map((entry, index) => (
                  <Cell 
                    key={`defender-${index}`} 
                    fill={CHANNEL_TYPE_COLORS[entry.channelType]}
                    opacity={entry.isActive ? 1 : 0.3}
                  />
                ))}
              </Bar>
              <Bar 
                dataKey="attackerPower" 
                name="Attacker Power" 
                fill="hsl(var(--jammer))"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Channel Type Legend */}
        <div className="px-4 pb-3 flex gap-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: CHANNEL_TYPE_COLORS.real }} />
            Real
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: CHANNEL_TYPE_COLORS.decoy }} />
            Decoy
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded opacity-30" style={{ backgroundColor: CHANNEL_TYPE_COLORS.inactive }} />
            Inactive
          </span>
        </div>
      </div>

      {/* Channel Details Table */}
      <div className="panel">
        <h3 className="panel-header">Equilibrium Channel Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-mono text-xs text-muted-foreground">Ch</th>
                <th className="px-3 py-2 text-left font-mono text-xs text-muted-foreground">Type</th>
                <th className="px-3 py-2 text-left font-mono text-xs text-muted-foreground">Owner</th>
                <th className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">Def Pwr</th>
                <th className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">Att Pwr</th>
                <th className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">SINR</th>
                <th className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">Rate</th>
                <th className="px-3 py-2 text-center font-mono text-xs text-muted-foreground">Active</th>
              </tr>
            </thead>
            <tbody>
              {result.channelSummary.slice(0, 24).map((ch) => (
                <tr 
                  key={ch.channel} 
                  className={`border-b border-border/50 hover:bg-muted/30 ${
                    ch.channelType === 'inactive' ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-3 py-1.5 font-mono">{ch.channel + 1}</td>
                  <td className="px-3 py-1.5">
                    <Badge 
                      variant="outline" 
                      className="text-[10px]"
                      style={{ 
                        backgroundColor: `${CHANNEL_TYPE_COLORS[ch.channelType]}20`,
                        borderColor: CHANNEL_TYPE_COLORS[ch.channelType],
                      }}
                    >
                      {ch.channelType}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5">
                    <Badge 
                      variant="outline" 
                      className="text-xs"
                      style={{ 
                        backgroundColor: `${DEFENDER_COLORS[ch.owner % DEFENDER_COLORS.length]}20`,
                        borderColor: DEFENDER_COLORS[ch.owner % DEFENDER_COLORS.length],
                      }}
                    >
                      D{ch.owner + 1}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-primary">
                    {ch.totalDefenderPower.toFixed(3)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-jammer">
                    {ch.totalAttackerPower.toFixed(3)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {ch.sinr.toFixed(3)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-primary">
                    {ch.rate.toFixed(4)}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {ch.isActive ? (
                      <span className="text-green-500">●</span>
                    ) : (
                      <span className="text-muted-foreground">○</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
