import { useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { ParameterSlider } from "@/components/simulation/ParameterSlider";
import { MetricCard } from "@/components/simulation/MetricCard";
import { SweepChart } from "@/components/simulation/SweepChart";
import { HeatmapChart } from "@/components/simulation/HeatmapChart";
import { PaperExportPanel } from "@/components/simulation/PaperExportPanel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SimulationParams,
  SweepResult,
  generateDefaultParams,
  runSweep,
} from "@/lib/simulation";
import { useToast } from "@/hooks/use-toast";
import { Play, Loader2 } from "lucide-react";

export default function SweepPage() {
  const { toast } = useToast();
  const [baseParams, setBaseParams] = useState<Omit<SimulationParams, "ND">>(() => {
    const defaults = generateDefaultParams();
    const { ND: _, ...rest } = defaults;
    return rest;
  });
  const [sweepType, setSweepType] = useState<"ND" | "tau" | "PJ">("ND");
  const [result, setResult] = useState<SweepResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const maxND = baseParams.N - baseParams.NR;

  const handleRun = useCallback(async () => {
    setIsLoading(true);
    try {
      const NDRange = Array.from({ length: maxND + 1 }, (_, i) => i);
      
      let secondaryRange: number[] | undefined;
      if (sweepType === "tau") {
        secondaryRange = Array.from({ length: 10 }, (_, i) => 0.1 + i * 0.2);
      } else if (sweepType === "PJ") {
        secondaryRange = Array.from({ length: 10 }, (_, i) => 2 + i * 2);
      }

      const sweepResult = await runSweep({
        baseParams,
        NDRange,
        sweepType,
        secondaryRange,
      });
      
      setResult(sweepResult);
      toast({
        title: "Sweep Complete",
        description: `Best ND* = ${sweepResult.bestND} with U_real = ${sweepResult.bestU_real.toFixed(4)}`,
      });
    } catch (error) {
      toast({
        title: "Sweep Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [baseParams, maxND, sweepType, toast]);

  const updateParam = <K extends keyof typeof baseParams>(
    key: K,
    value: (typeof baseParams)[K]
  ) => {
    setBaseParams({ ...baseParams, [key]: value });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-3">
            <div className="panel h-full overflow-auto">
              <div className="panel-header sticky top-0 bg-card z-10">
                Sweep Configuration
              </div>
              <div className="p-4 space-y-6">
                {/* Sweep Type */}
                <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-wider text-primary font-semibold">
                    Sweep Type
                  </h4>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Primary Sweep
                    </Label>
                    <Select
                      value={sweepType}
                      onValueChange={(v) =>
                        setSweepType(v as "ND" | "tau" | "PJ")
                      }
                    >
                      <SelectTrigger className="bg-muted/50 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ND">ND Only (1D)</SelectItem>
                        <SelectItem value="tau">ND × τ (Heatmap)</SelectItem>
                        <SelectItem value="PJ">ND × PJ (Heatmap)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Base Parameters */}
                <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-wider text-primary font-semibold">
                    Base Parameters
                  </h4>
                  <ParameterSlider
                    label="Total Channels (N)"
                    value={baseParams.N}
                    onChange={(v) => {
                      const newH = new Array(v).fill(1);
                      const newG = new Array(v).fill(1);
                      setBaseParams({
                        ...baseParams,
                        N: v,
                        h: newH,
                        g: newG,
                        NR: Math.min(baseParams.NR, v),
                      });
                    }}
                    min={2}
                    max={50}
                    step={1}
                  />
                  <ParameterSlider
                    label="Real Channels (NR)"
                    value={baseParams.NR}
                    onChange={(v) => updateParam("NR", v)}
                    min={1}
                    max={baseParams.N}
                    step={1}
                  />
                  <ParameterSlider
                    label="Defender Power (PT)"
                    value={baseParams.PT}
                    onChange={(v) => updateParam("PT", v)}
                    min={1}
                    max={50}
                    step={0.5}
                    unit="W"
                  />
                  <ParameterSlider
                    label="Jammer Power (PJ)"
                    value={baseParams.PJ}
                    onChange={(v) => updateParam("PJ", v)}
                    min={1}
                    max={50}
                    step={0.5}
                    unit="W"
                  />
                  <ParameterSlider
                    label="Noise (σ²)"
                    value={baseParams.sigma2}
                    onChange={(v) => updateParam("sigma2", v)}
                    min={0.1}
                    max={5}
                    step={0.1}
                  />
                  <ParameterSlider
                    label="Sensing Threshold (τ)"
                    value={baseParams.tau}
                    onChange={(v) => updateParam("tau", v)}
                    min={0.01}
                    max={2}
                    step={0.01}
                  />
                </div>

                {/* Strategy */}
                <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-wider text-primary font-semibold">
                    Strategies
                  </h4>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Defender Policy
                    </Label>
                    <Select
                      value={baseParams.defenderPolicy}
                      onValueChange={(v) =>
                        updateParam("defenderPolicy", v as "D1" | "D2" | "D3")
                      }
                    >
                      <SelectTrigger className="bg-muted/50 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="D1">
                          D1: Minimum-Credible Decoys
                        </SelectItem>
                        <SelectItem value="D2">D2: Uniform Deception</SelectItem>
                        <SelectItem value="D3">
                          D3: Real-Optimized + Fixed Decoys
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Jammer Mode
                    </Label>
                    <Select
                      value={baseParams.jammerMode}
                      onValueChange={(v) =>
                        updateParam("jammerMode", v as "J1" | "J2" | "J3")
                      }
                    >
                      <SelectTrigger className="bg-muted/50 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="J1">J1: Uniform Split</SelectItem>
                        <SelectItem value="J2">J2: Concentrate on Top K</SelectItem>
                        <SelectItem value="J3">J3: Numerical Optimizer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4">
                  <Button
                    onClick={handleRun}
                    disabled={isLoading}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Running Sweep...
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
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-9 space-y-6">
            {/* Metrics */}
            {result && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  label="Best ND*"
                  value={result.bestND}
                  variant="secondary"
                />
                <MetricCard
                  label="Best U_real"
                  value={result.bestU_real}
                  variant="primary"
                />
                <MetricCard
                  label="Sweep Range"
                  value={`0 - ${maxND}`}
                />
                <MetricCard
                  label="Data Points"
                  value={result.NDValues.length}
                />
              </div>
            )}

            {/* Charts */}
            {result && (
              <>
                <SweepChart
                  NDValues={result.NDValues}
                  U_realValues={result.U_realValues}
                  bestND={result.bestND}
                  bestU_real={result.bestU_real}
                  title="Saturation Curve: U_real vs ND"
                />

                {result.heatmapData && (
                  <HeatmapChart
                    x={result.heatmapData.x}
                    y={result.heatmapData.y}
                    z={result.heatmapData.z}
                    xLabel={result.heatmapData.xLabel}
                    yLabel={result.heatmapData.yLabel}
                    title={`Heatmap: U_real over (${result.heatmapData.xLabel}, ${result.heatmapData.yLabel})`}
                  />
                )}
              </>
            )}

            {/* Paper Export Panel */}
            <PaperExportPanel params={baseParams} result={result} />

            {/* Empty State */}
            {!result && !isLoading && (
              <div className="panel p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Play className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Ready to Run Sweep
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Configure your parameters and click "Run Sweep" to analyze
                  how U_real changes with different numbers of decoy channels.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}