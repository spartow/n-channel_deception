import { EquilibriumParams, ChannelType, ChannelConfig } from "@/lib/equilibrium";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Shuffle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChannelConfigPanelProps {
  params: EquilibriumParams;
  onParamsChange: (params: EquilibriumParams) => void;
}

const CHANNEL_TYPE_COLORS: Record<ChannelType, string> = {
  real: 'bg-primary text-primary-foreground',
  decoy: 'bg-secondary text-secondary-foreground',
  inactive: 'bg-muted text-muted-foreground',
};

const DEFENDER_COLORS = [
  'border-l-primary',
  'border-l-[hsl(175,70%,40%)]',
  'border-l-[hsl(190,70%,45%)]',
  'border-l-[hsl(200,70%,50%)]',
  'border-l-[hsl(210,70%,55%)]',
];

export function ChannelConfigPanel({ params, onParamsChange }: ChannelConfigPanelProps) {
  const updateChannel = (index: number, updates: Partial<ChannelConfig>) => {
    const newConfig = [...params.channelConfig];
    newConfig[index] = { ...newConfig[index], ...updates };
    onParamsChange({ ...params, channelConfig: newConfig });
  };

  const setAllType = (type: ChannelType, defender?: number) => {
    const newConfig = params.channelConfig.map((ch, i) => {
      if (defender === undefined || ch.owner === defender) {
        return { ...ch, type };
      }
      return ch;
    });
    onParamsChange({ ...params, channelConfig: newConfig });
  };

  const distributeEvenly = () => {
    const channelsPerDefender = Math.floor(params.N / params.D);
    const realPerDefender = Math.floor(channelsPerDefender * 0.5);
    const decoyPerDefender = Math.floor(channelsPerDefender * 0.3);
    
    const newConfig: ChannelConfig[] = [];
    for (let i = 0; i < params.N; i++) {
      const defender = i % params.D;
      const posInDefender = Math.floor(i / params.D);
      
      let type: ChannelType = 'inactive';
      if (posInDefender < realPerDefender) type = 'real';
      else if (posInDefender < realPerDefender + decoyPerDefender) type = 'decoy';
      
      newConfig.push({ type, owner: defender });
    }
    onParamsChange({ ...params, channelConfig: newConfig });
  };

  // Count stats per defender
  const stats = Array.from({ length: params.D }, (_, d) => ({
    real: params.channelConfig.filter(c => c.owner === d && c.type === 'real').length,
    decoy: params.channelConfig.filter(c => c.owner === d && c.type === 'decoy').length,
    inactive: params.channelConfig.filter(c => c.owner === d && c.type === 'inactive').length,
  }));

  const totalReal = stats.reduce((s, d) => s + d.real, 0);
  const totalDecoy = stats.reduce((s, d) => s + d.decoy, 0);

  return (
    <div className="space-y-4">
      {/* Quick actions */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={distributeEvenly}>
          <Shuffle className="w-3 h-3 mr-1" />
          Auto-Distribute
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAllType('inactive')}>
          <RotateCcw className="w-3 h-3 mr-1" />
          Clear All
        </Button>
      </div>

      {/* Summary */}
      <div className="flex gap-2 flex-wrap text-xs">
        <Badge className="bg-primary/15 text-primary border-primary/30">
          {totalReal} Real
        </Badge>
        <Badge className="bg-secondary/15 text-secondary border-secondary/30">
          {totalDecoy} Decoy
        </Badge>
        <Badge variant="outline">
          {params.N - totalReal - totalDecoy} Inactive
        </Badge>
      </div>

      {/* Per-defender stats */}
      <div className="space-y-2">
        {stats.map((s, d) => (
          <div key={d} className="flex items-center gap-2 text-xs">
            <span className="font-mono w-12">D{d + 1}:</span>
            <span className="text-primary">{s.real}R</span>
            <span className="text-secondary">{s.decoy}D</span>
            <span className="text-muted-foreground">{s.inactive}I</span>
          </div>
        ))}
      </div>

      {/* Channel grid */}
      <div className="grid grid-cols-4 gap-1.5 max-h-72 overflow-y-auto pr-1">
        {params.channelConfig.map((ch, i) => (
          <div 
            key={i}
            className={cn(
              "p-1.5 rounded border-l-4 bg-muted/30",
              DEFENDER_COLORS[ch.owner % DEFENDER_COLORS.length]
            )}
          >
            <div className="text-[10px] font-mono text-muted-foreground mb-1">
              Ch {i + 1}
            </div>
            <Select
              value={ch.type}
              onValueChange={(val) => updateChannel(i, { type: val as ChannelType })}
            >
              <SelectTrigger className="h-6 text-[10px] px-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="real">Real</SelectItem>
                <SelectItem value="decoy">Decoy</SelectItem>
                <SelectItem value="inactive">Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-[10px] text-muted-foreground border-t border-border pt-2">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-primary" /> Real
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-secondary" /> Decoy
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-muted" /> Inactive
        </span>
      </div>
    </div>
  );
}
