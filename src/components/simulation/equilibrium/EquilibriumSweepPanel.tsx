import { useState, useCallback } from "react";
import { 
  EquilibriumParams, 
  SweepVariable,
  EquilibriumSweepResult,
  SweepPoint,
  runEquilibrium,
  countChannelTypes,
  ChannelConfig,
} from "@/lib/equilibrium";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ParameterSlider } from "../ParameterSlider";
import { BarChart3, Loader2, Play, TrendingUp, Download } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useToast } from "@/hooks/use-toast";

interface EquilibriumSweepPanelProps {
  params: EquilibriumParams;
}

const SWEEP_VARIABLES: { value: SweepVariable; label: string; description: string }[] = [
  { value: 'ND', label: 'Decoys (N_D)', description: 'Number of decoy channels' },
  { value: 'tau', label: 'Threshold (τ)', description: 'Sensing threshold' },
  { value: 'N', label: 'Total Channels (N)', description: 'Total channel count' },
  { value: 'M', label: 'Attackers (M)', description: 'Number of jammers' },
  { value: 'D', label: 'Defenders (D)', description: 'Number of defenders' },
  { value: 'PJ', label: 'Jammer Power (P_J)', description: 'Total jammer power' },
];

export function EquilibriumSweepPanel({ params }: EquilibriumSweepPanelProps) {
  const { toast } = useToast();
  const [sweepVariable, setSweepVariable] = useState<SweepVariable>('ND');
  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(8);
  const [rangeStep, setRangeStep] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<SweepPoint[]>([]);
  const [baseline, setBaseline] = useState<SweepPoint | null>(null);
  const [bestPoint, setBestPoint] = useState<SweepPoint | null>(null);

  const generateRange = () => {
    const points: number[] = [];
    for (let v = rangeMin; v <= rangeMax; v += rangeStep) {
      points.push(v);
    }
    return points;
  };

  const modifyParamsForSweep = (
    baseParams: EquilibriumParams, 
    variable: SweepVariable, 
    value: number
  ): EquilibriumParams => {
    const newParams = { ...baseParams };
    
    switch (variable) {
      case 'ND': {
        // Modify channel config to have 'value' number of decoys
        const counts = countChannelTypes(baseParams.channelConfig);
        const targetDecoys = Math.min(value, baseParams.N - counts.real);
        
        let currentDecoys = 0;
        newParams.channelConfig = baseParams.channelConfig.map(c => {
          if (c.type === 'real') return c;
          if (currentDecoys < targetDecoys) {
            currentDecoys++;
            return { ...c, type: 'decoy' as const };
          }
          return { ...c, type: 'inactive' as const };
        });
        break;
      }
      case 'tau':
        newParams.tau = value;
        break;
      case 'N': {
        const newN = Math.max(4, Math.round(value));
        if (newN !== baseParams.N) {
          newParams.N = newN;
          // Adjust arrays
          newParams.h = baseParams.h.map(row => {
            if (newN > row.length) return [...row, ...Array(newN - row.length).fill(1)];
            return row.slice(0, newN);
          });
          newParams.g = baseParams.g.map(row => {
            if (newN > row.length) return [...row, ...Array(newN - row.length).fill(1)];
            return row.slice(0, newN);
          });
          // Adjust channel config
          if (newN > baseParams.channelConfig.length) {
            const additional: ChannelConfig[] = Array.from(
              { length: newN - baseParams.channelConfig.length },
              (_, i) => ({ type: 'inactive' as const, owner: i % baseParams.D })
            );
            newParams.channelConfig = [...baseParams.channelConfig, ...additional];
          } else {
            newParams.channelConfig = baseParams.channelConfig.slice(0, newN);
          }
        }
        break;
      }
      case 'M': {
        const newM = Math.max(1, Math.round(value));
        newParams.M = newM;
        if (newM > baseParams.M) {
          for (let m = baseParams.M; m < newM; m++) {
            newParams.PJ.push(10);
            newParams.g.push(Array(baseParams.N).fill(1));
          }
        } else {
          newParams.PJ = baseParams.PJ.slice(0, newM);
          newParams.g = baseParams.g.slice(0, newM);
        }
        break;
      }
      case 'D': {
        const newD = Math.max(1, Math.round(value));
        newParams.D = newD;
        if (newD > baseParams.D) {
          for (let d = baseParams.D; d < newD; d++) {
            newParams.PT.push(10);
            newParams.h.push(Array(baseParams.N).fill(1));
          }
        } else {
          newParams.PT = baseParams.PT.slice(0, newD);
          newParams.h = baseParams.h.slice(0, newD);
        }
        // Reassign orphaned channels
        newParams.channelConfig = baseParams.channelConfig.map(c => 
          c.owner >= newD ? { ...c, owner: c.owner % newD } : c
        );
        break;
      }
      case 'PJ': {
        // Distribute value evenly across attackers
        const perAttacker = value / baseParams.M;
        newParams.PJ = Array(baseParams.M).fill(perAttacker);
        break;
      }
    }
    
    return newParams;
  };

  const runSweep = useCallback(async () => {
    setIsRunning(true);
    const range = generateRange();
    const points: SweepPoint[] = [];
    
    try {
      // Run baseline (ND=0 or min value)
      const baselineParams = modifyParamsForSweep(params, sweepVariable, rangeMin);
      const baselineResult = await runEquilibrium(baselineParams);
      const baselinePoint: SweepPoint = {
        variable: rangeMin,
        U_real: baselineResult.metrics.totalRealThroughput,
        dilutionFactor: baselineResult.metrics.dilutionFactor,
        jammerWaste: baselineResult.metrics.jammerWasteOnDecoys,
        converged: baselineResult.converged,
        iterations: baselineResult.iterations,
      };
      setBaseline(baselinePoint);

      let best: SweepPoint = baselinePoint;

      for (const val of range) {
        try {
          const modifiedParams = modifyParamsForSweep(params, sweepVariable, val);
          const result = await runEquilibrium(modifiedParams);
          
          const point: SweepPoint = {
            variable: val,
            U_real: result.metrics.totalRealThroughput,
            dilutionFactor: result.metrics.dilutionFactor,
            jammerWaste: result.metrics.jammerWasteOnDecoys,
            converged: result.converged,
            iterations: result.iterations,
          };
          
          if (point.U_real > best.U_real) {
            best = point;
          }
          
          points.push(point);
        } catch (error) {
          console.error(`Sweep point ${val} failed:`, error);
          points.push({
            variable: val,
            U_real: 0,
            dilutionFactor: 0,
            jammerWaste: 0,
            converged: false,
            iterations: 0,
          });
        }
      }
      
      setResults(points);
      setBestPoint(best);
      
      toast({
        title: "Sweep Complete",
        description: `Best ${sweepVariable} = ${best.variable} with U_real = ${best.U_real.toFixed(4)}`,
      });
    } catch (error) {
      toast({
        title: "Sweep Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  }, [params, sweepVariable, rangeMin, rangeMax, rangeStep, toast]);

  const chartData = results.map(p => ({
    x: p.variable,
    U_real: p.U_real,
    jammerWaste: p.jammerWaste * 100,
    dilution: p.dilutionFactor,
  }));

  const exportCSV = () => {
    const headers = ['Variable', 'U_real', 'Jammer_Waste_%', 'Dilution_Factor', 'Converged', 'Iterations'];
    const rows = results.map(p => [
      p.variable,
      p.U_real.toFixed(6),
      (p.jammerWaste * 100).toFixed(2),
      p.dilutionFactor.toFixed(3),
      p.converged ? 'Yes' : 'No',
      p.iterations,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equilibrium-sweep-${sweepVariable}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Downloaded", description: `equilibrium-sweep-${sweepVariable}.csv` });
  };

  return (
    <div className="panel">
      <h3 className="panel-header flex items-center gap-2">
        <BarChart3 className="w-4 h-4" />
        Equilibrium Sweep Study
      </h3>
      
      <div className="p-4 space-y-4">
        {/* Sweep Configuration */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Sweep Variable
            </label>
            <Select value={sweepVariable} onValueChange={(v) => setSweepVariable(v as SweepVariable)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SWEEP_VARIABLES.map(v => (
                  <SelectItem key={v.value} value={v.value}>
                    <div className="flex flex-col">
                      <span>{v.label}</span>
                      <span className="text-xs text-muted-foreground">{v.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-end">
            <Button
              onClick={runSweep}
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Sweep
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Range Controls */}
        <div className="grid grid-cols-3 gap-3">
          <ParameterSlider
            label="Min"
            value={rangeMin}
            onChange={setRangeMin}
            min={0}
            max={rangeMax - 1}
            step={sweepVariable === 'tau' ? 0.1 : 1}
          />
          <ParameterSlider
            label="Max"
            value={rangeMax}
            onChange={setRangeMax}
            min={rangeMin + 1}
            max={sweepVariable === 'tau' ? 2 : 20}
            step={sweepVariable === 'tau' ? 0.1 : 1}
          />
          <ParameterSlider
            label="Step"
            value={rangeStep}
            onChange={setRangeStep}
            min={sweepVariable === 'tau' ? 0.05 : 1}
            max={sweepVariable === 'tau' ? 0.5 : 5}
            step={sweepVariable === 'tau' ? 0.05 : 1}
          />
        </div>

        {/* Results Summary */}
        {bestPoint && baseline && (
          <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Best {sweepVariable}</div>
              <div className="font-mono font-bold text-primary">{bestPoint.variable}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Best U_real</div>
              <div className="font-mono font-bold">{bestPoint.U_real.toFixed(4)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">vs Baseline</div>
              <div className="font-mono font-bold text-green-600">
                {baseline.U_real > 0 
                  ? `+${(((bestPoint.U_real - baseline.U_real) / baseline.U_real) * 100).toFixed(1)}%`
                  : 'N/A'
                }
              </div>
            </div>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="x" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  label={{ value: sweepVariable, position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="hsl(var(--primary))"
                  fontSize={12}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--secondary))"
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
                {bestPoint && (
                  <ReferenceLine
                    x={bestPoint.variable}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="4 4"
                    yAxisId="left"
                  />
                )}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="U_real"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                  name="Real Throughput"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="jammerWaste"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={false}
                  name="Jammer Waste (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Export Button */}
        {results.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportCSV} className="w-full">
            <Download className="w-3 h-3 mr-2" />
            Export CSV
          </Button>
        )}
      </div>
    </div>
  );
}
