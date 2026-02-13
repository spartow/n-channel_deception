import { EquilibriumParams, JammerStrategy, JammerObjective, AttackerMode } from "@/lib/equilibrium";
import { ParameterSlider } from "../ParameterSlider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Users, User, Crosshair, BarChart3, Cpu } from "lucide-react";

interface JammerConfigPanelProps {
  params: EquilibriumParams;
  onParamsChange: (params: EquilibriumParams) => void;
}

const STRATEGY_INFO: Record<JammerStrategy, { label: string; description: string; icon: React.ReactNode }> = {
  J1_uniform: { 
    label: 'J1: Uniform', 
    description: 'Split power evenly across active channels',
    icon: <BarChart3 className="w-3 h-3" />,
  },
  J2_topK: { 
    label: 'J2: Top-K Concentrate', 
    description: 'Focus on K highest-impact channels',
    icon: <Crosshair className="w-3 h-3" />,
  },
  J3_optimization: { 
    label: 'J3: Best Response', 
    description: 'Gradient-based optimal allocation',
    icon: <Cpu className="w-3 h-3" />,
  },
};

export function JammerConfigPanel({ params, onParamsChange }: JammerConfigPanelProps) {
  const updateParam = <K extends keyof EquilibriumParams>(key: K, value: EquilibriumParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };

  return (
    <div className="space-y-5">
      {/* Jammer Objective Toggle */}
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Jammer Objective
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => updateParam('jammerObjective', 'deception')}
            className={`p-3 rounded-lg border text-left transition-all ${
              params.jammerObjective === 'deception'
                ? 'border-jammer bg-jammer/10 ring-1 ring-jammer/50'
                : 'border-border hover:border-jammer/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <EyeOff className="w-4 h-4 text-jammer" />
              <span className="font-medium text-sm">Deception</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Minimizes sum rate over active channels (cannot see real vs decoy)
            </p>
          </button>
          <button
            onClick={() => updateParam('jammerObjective', 'oracle')}
            className={`p-3 rounded-lg border text-left transition-all ${
              params.jammerObjective === 'oracle'
                ? 'border-jammer bg-jammer/10 ring-1 ring-jammer/50'
                : 'border-border hover:border-jammer/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-jammer" />
              <span className="font-medium text-sm">Oracle</span>
              <Badge variant="outline" className="text-[8px] h-4">Baseline</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Knows which channels are real (worst-case for defender)
            </p>
          </button>
        </div>
      </div>

      {/* Jammer Strategy */}
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Jammer Strategy
        </Label>
        <RadioGroup
          value={params.jammerStrategy}
          onValueChange={(val) => updateParam('jammerStrategy', val as JammerStrategy)}
          className="space-y-2"
        >
          {(Object.entries(STRATEGY_INFO) as [JammerStrategy, typeof STRATEGY_INFO[JammerStrategy]][]).map(
            ([strategy, info]) => (
              <label
                key={strategy}
                className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                  params.jammerStrategy === strategy
                    ? 'border-jammer bg-jammer/5'
                    : 'border-border hover:border-jammer/30'
                }`}
              >
                <RadioGroupItem value={strategy} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {info.icon}
                    <span className="font-medium text-sm">{info.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {info.description}
                  </p>
                </div>
              </label>
            )
          )}
        </RadioGroup>
      </div>

      {/* Top-K slider (only for J2) */}
      {params.jammerStrategy === 'J2_topK' && (
        <ParameterSlider
          label="Top K Channels"
          value={params.topK}
          onChange={(v) => updateParam('topK', v)}
          min={1}
          max={Math.min(params.N, 10)}
          step={1}
          description="Number of highest-impact channels to target"
        />
      )}

      {/* Multi-Attacker Mode */}
      {params.M > 1 && (
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Multi-Attacker Mode
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateParam('attackerMode', 'coordinated')}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                params.attackerMode === 'coordinated'
                  ? 'border-jammer bg-jammer/10'
                  : 'border-border hover:border-jammer/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <Users className="w-4 h-4 text-jammer" />
                <span className="font-medium text-sm">Coordinated</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Attackers share information
              </p>
            </button>
            <button
              onClick={() => updateParam('attackerMode', 'independent')}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                params.attackerMode === 'independent'
                  ? 'border-jammer bg-jammer/10'
                  : 'border-border hover:border-jammer/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <User className="w-4 h-4 text-jammer" />
                <span className="font-medium text-sm">Independent</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Each optimizes separately
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Sensing Threshold */}
      <ParameterSlider
        label="Sensing Threshold (τ)"
        value={params.tau}
        onChange={(v) => updateParam('tau', v)}
        min={0.01}
        max={2}
        step={0.01}
        description="Active set A(x) = {i | x_i ≥ τ}"
      />
    </div>
  );
}
