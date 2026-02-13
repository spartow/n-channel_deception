import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SimulationParams, SweepResult, exportToCSV } from "@/lib/simulation";
import { Copy, Download, FileText, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface PaperExportPanelProps {
  params: Omit<SimulationParams, "ND">;
  result: SweepResult | null;
}

export function PaperExportPanel({ params, result }: PaperExportPanelProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const formatParams = () => {
    return `N = ${params.N}
NR = ${params.NR}
PT = ${params.PT} W
PJ = ${params.PJ} W
σ² = ${params.sigma2}
τ = ${params.tau}
Defender Policy = ${params.defenderPolicy}
Jammer Mode = ${params.jammerMode}${params.jammerMode === "J2" ? ` (K=${params.topK})` : ""}
h_i = ${params.h.every(v => v === 1) ? "1 (uniform)" : "variable"}
g_i = ${params.g.every(v => v === 1) ? "1 (uniform)" : "variable"}`;
  };

  const formatLatexParams = () => {
    return `\\begin{table}[h]
\\centering
\\caption{Simulation Parameters}
\\begin{tabular}{ll}
\\hline
Parameter & Value \\\\
\\hline
Total channels ($N$) & ${params.N} \\\\
Real channels ($N_R$) & ${params.NR} \\\\
Defender power ($P_T$) & ${params.PT} W \\\\
Jammer power ($P_J$) & ${params.PJ} W \\\\
Noise ($\\sigma^2$) & ${params.sigma2} \\\\
Sensing threshold ($\\tau$) & ${params.tau} \\\\
Defender policy & ${params.defenderPolicy} \\\\
Jammer mode & ${params.jammerMode} \\\\
\\hline
\\end{tabular}
\\end{table}`;
  };

  const generateSummary = (): string => {
    if (!result || result.NDValues.length === 0) {
      return "No sweep results available. Run a sweep simulation to generate analysis.";
    }

    const { bestND, bestU_real, NDValues, U_realValues } = result;
    const maxND = Math.max(...NDValues);
    
    const zeroNDIndex = NDValues.indexOf(0);
    const U_realAtZero = zeroNDIndex >= 0 ? U_realValues[zeroNDIndex] : U_realValues[0];
    
    const improvement = ((bestU_real - U_realAtZero) / U_realAtZero * 100);
    const improvementStr = improvement > 0 
      ? `${improvement.toFixed(1)}% improvement` 
      : `${Math.abs(improvement).toFixed(1)}% decrease`;

    const bestNDIndex = NDValues.indexOf(bestND);
    const hasSaturation = bestND < maxND && bestNDIndex < NDValues.length - 1;
    
    const decoyPowerAtOptimal = bestND * params.tau;
    const realPowerAtOptimal = params.PT - decoyPowerAtOptimal;
    const powerFraction = (decoyPowerAtOptimal / params.PT * 100).toFixed(1);

    const activeChannelsAtOptimal = params.NR + bestND;
    const jammerPowerPerChannel = params.PJ / activeChannelsAtOptimal;
    const jammerPowerPerChannelAtZero = params.PJ / params.NR;
    const dilutionFactor = (jammerPowerPerChannelAtZero / jammerPowerPerChannel).toFixed(2);

    let summary = `Optimal Configuration Analysis\n\n`;
    
    summary += `Under the ${getDefenderPolicyName(params.defenderPolicy)} defender strategy against a ${getJammerModeName(params.jammerMode)} jammer, `;
    summary += `the optimal number of decoy channels is ND* = ${bestND}, achieving a real throughput of U_real = ${bestU_real.toFixed(4)}. `;
    
    if (bestND === 0) {
      summary += `Deploying decoys provides no benefit in this configuration, as the power cost outweighs the jamming dilution effect. `;
      summary += `With τ = ${params.tau} and PT = ${params.PT}, even minimal decoy allocation reduces real channel power without sufficient jammer dispersion.`;
    } else if (bestND === maxND) {
      summary += `Maximum decoy deployment is optimal, suggesting the jammer dilution benefit dominates the power cost. `;
      summary += `Each decoy forces the jammer to spread PJ = ${params.PJ} across ${activeChannelsAtOptimal} channels instead of ${params.NR}, `;
      summary += `reducing jamming per channel by a factor of ${dilutionFactor}x.`;
    } else {
      summary += `This represents a ${improvementStr} compared to no decoys (ND = 0). `;
      
      summary += `\n\nTrade-off Analysis: `;
      summary += `At ND* = ${bestND}, the defender allocates ${powerFraction}% of transmit power (${decoyPowerAtOptimal.toFixed(2)} W) to decoys, `;
      summary += `leaving ${realPowerAtOptimal.toFixed(2)} W for the ${params.NR} real channel(s). `;
      
      summary += `The jammer, perceiving ${activeChannelsAtOptimal} active channels, spreads PJ = ${params.PJ} W across all, `;
      summary += `yielding ${jammerPowerPerChannel.toFixed(3)} W per channel - a ${dilutionFactor}x dilution compared to no-decoy jamming. `;
      
      if (hasSaturation) {
        summary += `\n\nSaturation Effect: Beyond ND = ${bestND}, additional decoys become counterproductive. `;
        summary += `The marginal power cost (τ = ${params.tau} per decoy) exceeds the marginal dilution benefit, `;
        summary += `as real channel power drops below the threshold where SINR improvements from reduced jamming are offset by reduced signal strength.`;
      }
    }

    summary += `\n\nKey Parameters: N = ${params.N}, NR = ${params.NR}, PT = ${params.PT} W, PJ = ${params.PJ} W, σ² = ${params.sigma2}, τ = ${params.tau}.`;

    return summary;
  };

  const getDefenderPolicyName = (policy: string) => {
    switch (policy) {
      case "D1": return "minimum-credible decoys (D1)";
      case "D2": return "uniform deception (D2)";
      case "D3": return "real-optimized with fixed decoys (D3)";
      default: return policy;
    }
  };

  const getJammerModeName = (mode: string) => {
    switch (mode) {
      case "J1": return "uniform-split (J1)";
      case "J2": return "concentrate-on-top-K (J2)";
      case "J3": return "numerically-optimized (J3)";
      default: return mode;
    }
  };

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownloadCSV = () => {
    if (!result) return;
    const csv = exportToCSV(result);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sweep_ND_0_to_${Math.max(...result.NDValues)}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "CSV file saved" });
  };

  const handleDownloadPDF = async () => {
    if (!result) return;
    
    setGenerating(true);
    
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // Header with accent bar
      pdf.setFillColor(20, 184, 166); // Teal accent
      pdf.rect(0, 0, pageWidth, 8, "F");
      
      // Title
      y = 20;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(30, 41, 59);
      pdf.text("N-Channel Deception Jamming", margin, y);
      y += 8;
      pdf.text("Simulation Report", margin, y);
      
      // Subtitle with date
      y += 10;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Generated: ${new Date().toLocaleDateString("en-US", { 
        weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
      })}`, margin, y);

      // Divider
      y += 8;
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, pageWidth - margin, y);

      // Key Results Box
      y += 10;
      pdf.setFillColor(240, 253, 250); // Light teal background
      pdf.setDrawColor(20, 184, 166);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(margin, y, contentWidth, 28, 3, 3, "FD");
      
      y += 8;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(13, 148, 136);
      pdf.text("KEY RESULTS", margin + 5, y);
      
      y += 7;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`Optimal Decoys: ND* = ${result.bestND}`, margin + 5, y);
      pdf.text(`Best Throughput: U_real = ${result.bestU_real.toFixed(4)}`, margin + contentWidth/2, y);
      
      y += 7;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      const zeroNDIndex = result.NDValues.indexOf(0);
      const U_realAtZero = zeroNDIndex >= 0 ? result.U_realValues[zeroNDIndex] : result.U_realValues[0];
      const improvement = ((result.bestU_real - U_realAtZero) / U_realAtZero * 100);
      const improvementText = improvement > 0 ? `+${improvement.toFixed(1)}% vs baseline` : `${improvement.toFixed(1)}% vs baseline`;
      pdf.text(improvementText, margin + 5, y);

      // Simulation Parameters Section
      y += 18;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(30, 41, 59);
      pdf.text("Simulation Parameters", margin, y);
      
      y += 3;
      pdf.setDrawColor(20, 184, 166);
      pdf.setLineWidth(0.8);
      pdf.line(margin, y, margin + 40, y);

      // Parameters table
      y += 8;
      const paramData = [
        ["Total Channels (N)", String(params.N)],
        ["Real Channels (NR)", String(params.NR)],
        ["Defender Power (PT)", `${params.PT} W`],
        ["Jammer Power (PJ)", `${params.PJ} W`],
        ["Noise Variance (σ²)", String(params.sigma2)],
        ["Sensing Threshold (τ)", String(params.tau)],
        ["Defender Policy", getDefenderPolicyName(params.defenderPolicy).replace(/\([^)]+\)/, "").trim()],
        ["Jammer Mode", getJammerModeName(params.jammerMode).replace(/\([^)]+\)/, "").trim()],
      ];

      pdf.setFontSize(10);
      const colWidth = contentWidth / 2;
      const rowHeight = 7;
      
      paramData.forEach((row, i) => {
        const isEven = i % 2 === 0;
        if (isEven) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, y - 4, contentWidth, rowHeight, "F");
        }
        
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(71, 85, 105);
        pdf.text(row[0], margin + 3, y);
        
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 41, 59);
        pdf.text(row[1], margin + colWidth, y);
        
        y += rowHeight;
      });

      // Analysis Summary Section
      y += 10;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(30, 41, 59);
      pdf.text("Analysis Summary", margin, y);
      
      y += 3;
      pdf.setDrawColor(20, 184, 166);
      pdf.setLineWidth(0.8);
      pdf.line(margin, y, margin + 30, y);

      y += 8;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(51, 65, 85);
      
      const summary = generateSummary();
      const paragraphs = summary.split("\n\n");
      
      paragraphs.forEach((para) => {
        const lines = pdf.splitTextToSize(para, contentWidth);
        
        // Check if we need a new page
        if (y + lines.length * 5 > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        
        lines.forEach((line: string) => {
          pdf.text(line, margin, y);
          y += 5;
        });
        y += 3;
      });

      // Data Table Section
      y += 5;
      if (y > pageHeight - 80) {
        pdf.addPage();
        y = margin;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(30, 41, 59);
      pdf.text("Sweep Data", margin, y);
      
      y += 3;
      pdf.setDrawColor(20, 184, 166);
      pdf.setLineWidth(0.8);
      pdf.line(margin, y, margin + 25, y);

      // Table header
      y += 8;
      pdf.setFillColor(20, 184, 166);
      pdf.rect(margin, y - 4, contentWidth, 8, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text("ND (Decoy Channels)", margin + 5, y);
      pdf.text("U_real (Real Throughput)", margin + contentWidth/2, y);

      // Table data
      y += 6;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      
      const maxRows = Math.min(result.NDValues.length, 25);
      for (let i = 0; i < maxRows; i++) {
        if (y > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        
        const isOptimal = result.NDValues[i] === result.bestND;
        const isEven = i % 2 === 0;
        
        if (isOptimal) {
          pdf.setFillColor(240, 253, 250);
          pdf.rect(margin, y - 3, contentWidth, 5, "F");
          pdf.setTextColor(13, 148, 136);
          pdf.setFont("helvetica", "bold");
        } else {
          if (isEven) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(margin, y - 3, contentWidth, 5, "F");
          }
          pdf.setTextColor(51, 65, 85);
          pdf.setFont("helvetica", "normal");
        }
        
        pdf.text(String(result.NDValues[i]) + (isOptimal ? " *" : ""), margin + 5, y);
        pdf.text(result.U_realValues[i].toFixed(6), margin + contentWidth/2, y);
        y += 5;
      }
      
      if (result.NDValues.length > maxRows) {
        y += 2;
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(100, 116, 139);
        pdf.text(`... and ${result.NDValues.length - maxRows} more data points (see CSV for complete data)`, margin, y);
      }

      // Footer
      const footerY = pageHeight - 10;
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text("N-Channel Deception Jamming Simulator", margin, footerY);
      pdf.text(`Page 1 of ${pdf.getNumberOfPages()}`, pageWidth - margin - 20, footerY);

      // Save
      pdf.save(`simulation_report_${Date.now()}.pdf`);
      toast({ title: "PDF Generated", description: "Report downloaded successfully" });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({ 
        title: "Error", 
        description: "Failed to generate PDF", 
        variant: "destructive" 
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <FileText className="w-4 h-4" />
        Paper Export
      </div>
      <div className="p-4 space-y-6">
        {/* Parameters Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Parameter Set</h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(formatParams(), "Parameters")}
                className="h-7 text-xs"
              >
                {copied === "Parameters" ? (
                  <Check className="w-3 h-3 mr-1" />
                ) : (
                  <Copy className="w-3 h-3 mr-1" />
                )}
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(formatLatexParams(), "LaTeX")}
                className="h-7 text-xs"
              >
                {copied === "LaTeX" ? (
                  <Check className="w-3 h-3 mr-1" />
                ) : (
                  <Copy className="w-3 h-3 mr-1" />
                )}
                LaTeX
              </Button>
            </div>
          </div>
          <pre className="bg-muted/50 rounded-lg p-3 text-xs font-mono overflow-x-auto border border-border">
            {formatParams()}
          </pre>
        </div>

        {/* CSV Export */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Sweep Data (CSV)</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCSV}
              disabled={!result}
              className="h-7 text-xs"
            >
              <Download className="w-3 h-3 mr-1" />
              Download CSV
            </Button>
          </div>
          {result && (
            <pre className="bg-muted/50 rounded-lg p-3 text-xs font-mono overflow-x-auto border border-border max-h-32 overflow-y-auto">
              ND,U_real{"\n"}
              {result.NDValues.slice(0, 10).map((nd, i) => 
                `${nd},${result.U_realValues[i].toFixed(6)}`
              ).join("\n")}
              {result.NDValues.length > 10 && `\n... (${result.NDValues.length - 10} more rows)`}
            </pre>
          )}
        </div>

        {/* Auto-generated Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Analysis Summary</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(generateSummary(), "Summary")}
              disabled={!result}
              className="h-7 text-xs"
            >
              {copied === "Summary" ? (
                <Check className="w-3 h-3 mr-1" />
              ) : (
                <Copy className="w-3 h-3 mr-1" />
              )}
              Copy
            </Button>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-sm border border-border prose prose-sm max-w-none">
            {result ? (
              <div className="space-y-3">
                {generateSummary().split("\n\n").map((paragraph, i) => (
                  <p key={i} className="text-foreground leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic">
                Run a sweep simulation to generate analysis summary.
              </p>
            )}
          </div>
        </div>

        {/* Full Report Download */}
        <Button
          onClick={handleDownloadPDF}
          disabled={!result || generating}
          className="w-full"
        >
          {generating ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Download PDF Report
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
