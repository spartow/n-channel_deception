import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { ControlPanel } from "@/components/simulation/ControlPanel";
import { MetricCard } from "@/components/simulation/MetricCard";
import { ChannelAllocationChart } from "@/components/simulation/ChannelAllocationChart";
import { RateChart } from "@/components/simulation/RateChart";
import {
  SimulationParams,
  SingleRunResult,
  generateDefaultParams,
  generateRandomChannelGains,
  runSimulation,
} from "@/lib/simulation";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function PlaygroundPage() {
  const { toast } = useToast();
  const [params, setParams] = useState<SimulationParams>(generateDefaultParams());
  const [result, setResult] = useState<SingleRunResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(true);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const prevNDRef = useRef<number>(params.ND);
  const prevTauRef = useRef<number>(params.tau);

  // Validate params
  useEffect(() => {
    const minPowerNeeded = params.ND * params.tau;
    if (minPowerNeeded > params.PT) {
      setValidationError(
        `Invalid: ND × τ (${minPowerNeeded.toFixed(2)}) exceeds PT (${params.PT})`
      );
    } else if (params.ND > params.N - params.NR) {
      setValidationError(
        `Invalid: ND (${params.ND}) exceeds available channels (${params.N - params.NR})`
      );
    } else {
      setValidationError(null);
    }
  }, [params]);

  const handleRun = useCallback(async () => {
    if (validationError) return;
    
    setIsLoading(true);
    try {
      const simResult = await runSimulation(params);
      setResult(simResult);
    } catch (error) {
      toast({
        title: "Simulation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [params, validationError, toast]);

  // Live mode: auto-run when ND or tau changes
  useEffect(() => {
    if (!liveMode || validationError) return;
    
    const ndChanged = params.ND !== prevNDRef.current;
    const tauChanged = params.tau !== prevTauRef.current;
    
    if (ndChanged || tauChanged) {
      prevNDRef.current = params.ND;
      prevTauRef.current = params.tau;
      
      // Debounce the simulation
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      
      debounceRef.current = setTimeout(() => {
        handleRun();
      }, 150);
    }
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [params.ND, params.tau, liveMode, validationError, handleRun]);

  const handleRandomize = useCallback(() => {
    const seed = Date.now();
    const { h, g } = generateRandomChannelGains(params.N, seed);
    setParams({ ...params, h, g, seed });
  }, [params]);

  const handleReset = useCallback(() => {
    setParams(generateDefaultParams());
    setResult(null);
  }, []);

  // Run on mount with defaults
  useEffect(() => {
    handleRun();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-3 space-y-4">
            <ControlPanel
              params={params}
              onParamsChange={setParams}
              onRandomize={handleRandomize}
              onReset={handleReset}
              onRun={handleRun}
              isLoading={isLoading}
              validationError={validationError}
            />
            
            {/* Animation Controls */}
            <div className="panel p-4 space-y-4">
              <h4 className="font-mono text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Animation Settings
              </h4>
              <div className="flex items-center justify-between">
                <Label htmlFor="live-mode" className="text-sm cursor-pointer">
                  Live Mode
                  <span className="block text-xs text-muted-foreground">
                    Auto-update on ND/τ change
                  </span>
                </Label>
                <Switch
                  id="live-mode"
                  checked={liveMode}
                  onCheckedChange={setLiveMode}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="animation" className="text-sm cursor-pointer">
                  Animate Charts
                  <span className="block text-xs text-muted-foreground">
                    Smooth bar transitions
                  </span>
                </Label>
                <Switch
                  id="animation"
                  checked={animationEnabled}
                  onCheckedChange={setAnimationEnabled}
                />
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-9 space-y-6">
            {/* Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Active Channels |A|"
                value={result?.activeSet.length ?? 0}
                variant="default"
                className={animationEnabled && liveMode ? "transition-all duration-300" : ""}
              />
              <MetricCard
                label="Real Throughput (U_real)"
                value={result?.U_real ?? 0}
                variant="primary"
                className={animationEnabled && liveMode ? "transition-all duration-300" : ""}
              />
              <MetricCard
                label="Jammer Objective (U_jammer)"
                value={result?.U_jammer ?? 0}
                variant="jammer"
                className={animationEnabled && liveMode ? "transition-all duration-300" : ""}
              />
              <MetricCard
                label="Power on Decoys"
                value={result?.powerOnDecoys ?? 0}
                unit="W"
                variant="secondary"
                className={animationEnabled && liveMode ? "transition-all duration-300" : ""}
              />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Jamming per Active"
                value={result?.jammingPerActive ?? 0}
                unit="W"
              />
              <MetricCard
                label="Decoy Fraction"
                value={
                  result && params.PT > 0
                    ? ((result.powerOnDecoys / params.PT) * 100).toFixed(1) + "%"
                    : "0%"
                }
              />
              <MetricCard
                label="Real Channel Power"
                value={
                  result
                    ? result.x
                        .filter((_, i) => result.channelTypes[i] === "real")
                        .reduce((a, b) => a + b, 0)
                    : 0
                }
                unit="W"
                variant="primary"
              />
              <MetricCard
                label="Jammer Spread"
                value={
                  result
                    ? result.y.filter((y) => y > 0).length
                    : 0
                }
                unit="channels"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ChannelAllocationChart
                x={result?.x ?? []}
                y={result?.y ?? []}
                channelTypes={result?.channelTypes ?? []}
                title="Channel Power Allocation"
                animationEnabled={animationEnabled}
              />
              <RateChart
                rates={result?.rates ?? []}
                sinr={result?.sinr ?? []}
                channelTypes={result?.channelTypes ?? []}
                title="Per-Channel Rate"
              />
            </div>

            {/* Channel Details Table */}
            {result && (
              <div className="panel">
                <h3 className="panel-header">Channel Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-left font-mono text-xs text-muted-foreground">
                          Ch
                        </th>
                        <th className="px-3 py-2 text-left font-mono text-xs text-muted-foreground">
                          Type
                        </th>
                        <th className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                          x_i
                        </th>
                        <th className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                          y_i
                        </th>
                        <th className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                          h_i
                        </th>
                        <th className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                          g_i
                        </th>
                        <th className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                          SINR
                        </th>
                        <th className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                          Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.x.slice(0, 20).map((xi, i) => (
                        <tr
                          key={i}
                          className={`border-b border-border/50 transition-all duration-300 ${
                            result.channelTypes[i] === "inactive"
                              ? "opacity-40"
                              : "hover:bg-muted/30"
                          }`}
                        >
                          <td className="px-3 py-1.5 font-mono">{i + 1}</td>
                          <td className="px-3 py-1.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                result.channelTypes[i] === "real"
                                  ? "bg-primary/15 text-primary"
                                  : result.channelTypes[i] === "decoy"
                                  ? "bg-secondary/15 text-secondary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {result.channelTypes[i]}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            {xi.toFixed(3)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-jammer">
                            {result.y[i].toFixed(3)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                            {params.h[i]?.toFixed(2) ?? "1.00"}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                            {params.g[i]?.toFixed(2) ?? "1.00"}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            {result.sinr[i].toFixed(3)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-primary">
                            {result.rates[i].toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.x.length > 20 && (
                    <p className="text-center text-xs text-muted-foreground py-2">
                      Showing first 20 of {result.x.length} channels
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}