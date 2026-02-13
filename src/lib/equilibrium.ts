import { supabase } from "@/integrations/supabase/client";

export type ChannelType = 'real' | 'decoy' | 'inactive';
export type JammerStrategy = 'J1_uniform' | 'J2_topK' | 'J3_optimization';
export type JammerObjective = 'deception' | 'oracle';
export type GainDistribution = 'uniform' | 'rayleigh' | 'custom';
export type AttackerMode = 'coordinated' | 'independent';
export type SweepVariable = 'ND' | 'tau' | 'N' | 'M' | 'D' | 'PJ';

export interface ChannelConfig {
  type: ChannelType;
  owner: number;  // Defender ID
}

export interface EquilibriumParams {
  N: number;              // Total channels
  D: number;              // Number of defenders
  M: number;              // Number of attackers
  PT: number[];           // Power budget per defender
  PJ: number[];           // Power budget per attacker
  sigma2: number;         // Noise variance
  tau: number;            // Sensing threshold
  h: number[][];          // Channel gains h[d][i] for defender d on channel i
  g: number[][];          // Channel gains g[m][i] for attacker m on channel i
  alpha: number;          // Damping factor (0 < alpha <= 1)
  maxIter: number;        // Maximum iterations
  epsilon: number;        // Convergence threshold
  channelConfig: ChannelConfig[];  // Real/Decoy/Inactive + owner per channel
  
  // Jammer configuration
  jammerStrategy: JammerStrategy;
  jammerObjective: JammerObjective;
  attackerMode: AttackerMode;
  topK: number;           // For J2 strategy
  
  // Initialization
  randomInit: boolean;
  seed?: number;
  
  // Gain distribution
  gainDistribution: GainDistribution;
}

export interface PlayerAllocation {
  playerId: number;
  allocation: number[];   // Power allocation per channel
  utility: number;        // Current utility
}

export interface EquilibriumMetrics {
  jammerWasteOnDecoys: number;        // Total jammer power on decoy channels
  dilutionFactor: number;             // |A| / |R| - how much jammer is spread
  oracleGap: number;                  // Oracle utility - Deception utility
  improvementOverNoDecoys: number;    // % improvement vs ND=0 baseline
  totalRealThroughput: number;
  totalDecoyPower: number;
  activeChannelCount: number;
  realChannelCount: number;
  symmetricEquilibrium: boolean;      // Whether equilibrium is symmetric
}

export interface ConvergenceEntry {
  iter: number;
  maxChange: number;
  defenderUtilities: number[];
  attackerUtilities: number[];
  defenderDeltas: number[];           // Per-player max change
  attackerDeltas: number[];
}

export interface ChannelSummary {
  channel: number;
  owner: number;
  channelType: ChannelType;
  totalDefenderPower: number;
  totalAttackerPower: number;
  sinr: number;
  rate: number;
  h: number;
  g: number;
  isActive: boolean;
}

export interface EquilibriumResult {
  defenders: PlayerAllocation[];
  attackers: PlayerAllocation[];
  converged: boolean;
  iterations: number;
  maxChange: number;
  convergenceHistory: ConvergenceEntry[];
  channelSummary: ChannelSummary[];
  metrics: EquilibriumMetrics;
  oracleResult?: {
    defenders: PlayerAllocation[];
    attackers: PlayerAllocation[];
    metrics: EquilibriumMetrics;
  };
}

export interface SweepPoint {
  variable: number;
  U_real: number;
  U_oracle?: number;
  oracleGap?: number;
  dilutionFactor: number;
  jammerWaste: number;
  converged: boolean;
  iterations: number;
}

export interface EquilibriumSweepResult {
  variable: SweepVariable;
  points: SweepPoint[];
  baseline: SweepPoint;  // ND=0 baseline
  bestPoint: SweepPoint;
  oracleBaseline?: SweepPoint;
}

export async function runEquilibrium(params: EquilibriumParams): Promise<EquilibriumResult> {
  const { data, error } = await supabase.functions.invoke('simulate/equilibrium', {
    body: params,
  });

  if (error) {
    throw new Error(error.message || 'Equilibrium simulation failed');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data as EquilibriumResult;
}

export async function runEquilibriumSweep(
  baseParams: EquilibriumParams,
  sweepVariable: SweepVariable,
  range: number[]
): Promise<EquilibriumSweepResult> {
  const { data, error } = await supabase.functions.invoke('simulate/equilibrium-sweep', {
    body: { baseParams, sweepVariable, range },
  });

  if (error) {
    throw new Error(error.message || 'Equilibrium sweep failed');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data as EquilibriumSweepResult;
}

export function generateDefaultEquilibriumParams(N: number = 12): EquilibriumParams {
  const D = 2;
  const M = 2;
  
  // Configure channels: 4 real each for 2 defenders, 2 decoys each
  const channelConfig: ChannelConfig[] = [];
  for (let i = 0; i < N; i++) {
    const defender = i % D;
    const positionInDefender = Math.floor(i / D);
    
    if (positionInDefender < 3) {
      channelConfig.push({ type: 'real', owner: defender });
    } else if (positionInDefender < 5) {
      channelConfig.push({ type: 'decoy', owner: defender });
    } else {
      channelConfig.push({ type: 'inactive', owner: defender });
    }
  }
  
  // Generate uniform channel gains
  const h: number[][] = Array.from({ length: D }, () => 
    Array.from({ length: N }, () => 1.0)
  );
  const g: number[][] = Array.from({ length: M }, () => 
    Array.from({ length: N }, () => 1.0)
  );
  
  return {
    N,
    D,
    M,
    PT: Array(D).fill(10),
    PJ: Array(M).fill(10),
    sigma2: 1,
    tau: 0.2,
    h,
    g,
    alpha: 0.3,
    maxIter: 100,
    epsilon: 0.001,
    channelConfig,
    jammerStrategy: 'J1_uniform',
    jammerObjective: 'deception',
    attackerMode: 'coordinated',
    topK: 3,
    randomInit: false,
    gainDistribution: 'uniform',
  };
}

export function generateRandomEquilibriumGains(
  N: number, 
  D: number, 
  M: number, 
  distribution: GainDistribution = 'uniform',
  seed?: number
): { h: number[][], g: number[][] } {
  const random = seed !== undefined ? seededRandom(seed) : Math.random;
  
  const generateGain = () => {
    if (distribution === 'rayleigh') {
      // Rayleigh distribution (sqrt of exponential)
      return Math.sqrt(-2 * Math.log(1 - random()));
    }
    // Uniform in [0.5, 2.0]
    return 0.5 + random() * 1.5;
  };
  
  const h: number[][] = Array.from({ length: D }, () => 
    Array.from({ length: N }, generateGain)
  );
  const g: number[][] = Array.from({ length: M }, () => 
    Array.from({ length: N }, generateGain)
  );
  
  return { h, g };
}

export function countChannelTypes(config: ChannelConfig[]): { real: number; decoy: number; inactive: number } {
  return config.reduce(
    (acc, ch) => {
      acc[ch.type]++;
      return acc;
    },
    { real: 0, decoy: 0, inactive: 0 }
  );
}

export function getChannelCountsPerDefender(config: ChannelConfig[], D: number): { real: number[]; decoy: number[] } {
  const real = Array(D).fill(0);
  const decoy = Array(D).fill(0);
  
  for (const ch of config) {
    if (ch.type === 'real') real[ch.owner]++;
    else if (ch.type === 'decoy') decoy[ch.owner]++;
  }
  
  return { real, decoy };
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}
