import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ParameterSlider } from "./ParameterSlider";
import { SimulationParams } from "@/lib/simulation";
import { Shuffle, RotateCcw, Play, Loader2 } from "lucide-react";

interface ControlPanelProps {
  params: SimulationParams;
  onParamsChange: (params: SimulationParams) => void;
  onRandomize: () => void;
  onReset: () => void;
  onRun: () => void;
  isLoading: boolean;
  validationError?: string | null;
}

export function ControlPanel({
  params,
  onParamsChange,
  onRandomize,
  onReset,
  onRun,
  isLoading,
  validationError,
}: ControlPanelProps) {
  const updateParam = <K extends keyof SimulationParams>(
    key: K,
    value: SimulationParams[K]
  ) => {
    onParamsChange({ ...params, [key]: value });
  };

  const maxND = params.N - params.NR;
  const maxNR = params.N;

  return (
    <div className="panel h-full overflow-auto">
      <div className="panel-header sticky top-0 bg-card z-10">
        Simulation Parameters
      </div>
      <div className="p-4 space-y-6">
        {/* Channel Configuration */}
        <div className="space-y-4">
          <h4 className="text-xs uppercase tracking-wider text-primary font-semibold">
            Channel Configuration
          </h4>
          <ParameterSlider
            label="Total Channels (N)"
            value={params.N}
            onChange={(v) => {
              updateParam("N", v);
              // Adjust h and g arrays
              const newH = new Array(v).fill(1);
              const newG = new Array(v).fill(1);
              onParamsChange({
                ...params,
                N: v,
                h: newH,
                g: newG,
                NR: Math.min(params.NR, v),
                ND: Math.min(params.ND, v - Math.min(params.NR, v)),
              });
            }}
            min={2}
            max={50}
            step={1}
          />
          <ParameterSlider
            label="Real Channels (NR)"
            value={params.NR}
            onChange={(v) => {
              const newND = Math.min(params.ND, params.N - v);
              onParamsChange({ ...params, NR: v, ND: newND });
            }}
            min={1}
            max={maxNR}
            step={1}
          />
          <ParameterSlider
            label="Decoy Channels (ND)"
            value={params.ND}
            onChange={(v) => updateParam("ND", v)}
            min={0}
            max={maxND}
            step={1}
          />
        </div>

        {/* Power Budgets */}
        <div className="space-y-4">
          <h4 className="text-xs uppercase tracking-wider text-primary font-semibold">
            Power Budgets
          </h4>
          <ParameterSlider
            label="Defender Power (PT)"
            value={params.PT}
            onChange={(v) => updateParam("PT", v)}
            min={1}
            max={50}
            step={0.5}
            unit="W"
          />
          <ParameterSlider
            label="Jammer Power (PJ)"
            value={params.PJ}
            onChange={(v) => updateParam("PJ", v)}
            min={1}
            max={50}
            step={0.5}
            unit="W"
          />
        </div>

        {/* Channel Parameters */}
        <div className="space-y-4">
          <h4 className="text-xs uppercase tracking-wider text-primary font-semibold">
            Channel Parameters
          </h4>
          <ParameterSlider
            label="Noise (σ²)"
            value={params.sigma2}
            onChange={(v) => updateParam("sigma2", v)}
            min={0.1}
            max={5}
            step={0.1}
          />
          <ParameterSlider
            label="Sensing Threshold (τ)"
            value={params.tau}
            onChange={(v) => updateParam("tau", v)}
            min={0.01}
            max={2}
            step={0.01}
            description="Channel active if x_i ≥ τ"
          />
        </div>

        {/* Strategy Selection */}
        <div className="space-y-4">
          <h4 className="text-xs uppercase tracking-wider text-primary font-semibold">
            Strategy Selection
          </h4>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Defender Policy
            </Label>
            <Select
              value={params.defenderPolicy}
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
              value={params.jammerMode}
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
          {params.jammerMode === "J2" && (
            <ParameterSlider
              label="Top K Channels"
              value={params.topK || 3}
              onChange={(v) => updateParam("topK", v)}
              min={1}
              max={Math.min(10, params.NR + params.ND)}
              step={1}
            />
          )}
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            ⚠️ {validationError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button
            onClick={onRun}
            disabled={isLoading || !!validationError}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Simulating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Simulation
              </>
            )}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onRandomize}
              className="flex-1 border-border"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              Randomize
            </Button>
            <Button
              variant="outline"
              onClick={onReset}
              className="flex-1 border-border"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}