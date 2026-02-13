import { useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { EquilibriumPanel } from "@/components/simulation/EquilibriumPanel";
import { EquilibriumResults } from "@/components/simulation/EquilibriumResults";
import { EquilibriumExportPanel } from "@/components/simulation/equilibrium/EquilibriumExportPanel";
import { EquilibriumSweepPanel } from "@/components/simulation/equilibrium/EquilibriumSweepPanel";
import {
  EquilibriumParams,
  EquilibriumResult,
  generateDefaultEquilibriumParams,
  generateRandomEquilibriumGains,
  runEquilibrium,
} from "@/lib/equilibrium";
import { useToast } from "@/hooks/use-toast";

export default function EquilibriumPage() {
  const { toast } = useToast();
  const [params, setParams] = useState<EquilibriumParams>(generateDefaultEquilibriumParams());
  const [result, setResult] = useState<EquilibriumResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRun = useCallback(async () => {
    setIsLoading(true);
    try {
      const eqResult = await runEquilibrium(params);
      setResult(eqResult);
      
      toast({
        title: eqResult.converged ? "Equilibrium Found" : "Max Iterations Reached",
        description: eqResult.converged 
          ? `Converged in ${eqResult.iterations} iterations`
          : `Did not converge after ${eqResult.iterations} iterations (Δ = ${eqResult.maxChange.toExponential(2)})`,
        variant: eqResult.converged ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Equilibrium Computation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [params, toast]);

  const handleRandomize = useCallback(() => {
    const seed = Date.now();
    const { h, g } = generateRandomEquilibriumGains(
      params.N, 
      params.D, 
      params.M, 
      params.gainDistribution, 
      seed
    );
    setParams({ ...params, h, g, seed });
  }, [params]);

  const handleReset = useCallback(() => {
    setParams(generateDefaultEquilibriumParams());
    setResult(null);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Multi-Player Equilibrium
            <span className="text-xs bg-accent/15 text-accent px-2 py-1 rounded-full font-normal">
              v2 - Deception Mode
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Iterative best-response with {params.D} defenders, {params.M} attackers, and real/decoy channel modeling
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-3">
            <EquilibriumPanel
              params={params}
              onParamsChange={setParams}
              onRandomize={handleRandomize}
              onReset={handleReset}
              onRun={handleRun}
              isLoading={isLoading}
            />
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-9 space-y-6">
            <EquilibriumResults result={result} params={params} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EquilibriumSweepPanel params={params} />
              <EquilibriumExportPanel result={result} params={params} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
