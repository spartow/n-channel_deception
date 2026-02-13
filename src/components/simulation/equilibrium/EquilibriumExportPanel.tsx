import { EquilibriumResult, EquilibriumParams, countChannelTypes } from "@/lib/equilibrium";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileJson, FileSpreadsheet, Copy, Download, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface EquilibriumExportPanelProps {
  result: EquilibriumResult | null;
  params: EquilibriumParams;
}

export function EquilibriumExportPanel({ result, params }: EquilibriumExportPanelProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  if (!result) return null;

  const counts = countChannelTypes(params.channelConfig);
  const { metrics } = result;

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: "Copied to clipboard", description: label });
    setTimeout(() => setCopied(null), 2000);
  };

  // Generate LaTeX table
  const generateLatex = () => {
    return `\\begin{table}[h]
\\centering
\\caption{Multi-Player Equilibrium Results}
\\label{tab:equilibrium}
\\begin{tabular}{lc}
\\toprule
\\textbf{Parameter} & \\textbf{Value} \\\\
\\midrule
Defenders ($D$) & ${params.D} \\\\
Attackers ($M$) & ${params.M} \\\\
Total Channels ($N$) & ${params.N} \\\\
Real Channels ($N_R$) & ${counts.real} \\\\
Decoy Channels ($N_D$) & ${counts.decoy} \\\\
Defender Power ($P_T$) & ${params.PT.map(p => p.toFixed(1)).join(', ')} W \\\\
Attacker Power ($P_J$) & ${params.PJ.map(p => p.toFixed(1)).join(', ')} W \\\\
Noise ($\\sigma^2$) & ${params.sigma2} \\\\
Threshold ($\\tau$) & ${params.tau} \\\\
Damping ($\\alpha$) & ${params.alpha} \\\\
\\midrule
\\multicolumn{2}{c}{\\textbf{Results}} \\\\
\\midrule
Converged & ${result.converged ? 'Yes' : 'No'} \\\\
Iterations & ${result.iterations} \\\\
Total Defender Utility & ${result.defenders.reduce((s, d) => s + d.utility, 0).toFixed(4)} \\\\
Jammer Waste on Decoys & ${(metrics.jammerWasteOnDecoys * 100).toFixed(1)}\\% \\\\
Dilution Factor & ${metrics.dilutionFactor.toFixed(2)} \\\\
${metrics.oracleGap > 0 ? `Oracle Gap & ${metrics.oracleGap.toFixed(4)} \\\\` : ''}
${metrics.improvementOverNoDecoys > 0 ? `Improvement vs No Decoys & ${(metrics.improvementOverNoDecoys * 100).toFixed(1)}\\% \\\\` : ''}
\\bottomrule
\\end{tabular}
\\end{table}`;
  };

  // Generate CSV
  const generateCSV = () => {
    const headers = [
      'Channel', 'Type', 'Owner', 'Defender Power', 'Attacker Power', 
      'SINR', 'Rate', 'h', 'g', 'Active'
    ];
    const rows = result.channelSummary.map(ch => [
      ch.channel + 1,
      ch.channelType,
      ch.owner + 1,
      ch.totalDefenderPower.toFixed(4),
      ch.totalAttackerPower.toFixed(4),
      ch.sinr.toFixed(4),
      ch.rate.toFixed(4),
      ch.h.toFixed(4),
      ch.g.toFixed(4),
      ch.isActive ? 'Yes' : 'No',
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  };

  // Generate JSON
  const generateJSON = () => {
    return JSON.stringify({
      parameters: {
        D: params.D,
        M: params.M,
        N: params.N,
        NR: counts.real,
        ND: counts.decoy,
        PT: params.PT,
        PJ: params.PJ,
        sigma2: params.sigma2,
        tau: params.tau,
        alpha: params.alpha,
        maxIter: params.maxIter,
        epsilon: params.epsilon,
        jammerStrategy: params.jammerStrategy,
        jammerObjective: params.jammerObjective,
        attackerMode: params.attackerMode,
      },
      results: {
        converged: result.converged,
        iterations: result.iterations,
        maxChange: result.maxChange,
        defenders: result.defenders,
        attackers: result.attackers,
        metrics: result.metrics,
      },
      channelSummary: result.channelSummary,
      convergenceHistory: result.convergenceHistory,
    }, null, 2);
  };

  // Download file
  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: filename });
  };

  return (
    <div className="panel">
      <h3 className="panel-header flex items-center gap-2">
        <Download className="w-4 h-4" />
        Export Results
      </h3>
      <div className="p-4 space-y-4">
        {/* Key Metrics Summary */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-muted/30 rounded">
            <span className="text-muted-foreground">Jammer Waste:</span>
            <div className="font-mono font-semibold text-secondary">
              {(metrics.jammerWasteOnDecoys * 100).toFixed(1)}%
            </div>
          </div>
          <div className="p-2 bg-muted/30 rounded">
            <span className="text-muted-foreground">Dilution Factor:</span>
            <div className="font-mono font-semibold">
              {metrics.dilutionFactor.toFixed(2)}
            </div>
          </div>
          {metrics.oracleGap > 0 && (
            <div className="p-2 bg-muted/30 rounded">
              <span className="text-muted-foreground">Oracle Gap:</span>
              <div className="font-mono font-semibold text-primary">
                {metrics.oracleGap.toFixed(4)}
              </div>
            </div>
          )}
          {metrics.improvementOverNoDecoys > 0 && (
            <div className="p-2 bg-muted/30 rounded">
              <span className="text-muted-foreground">vs No Decoys:</span>
              <div className="font-mono font-semibold text-green-600">
                +{(metrics.improvementOverNoDecoys * 100).toFixed(1)}%
              </div>
            </div>
          )}
        </div>

        {/* Export Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadFile(generateJSON(), 'equilibrium.json', 'application/json')}
            className="text-xs"
          >
            <FileJson className="w-3 h-3 mr-1" />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadFile(generateCSV(), 'equilibrium-channels.csv', 'text/csv')}
            className="text-xs"
          >
            <FileSpreadsheet className="w-3 h-3 mr-1" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopy(generateLatex(), 'LaTeX table')}
            className="text-xs"
          >
            {copied === 'LaTeX table' ? (
              <Check className="w-3 h-3 mr-1 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 mr-1" />
            )}
            LaTeX
          </Button>
        </div>

        {/* Convergence Status */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Status:</span>
            <Badge 
              variant={result.converged ? "default" : "secondary"}
              className={result.converged 
                ? "bg-green-500/15 text-green-600 border-green-500/30" 
                : "bg-amber-500/15 text-amber-600 border-amber-500/30"
              }
            >
              {result.converged ? 'Converged' : 'Not Converged'}
            </Badge>
          </div>
          {metrics.symmetricEquilibrium && (
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-muted-foreground">Warning:</span>
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                Symmetric Equilibrium Detected
              </Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
