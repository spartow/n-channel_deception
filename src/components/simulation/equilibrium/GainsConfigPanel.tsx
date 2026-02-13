import { EquilibriumParams, GainDistribution, generateRandomEquilibriumGains } from "@/lib/equilibrium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Shuffle, Edit2, Table } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface GainsConfigPanelProps {
  params: EquilibriumParams;
  onParamsChange: (params: EquilibriumParams) => void;
}

export function GainsConfigPanel({ params, onParamsChange }: GainsConfigPanelProps) {
  const [seed, setSeed] = useState<string>('');
  const [showMatrix, setShowMatrix] = useState(false);
  const [editingGains, setEditingGains] = useState<'h' | 'g' | null>(null);

  const updateParam = <K extends keyof EquilibriumParams>(key: K, value: EquilibriumParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };

  const randomizeGains = () => {
    const parsedSeed = seed ? parseInt(seed, 10) : Date.now();
    const { h, g } = generateRandomEquilibriumGains(
      params.N,
      params.D,
      params.M,
      params.gainDistribution,
      parsedSeed
    );
    onParamsChange({ ...params, h, g, seed: parsedSeed });
  };

  const resetToUniform = () => {
    const h = Array.from({ length: params.D }, () => Array(params.N).fill(1.0));
    const g = Array.from({ length: params.M }, () => Array(params.N).fill(1.0));
    onParamsChange({ ...params, h, g });
  };

  const updateGain = (type: 'h' | 'g', playerIdx: number, channelIdx: number, value: number) => {
    if (type === 'h') {
      const newH = params.h.map((row, i) => 
        i === playerIdx ? row.map((v, j) => j === channelIdx ? value : v) : row
      );
      onParamsChange({ ...params, h: newH });
    } else {
      const newG = params.g.map((row, i) => 
        i === playerIdx ? row.map((v, j) => j === channelIdx ? value : v) : row
      );
      onParamsChange({ ...params, g: newG });
    }
  };

  // Calculate stats
  const hMean = params.h.flat().reduce((a, b) => a + b, 0) / (params.D * params.N);
  const gMean = params.g.flat().reduce((a, b) => a + b, 0) / (params.M * params.N);
  const hVar = params.h.flat().reduce((a, b) => a + (b - hMean) ** 2, 0) / (params.D * params.N);
  const gVar = params.g.flat().reduce((a, b) => a + (b - gMean) ** 2, 0) / (params.M * params.N);

  return (
    <div className="space-y-4">
      {/* Distribution Selection */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Gain Distribution
        </Label>
        <RadioGroup
          value={params.gainDistribution}
          onValueChange={(val) => updateParam('gainDistribution', val as GainDistribution)}
          className="flex gap-3"
        >
          <label className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value="uniform" />
            <span className="text-sm">Uniform</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value="rayleigh" />
            <span className="text-sm">Rayleigh</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value="custom" />
            <span className="text-sm">Custom</span>
          </label>
        </RadioGroup>
      </div>

      {/* Seed + Randomize */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="number"
            placeholder="Seed (optional)"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={randomizeGains}>
          <Shuffle className="w-3 h-3 mr-1" />
          Randomize
        </Button>
        <Button variant="outline" size="sm" onClick={resetToUniform}>
          1.0
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 bg-muted/30 rounded">
          <span className="text-muted-foreground">h (defender):</span>
          <div className="font-mono">
            μ={hMean.toFixed(2)}, σ²={hVar.toFixed(3)}
          </div>
        </div>
        <div className="p-2 bg-muted/30 rounded">
          <span className="text-muted-foreground">g (attacker):</span>
          <div className="font-mono">
            μ={gMean.toFixed(2)}, σ²={gVar.toFixed(3)}
          </div>
        </div>
      </div>

      {/* Toggle Matrix View */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowMatrix(!showMatrix)}
        className="w-full justify-start text-xs"
      >
        <Table className="w-3 h-3 mr-2" />
        {showMatrix ? 'Hide' : 'Show'} Gain Matrices
      </Button>

      {/* Matrix Editor */}
      {showMatrix && (
        <div className="space-y-4 max-h-64 overflow-auto">
          {/* Defender Gains h */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/15 text-primary text-[10px]">h (Defender)</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[10px]"
                onClick={() => setEditingGains(editingGains === 'h' ? null : 'h')}
              >
                <Edit2 className="w-2 h-2 mr-1" />
                Edit
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="text-[10px] font-mono">
                <thead>
                  <tr>
                    <th className="px-1 text-muted-foreground"></th>
                    {Array.from({ length: Math.min(params.N, 12) }, (_, i) => (
                      <th key={i} className="px-1 text-muted-foreground">C{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {params.h.map((row, d) => (
                    <tr key={d}>
                      <td className="px-1 text-primary font-semibold">D{d + 1}</td>
                      {row.slice(0, 12).map((val, i) => (
                        <td key={i} className="px-1">
                          {editingGains === 'h' ? (
                            <Input
                              type="number"
                              value={val.toFixed(2)}
                              onChange={(e) => updateGain('h', d, i, parseFloat(e.target.value) || 0)}
                              className="w-10 h-5 text-[10px] p-0.5 text-center"
                              step={0.1}
                              min={0}
                            />
                          ) : (
                            val.toFixed(2)
                          )}
                        </td>
                      ))}
                      {params.N > 12 && <td className="text-muted-foreground">...</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attacker Gains g */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-jammer/15 text-jammer text-[10px]">g (Attacker)</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[10px]"
                onClick={() => setEditingGains(editingGains === 'g' ? null : 'g')}
              >
                <Edit2 className="w-2 h-2 mr-1" />
                Edit
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="text-[10px] font-mono">
                <thead>
                  <tr>
                    <th className="px-1 text-muted-foreground"></th>
                    {Array.from({ length: Math.min(params.N, 12) }, (_, i) => (
                      <th key={i} className="px-1 text-muted-foreground">C{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {params.g.map((row, m) => (
                    <tr key={m}>
                      <td className="px-1 text-jammer font-semibold">A{m + 1}</td>
                      {row.slice(0, 12).map((val, i) => (
                        <td key={i} className="px-1">
                          {editingGains === 'g' ? (
                            <Input
                              type="number"
                              value={val.toFixed(2)}
                              onChange={(e) => updateGain('g', m, i, parseFloat(e.target.value) || 0)}
                              className="w-10 h-5 text-[10px] p-0.5 text-center"
                              step={0.1}
                              min={0}
                            />
                          ) : (
                            val.toFixed(2)
                          )}
                        </td>
                      ))}
                      {params.N > 12 && <td className="text-muted-foreground">...</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Random Init Toggle */}
      <div className="flex items-center justify-between py-2 border-t border-border">
        <div>
          <Label className="text-sm">Random Initialization</Label>
          <p className="text-[10px] text-muted-foreground">
            Start from random allocations instead of uniform
          </p>
        </div>
        <Switch
          checked={params.randomInit}
          onCheckedChange={(v) => updateParam('randomInit', v)}
        />
      </div>
    </div>
  );
}
