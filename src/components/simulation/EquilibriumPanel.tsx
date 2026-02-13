import { Button } from "@/components/ui/button";
import { ParameterSlider } from "./ParameterSlider";
import { EquilibriumParams, ChannelConfig, countChannelTypes } from "@/lib/equilibrium";
import { Play, Loader2, Shuffle, RotateCcw, FlaskConical, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ChannelConfigPanel } from "./equilibrium/ChannelConfigPanel";
import { JammerConfigPanel } from "./equilibrium/JammerConfigPanel";
import { GainsConfigPanel } from "./equilibrium/GainsConfigPanel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface EquilibriumPanelProps {
  params: EquilibriumParams;
  onParamsChange: (params: EquilibriumParams) => void;
  onRandomize: () => void;
  onReset: () => void;
  onRun: () => void;
  isLoading: boolean;
}

export function EquilibriumPanel({
  params,
  onParamsChange,
  onRandomize,
  onReset,
  onRun,
  isLoading,
}: EquilibriumPanelProps) {
  const [openSections, setOpenSections] = useState({
    players: true,
    channels: false,
    jammer: false,
    gains: false,
    algorithm: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateParam = <K extends keyof EquilibriumParams>(
    key: K,
    value: EquilibriumParams[K]
  ) => {
    onParamsChange({ ...params, [key]: value });
  };

  const handleDChange = (newD: number) => {
    const oldD = params.D;
    const PT = [...params.PT];
    const h = [...params.h];
    const channelConfig = [...params.channelConfig];
    
    // Adjust arrays
    if (newD > oldD) {
      for (let d = oldD; d < newD; d++) {
        PT.push(10);
        h.push(Array(params.N).fill(1));
      }
    } else {
      PT.length = newD;
      h.length = newD;
      // Reassign channels that belonged to removed defenders
      for (let i = 0; i < channelConfig.length; i++) {
        if (channelConfig[i].owner >= newD) {
          channelConfig[i] = { ...channelConfig[i], owner: i % newD };
        }
      }
    }
    
    onParamsChange({ ...params, D: newD, PT, h, channelConfig });
  };

  const handleMChange = (newM: number) => {
    const oldM = params.M;
    const PJ = [...params.PJ];
    const g = [...params.g];
    
    if (newM > oldM) {
      for (let m = oldM; m < newM; m++) {
        PJ.push(10);
        g.push(Array(params.N).fill(1));
      }
    } else {
      PJ.length = newM;
      g.length = newM;
    }
    
    onParamsChange({ ...params, M: newM, PJ, g });
  };

  const handleNChange = (newN: number) => {
    const h = params.h.map(row => {
      if (newN > row.length) {
        return [...row, ...Array(newN - row.length).fill(1)];
      }
      return row.slice(0, newN);
    });
    const g = params.g.map(row => {
      if (newN > row.length) {
        return [...row, ...Array(newN - row.length).fill(1)];
      }
      return row.slice(0, newN);
    });
    
    // Adjust channel config
    let channelConfig = [...params.channelConfig];
    if (newN > channelConfig.length) {
      for (let i = channelConfig.length; i < newN; i++) {
        channelConfig.push({ type: 'inactive', owner: i % params.D });
      }
    } else {
      channelConfig = channelConfig.slice(0, newN);
    }
    
    onParamsChange({ ...params, N: newN, h, g, channelConfig });
  };

  const counts = countChannelTypes(params.channelConfig);

  return (
    <div className="panel h-full overflow-auto">
      <div className="panel-header sticky top-0 bg-card z-10 flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-accent" />
        Equilibrium Mode
        <Badge variant="outline" className="ml-auto text-xs bg-accent/10 text-accent border-accent/30">
          v2
        </Badge>
      </div>
      <div className="p-4 space-y-4">
        
        {/* Player Configuration */}
        <Collapsible open={openSections.players} onOpenChange={() => toggleSection('players')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
            <h4 className="text-xs uppercase tracking-wider text-primary font-semibold">
              Player Configuration
            </h4>
            {openSections.players ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            <ParameterSlider
              label="Defenders (D)"
              value={params.D}
              onChange={handleDChange}
              min={1}
              max={5}
              step={1}
              description="Number of defending transmitters"
            />
            <ParameterSlider
              label="Attackers (M)"
              value={params.M}
              onChange={handleMChange}
              min={1}
              max={5}
              step={1}
              description="Number of jamming attackers"
            />
            <ParameterSlider
              label="Total Channels (N)"
              value={params.N}
              onChange={handleNChange}
              min={4}
              max={24}
              step={1}
            />
            
            {/* Power Budgets */}
            <div className="space-y-2 pt-2 border-t border-border">
              {params.PT.map((pt, d) => (
                <ParameterSlider
                  key={`PT-${d}`}
                  label={`Defender ${d + 1} Power`}
                  value={pt}
                  onChange={(v) => {
                    const newPT = [...params.PT];
                    newPT[d] = v;
                    updateParam("PT", newPT);
                  }}
                  min={1}
                  max={30}
                  step={0.5}
                  unit="W"
                />
              ))}
              {params.PJ.map((pj, m) => (
                <ParameterSlider
                  key={`PJ-${m}`}
                  label={`Attacker ${m + 1} Power`}
                  value={pj}
                  onChange={(v) => {
                    const newPJ = [...params.PJ];
                    newPJ[m] = v;
                    updateParam("PJ", newPJ);
                  }}
                  min={1}
                  max={30}
                  step={0.5}
                  unit="W"
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Channel Configuration */}
        <Collapsible open={openSections.channels} onOpenChange={() => toggleSection('channels')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <h4 className="text-xs uppercase tracking-wider text-primary font-semibold">
                Channel Config
              </h4>
              <Badge variant="outline" className="text-[10px]">
                {counts.real}R / {counts.decoy}D
              </Badge>
            </div>
            {openSections.channels ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <ChannelConfigPanel params={params} onParamsChange={onParamsChange} />
          </CollapsibleContent>
        </Collapsible>

        {/* Jammer Configuration */}
        <Collapsible open={openSections.jammer} onOpenChange={() => toggleSection('jammer')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <h4 className="text-xs uppercase tracking-wider text-jammer font-semibold">
                Jammer Settings
              </h4>
              <Badge variant="outline" className="text-[10px] text-jammer border-jammer/30">
                {params.jammerStrategy.split('_')[0]}
              </Badge>
            </div>
            {openSections.jammer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <JammerConfigPanel params={params} onParamsChange={onParamsChange} />
          </CollapsibleContent>
        </Collapsible>

        {/* Gains Configuration */}
        <Collapsible open={openSections.gains} onOpenChange={() => toggleSection('gains')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Channel Gains (h, g)
            </h4>
            {openSections.gains ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <GainsConfigPanel params={params} onParamsChange={onParamsChange} />
          </CollapsibleContent>
        </Collapsible>

        {/* Algorithm Parameters */}
        <Collapsible open={openSections.algorithm} onOpenChange={() => toggleSection('algorithm')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Algorithm
            </h4>
            {openSections.algorithm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            <ParameterSlider
              label="Damping (α)"
              value={params.alpha}
              onChange={(v) => updateParam("alpha", v)}
              min={0.05}
              max={1}
              step={0.05}
              description="new = (1-α)old + α×update"
            />
            <ParameterSlider
              label="Max Iterations"
              value={params.maxIter}
              onChange={(v) => updateParam("maxIter", v)}
              min={10}
              max={500}
              step={10}
            />
            <ParameterSlider
              label="Convergence (ε)"
              value={params.epsilon}
              onChange={(v) => updateParam("epsilon", v)}
              min={0.0001}
              max={0.1}
              step={0.0001}
              description="Stop when max change < ε"
            />
            <ParameterSlider
              label="Noise (σ²)"
              value={params.sigma2}
              onChange={(v) => updateParam("sigma2", v)}
              min={0.1}
              max={5}
              step={0.1}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4 border-t border-border">
          <Button
            onClick={onRun}
            disabled={isLoading}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Computing Equilibrium...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Find Equilibrium
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
