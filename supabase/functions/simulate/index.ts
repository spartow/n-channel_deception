import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============ TYPES ============

type ChannelType = 'real' | 'decoy' | 'inactive';
type JammerStrategy = 'J1_uniform' | 'J2_topK' | 'J3_optimization';
type JammerObjective = 'deception' | 'oracle';
type AttackerMode = 'coordinated' | 'independent';

interface ChannelConfig {
  type: ChannelType;
  owner: number;
}

interface SimulationParams {
  N: number;
  NR: number;
  ND: number;
  PT: number;
  PJ: number;
  sigma2: number;
  tau: number;
  h: number[];
  g: number[];
  defenderPolicy: 'D1' | 'D2' | 'D3';
  jammerMode: 'J1' | 'J2' | 'J3';
  topK?: number;
  B?: number[];
  seed?: number;
}

interface SingleRunResult {
  x: number[];
  y: number[];
  channelTypes: ChannelType[];
  activeSet: number[];
  rates: number[];
  U_real: number;
  U_jammer: number;
  sinr: number[];
  powerOnDecoys: number;
  jammingPerActive: number;
}

interface SweepParams {
  baseParams: Omit<SimulationParams, 'ND'>;
  NDRange: number[];
  sweepType?: 'ND' | 'tau' | 'PJ';
  secondaryRange?: number[];
}

interface SweepResult {
  NDValues: number[];
  U_realValues: number[];
  bestND: number;
  bestU_real: number;
  heatmapData?: {
    x: number[];
    y: number[];
    z: number[][];
    xLabel: string;
    yLabel: string;
  };
}

// ============ EQUILIBRIUM TYPES ============

interface EquilibriumParams {
  N: number;
  D: number;
  M: number;
  PT: number[];
  PJ: number[];
  sigma2: number;
  tau: number;
  h: number[][];
  g: number[][];
  alpha: number;
  maxIter: number;
  epsilon: number;
  channelConfig: ChannelConfig[];
  jammerStrategy: JammerStrategy;
  jammerObjective: JammerObjective;
  attackerMode: AttackerMode;
  topK: number;
  randomInit: boolean;
  seed?: number;
}

interface PlayerAllocation {
  playerId: number;
  allocation: number[];
  utility: number;
}

interface EquilibriumMetrics {
  jammerWasteOnDecoys: number;
  dilutionFactor: number;
  oracleGap: number;
  improvementOverNoDecoys: number;
  totalRealThroughput: number;
  totalDecoyPower: number;
  activeChannelCount: number;
  realChannelCount: number;
  symmetricEquilibrium: boolean;
}

interface ConvergenceEntry {
  iter: number;
  maxChange: number;
  defenderUtilities: number[];
  attackerUtilities: number[];
  defenderDeltas: number[];
  attackerDeltas: number[];
}

interface ChannelSummary {
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

interface EquilibriumResult {
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

// ============ UTILITY FUNCTIONS ============

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function calculateRate(x_i: number, y_i: number, h_i: number, g_i: number, sigma2: number, B_i: number = 1): number {
  if (x_i <= 0) return 0;
  const sinr = (x_i * h_i) / (sigma2 + y_i * g_i);
  return B_i * Math.log2(1 + sinr);
}

function calculateSINR(x_i: number, y_i: number, h_i: number, g_i: number, sigma2: number): number {
  if (x_i <= 0) return 0;
  return (x_i * h_i) / (sigma2 + y_i * g_i);
}

// ============ SINGLE PLAYER SIMULATION ============

function defenderPolicyD1(params: SimulationParams): { x: number[], channelTypes: ChannelType[] } {
  const { N, NR, ND, PT, tau } = params;
  const x = new Array(N).fill(0);
  const channelTypes: ChannelType[] = new Array(N).fill('inactive');
  
  const realIndices = Array.from({ length: NR }, (_, i) => i);
  const decoyIndices = Array.from({ length: ND }, (_, i) => NR + i);
  
  const decoyPower = tau;
  const totalDecoyPower = ND * decoyPower;
  const remainingPower = Math.max(0, PT - totalDecoyPower);
  const realPower = NR > 0 ? remainingPower / NR : 0;
  
  for (const i of realIndices) {
    x[i] = realPower;
    channelTypes[i] = 'real';
  }
  
  for (const i of decoyIndices) {
    x[i] = decoyPower;
    channelTypes[i] = 'decoy';
  }
  
  return { x, channelTypes };
}

function defenderPolicyD2(params: SimulationParams): { x: number[], channelTypes: ChannelType[] } {
  const { N, NR, ND, PT } = params;
  const x = new Array(N).fill(0);
  const channelTypes: ChannelType[] = new Array(N).fill('inactive');
  
  const totalActive = NR + ND;
  const powerPerChannel = totalActive > 0 ? PT / totalActive : 0;
  
  const realIndices = Array.from({ length: NR }, (_, i) => i);
  const decoyIndices = Array.from({ length: ND }, (_, i) => NR + i);
  
  for (const i of realIndices) {
    x[i] = powerPerChannel;
    channelTypes[i] = 'real';
  }
  
  for (const i of decoyIndices) {
    x[i] = powerPerChannel;
    channelTypes[i] = 'decoy';
  }
  
  return { x, channelTypes };
}

function defenderPolicyD3(params: SimulationParams): { x: number[], channelTypes: ChannelType[] } {
  const { N, NR, ND, PT, tau, h, sigma2 } = params;
  const x = new Array(N).fill(0);
  const channelTypes: ChannelType[] = new Array(N).fill('inactive');
  
  const realIndices = Array.from({ length: NR }, (_, i) => i);
  const decoyIndices = Array.from({ length: ND }, (_, i) => NR + i);
  
  for (const i of decoyIndices) {
    x[i] = tau;
    channelTypes[i] = 'decoy';
  }
  
  const totalDecoyPower = ND * tau;
  const remainingPower = Math.max(0, PT - totalDecoyPower);
  const totalH = realIndices.reduce((sum, i) => sum + h[i], 0);
  
  for (const i of realIndices) {
    x[i] = totalH > 0 ? (h[i] / totalH) * remainingPower : remainingPower / NR;
    channelTypes[i] = 'real';
  }
  
  return { x, channelTypes };
}

function jammerModeJ1(x: number[], tau: number, PJ: number, N: number): number[] {
  const y = new Array(N).fill(0);
  const activeSet = x.map((xi, i) => xi >= tau ? i : -1).filter(i => i >= 0);
  
  if (activeSet.length === 0) return y;
  
  const powerPerChannel = PJ / activeSet.length;
  for (const i of activeSet) {
    y[i] = powerPerChannel;
  }
  
  return y;
}

function jammerModeJ2(x: number[], g: number[], tau: number, PJ: number, N: number, topK: number = 3): number[] {
  const y = new Array(N).fill(0);
  const activeSet = x.map((xi, i) => xi >= tau ? i : -1).filter(i => i >= 0);
  
  if (activeSet.length === 0) return y;
  
  const scored = activeSet.map(i => ({ index: i, score: x[i] * g[i] }));
  scored.sort((a, b) => b.score - a.score);
  
  const targets = scored.slice(0, Math.min(topK, scored.length));
  const totalScore = targets.reduce((sum, t) => sum + t.score, 0);
  
  for (const t of targets) {
    y[t.index] = totalScore > 0 ? (t.score / totalScore) * PJ : PJ / targets.length;
  }
  
  return y;
}

function jammerModeJ3(x: number[], h: number[], g: number[], tau: number, PJ: number, sigma2: number, N: number, B: number[]): number[] {
  const y = new Array(N).fill(0);
  const activeSet = x.map((xi, i) => xi >= tau ? i : -1).filter(i => i >= 0);
  
  if (activeSet.length === 0) return y;
  
  for (const i of activeSet) {
    y[i] = PJ / activeSet.length;
  }
  
  const learningRate = 0.1;
  const iterations = 100;
  
  for (let iter = 0; iter < iterations; iter++) {
    const gradients = new Array(N).fill(0);
    
    for (const i of activeSet) {
      const denom = sigma2 + y[i] * g[i];
      const sinr = (x[i] * h[i]) / denom;
      gradients[i] = (B[i] * x[i] * h[i] * g[i]) / (denom * denom * Math.log(2) * (1 + sinr));
    }
    
    const gradSum = gradients.reduce((s, g) => s + Math.max(0, g), 0);
    if (gradSum <= 0) break;
    
    for (const i of activeSet) {
      y[i] = (gradients[i] / gradSum) * PJ;
    }
  }
  
  return y;
}

function runSimulation(params: SimulationParams): SingleRunResult {
  const { N, NR, ND, PT, PJ, sigma2, tau, h, g, defenderPolicy, jammerMode, topK = 3 } = params;
  const B = params.B || new Array(N).fill(1);
  
  if (ND > N - NR) {
    throw new Error(`Invalid ND: ${ND} exceeds available channels (N-NR = ${N - NR})`);
  }
  if (ND * tau > PT) {
    throw new Error(`Invalid configuration: ND * tau (${ND * tau}) exceeds PT (${PT})`);
  }
  
  let result: { x: number[], channelTypes: ChannelType[] };
  switch (defenderPolicy) {
    case 'D1': result = defenderPolicyD1(params); break;
    case 'D2': result = defenderPolicyD2(params); break;
    case 'D3': result = defenderPolicyD3(params); break;
    default: result = defenderPolicyD1(params);
  }
  
  const { x, channelTypes } = result;
  
  let y: number[];
  switch (jammerMode) {
    case 'J1': y = jammerModeJ1(x, tau, PJ, N); break;
    case 'J2': y = jammerModeJ2(x, g, tau, PJ, N, topK); break;
    case 'J3': y = jammerModeJ3(x, h, g, tau, PJ, sigma2, N, B); break;
    default: y = jammerModeJ1(x, tau, PJ, N);
  }
  
  const activeSet = x.map((xi, i) => xi >= tau ? i : -1).filter(i => i >= 0);
  const rates = x.map((xi, i) => calculateRate(xi, y[i], h[i], g[i], sigma2, B[i]));
  const sinr = x.map((xi, i) => calculateSINR(xi, y[i], h[i], g[i], sigma2));
  
  const U_real = channelTypes.reduce((sum, type, i) => type === 'real' ? sum + rates[i] : sum, 0);
  const U_jammer = activeSet.reduce((sum, i) => sum + rates[i], 0);
  const powerOnDecoys = channelTypes.reduce((sum, type, i) => type === 'decoy' ? sum + x[i] : sum, 0);
  const jammingPerActive = activeSet.length > 0 ? PJ / activeSet.length : 0;
  
  return { x, y, channelTypes, activeSet, rates, U_real, U_jammer, sinr, powerOnDecoys, jammingPerActive };
}

function runSweep(sweepParams: SweepParams): SweepResult {
  const { baseParams, NDRange, sweepType = 'ND', secondaryRange } = sweepParams;
  
  const NDValues: number[] = [];
  const U_realValues: number[] = [];
  let bestND = 0;
  let bestU_real = -Infinity;
  let heatmapData: SweepResult['heatmapData'] | undefined;
  
  if (sweepType === 'ND' && !secondaryRange) {
    for (const ND of NDRange) {
      try {
        const result = runSimulation({ ...baseParams, ND });
        NDValues.push(ND);
        U_realValues.push(result.U_real);
        if (result.U_real > bestU_real) {
          bestU_real = result.U_real;
          bestND = ND;
        }
      } catch {
        NDValues.push(ND);
        U_realValues.push(0);
      }
    }
  } else if (secondaryRange) {
    const z: number[][] = [];
    const xLabels = sweepType === 'tau' ? 'tau' : 'PJ';
    
    for (const secondary of secondaryRange) {
      const row: number[] = [];
      for (const ND of NDRange) {
        try {
          const params = { 
            ...baseParams, 
            ND,
            ...(sweepType === 'tau' ? { tau: secondary } : { PJ: secondary })
          };
          const result = runSimulation(params);
          row.push(result.U_real);
          if (result.U_real > bestU_real) {
            bestU_real = result.U_real;
            bestND = ND;
          }
        } catch {
          row.push(0);
        }
      }
      z.push(row);
    }
    
    heatmapData = {
      x: NDRange,
      y: secondaryRange,
      z,
      xLabel: 'ND (Decoy Channels)',
      yLabel: xLabels === 'tau' ? 'τ (Threshold)' : 'PJ (Jammer Budget)',
    };
    
    for (const ND of NDRange) {
      try {
        const result = runSimulation({ ...baseParams, ND });
        NDValues.push(ND);
        U_realValues.push(result.U_real);
      } catch {
        NDValues.push(ND);
        U_realValues.push(0);
      }
    }
  }
  
  return { NDValues, U_realValues, bestND, bestU_real, heatmapData };
}

// ============ MULTI-PLAYER EQUILIBRIUM ============

function projectToSimplex(allocation: number[], budget: number): number[] {
  let sum = 0;
  const projected = allocation.map(v => {
    const val = Math.max(0, v);
    sum += val;
    return val;
  });
  
  if (sum <= 0) return projected.map(() => budget / projected.length);
  return projected.map(v => (v / sum) * budget);
}

function getActiveSet(x: number[][], params: EquilibriumParams): Set<number> {
  const active = new Set<number>();
  for (let i = 0; i < params.N; i++) {
    const config = params.channelConfig[i];
    if (config.type === 'inactive') continue;
    
    // Sum power from owner
    const ownerPower = x[config.owner]?.[i] || 0;
    if (ownerPower >= params.tau) {
      active.add(i);
    }
  }
  return active;
}

function calculateDefenderUtility(
  d: number,
  x: number[][],
  y: number[][],
  params: EquilibriumParams,
  activeSet: Set<number>,
  onlyReal: boolean = true
): number {
  let utility = 0;
  
  for (let i = 0; i < params.N; i++) {
    const config = params.channelConfig[i];
    if (config.owner !== d) continue;
    if (onlyReal && config.type !== 'real') continue;
    if (!onlyReal && config.type === 'inactive') continue;
    
    const defenderPower = x[d][i];
    if (defenderPower <= 0) continue;
    
    let totalInterference = params.sigma2;
    for (let m = 0; m < params.M; m++) {
      totalInterference += y[m][i] * params.g[m][i];
    }
    
    const sinr = (defenderPower * params.h[d][i]) / totalInterference;
    utility += Math.log(1 + sinr);
  }
  
  return utility;
}

function calculateAttackerUtility(
  m: number,
  x: number[][],
  y: number[][],
  params: EquilibriumParams,
  activeSet: Set<number>
): number {
  // Attacker minimizes defender throughput
  // For deception jammer: only sees active channels, doesn't know which are real
  // For oracle jammer: knows which channels are real
  
  let totalDefenderUtility = 0;
  
  for (let d = 0; d < params.D; d++) {
    if (params.jammerObjective === 'oracle') {
      // Oracle knows real channels
      totalDefenderUtility += calculateDefenderUtility(d, x, y, params, activeSet, true);
    } else {
      // Deception: attacker thinks all active are valuable
      totalDefenderUtility += calculateDefenderUtility(d, x, y, params, activeSet, false);
    }
  }
  
  return -totalDefenderUtility;
}

function defenderGradient(
  d: number,
  x: number[][],
  y: number[][],
  params: EquilibriumParams
): number[] {
  const grad = new Array(params.N).fill(0);
  
  for (let i = 0; i < params.N; i++) {
    const config = params.channelConfig[i];
    if (config.owner !== d) continue;
    if (config.type === 'inactive') continue;
    
    let totalInterference = params.sigma2;
    for (let m = 0; m < params.M; m++) {
      totalInterference += y[m][i] * params.g[m][i];
    }
    
    const currentPower = x[d][i];
    // For real channels, gradient is h/(I + x*h)
    // For decoy channels, defender may want just minimum power to be active
    if (config.type === 'real') {
      grad[i] = params.h[d][i] / (totalInterference + currentPower * params.h[d][i]);
    } else {
      // Decoy: just enough to stay active (tau), small gradient to maintain
      grad[i] = currentPower < params.tau ? 0.1 : 0.01;
    }
  }
  
  return grad;
}

function attackerGradient(
  m: number,
  x: number[][],
  y: number[][],
  params: EquilibriumParams,
  activeSet: Set<number>
): number[] {
  const grad = new Array(params.N).fill(0);
  
  for (let i = 0; i < params.N; i++) {
    if (!activeSet.has(i)) continue;
    
    const config = params.channelConfig[i];
    const owner = config.owner;
    
    // For oracle jammer, only target real channels
    if (params.jammerObjective === 'oracle' && config.type !== 'real') continue;
    
    const defenderPower = x[owner][i];
    if (defenderPower <= 0) continue;
    
    let totalInterference = params.sigma2;
    for (let mm = 0; mm < params.M; mm++) {
      totalInterference += y[mm][i] * params.g[mm][i];
    }
    
    const sinr_term = defenderPower * params.h[owner][i];
    grad[i] = (sinr_term * params.g[m][i]) / (totalInterference * (totalInterference + sinr_term));
  }
  
  return grad;
}

function applyJammerStrategy(
  m: number,
  y: number[][],
  x: number[][],
  params: EquilibriumParams,
  activeSet: Set<number>
): number[] {
  const newY = new Array(params.N).fill(0);
  const activeList = Array.from(activeSet);
  
  if (activeList.length === 0) return newY;
  
  switch (params.jammerStrategy) {
    case 'J1_uniform': {
      const power = params.PJ[m] / activeList.length;
      for (const i of activeList) {
        // For oracle, only target real
        if (params.jammerObjective === 'oracle' && params.channelConfig[i].type !== 'real') continue;
        newY[i] = power;
      }
      // Re-normalize
      const sum = newY.reduce((a, b) => a + b, 0);
      if (sum > 0) {
        for (let i = 0; i < params.N; i++) {
          newY[i] = (newY[i] / sum) * params.PJ[m];
        }
      }
      break;
    }
    
    case 'J2_topK': {
      // Score by x*g for perceived impact
      const scored = activeList
        .filter(i => params.jammerObjective !== 'oracle' || params.channelConfig[i].type === 'real')
        .map(i => ({
          index: i,
          score: x[params.channelConfig[i].owner][i] * params.g[m][i],
        }));
      scored.sort((a, b) => b.score - a.score);
      
      const targets = scored.slice(0, Math.min(params.topK, scored.length));
      const totalScore = targets.reduce((s, t) => s + t.score, 0);
      
      for (const t of targets) {
        newY[t.index] = totalScore > 0 ? (t.score / totalScore) * params.PJ[m] : params.PJ[m] / targets.length;
      }
      break;
    }
    
    case 'J3_optimization': {
      // Use gradient-based allocation
      const grad = attackerGradient(m, x, y, params, activeSet);
      const gradSum = grad.reduce((s, g) => s + Math.max(0, g), 0);
      
      if (gradSum > 0) {
        for (let i = 0; i < params.N; i++) {
          newY[i] = (Math.max(0, grad[i]) / gradSum) * params.PJ[m];
        }
      } else {
        // Fallback to uniform
        const validChannels = activeList.filter(i => 
          params.jammerObjective !== 'oracle' || params.channelConfig[i].type === 'real'
        );
        const power = params.PJ[m] / Math.max(1, validChannels.length);
        for (const i of validChannels) {
          newY[i] = power;
        }
      }
      break;
    }
  }
  
  return newY;
}

function computeMetrics(
  x: number[][],
  y: number[][],
  params: EquilibriumParams,
  activeSet: Set<number>
): EquilibriumMetrics {
  let totalRealThroughput = 0;
  let totalDecoyPower = 0;
  let jammerWasteOnDecoys = 0;
  let totalJammerPower = 0;
  let realChannelCount = 0;
  
  for (let i = 0; i < params.N; i++) {
    const config = params.channelConfig[i];
    const owner = config.owner;
    const defPower = x[owner]?.[i] || 0;
    
    let jamPower = 0;
    for (let m = 0; m < params.M; m++) {
      jamPower += y[m][i];
      totalJammerPower += y[m][i];
    }
    
    if (config.type === 'real') {
      realChannelCount++;
      let interference = params.sigma2;
      for (let m = 0; m < params.M; m++) {
        interference += y[m][i] * params.g[m][i];
      }
      if (defPower > 0) {
        const sinr = (defPower * params.h[owner][i]) / interference;
        totalRealThroughput += Math.log2(1 + sinr);
      }
    } else if (config.type === 'decoy') {
      totalDecoyPower += defPower;
      jammerWasteOnDecoys += jamPower;
    }
  }
  
  const activeChannelCount = activeSet.size;
  const dilutionFactor = realChannelCount > 0 ? activeChannelCount / realChannelCount : 1;
  
  return {
    jammerWasteOnDecoys: totalJammerPower > 0 ? jammerWasteOnDecoys / totalJammerPower : 0,
    dilutionFactor,
    oracleGap: 0,  // Computed separately if needed
    improvementOverNoDecoys: 0,  // Computed separately
    totalRealThroughput,
    totalDecoyPower,
    activeChannelCount,
    realChannelCount,
    symmetricEquilibrium: false,  // Checked separately
  };
}

function checkSymmetricEquilibrium(
  defenders: PlayerAllocation[],
  attackers: PlayerAllocation[],
  epsilon: number
): boolean {
  // Check if all defenders have similar allocations
  if (defenders.length <= 1) return false;
  
  const firstDef = defenders[0].allocation;
  for (let d = 1; d < defenders.length; d++) {
    const alloc = defenders[d].allocation;
    const diff = alloc.reduce((s, v, i) => s + Math.abs(v - firstDef[i]), 0);
    if (diff > epsilon * 10) return false;
  }
  
  return true;
}

function runEquilibrium(params: EquilibriumParams): EquilibriumResult {
  const { N, D, M, PT, PJ, alpha, maxIter, epsilon } = params;
  
  console.log(`Running equilibrium: D=${D}, M=${M}, N=${N}, strategy=${params.jammerStrategy}, objective=${params.jammerObjective}`);
  
  // Initialize allocations
  const x: number[][] = [];
  const y: number[][] = [];
  
  const random = params.seed !== undefined ? seededRandom(params.seed) : Math.random;
  
  // Initialize defenders
  for (let d = 0; d < D; d++) {
    const alloc = new Array(N).fill(0);
    const ownedChannels = params.channelConfig
      .map((c, i) => c.owner === d && c.type !== 'inactive' ? i : -1)
      .filter(i => i >= 0);
    
    if (ownedChannels.length > 0) {
      if (params.randomInit) {
        // Random initialization
        const weights = ownedChannels.map(() => random());
        const sum = weights.reduce((a, b) => a + b, 0);
        ownedChannels.forEach((ch, idx) => {
          alloc[ch] = (weights[idx] / sum) * PT[d];
        });
      } else {
        // Uniform over active channels, with decoys at tau
        let remaining = PT[d];
        const realChannels = ownedChannels.filter(i => params.channelConfig[i].type === 'real');
        const decoyChannels = ownedChannels.filter(i => params.channelConfig[i].type === 'decoy');
        
        // Allocate tau to each decoy
        for (const i of decoyChannels) {
          alloc[i] = Math.min(params.tau, remaining / Math.max(1, decoyChannels.length));
          remaining -= alloc[i];
        }
        
        // Distribute remaining to real channels
        if (realChannels.length > 0) {
          const perReal = remaining / realChannels.length;
          for (const i of realChannels) {
            alloc[i] = perReal;
          }
        }
      }
    }
    x.push(alloc);
  }
  
  // Initialize attackers
  const activeSet = getActiveSet(x, params);
  for (let m = 0; m < M; m++) {
    const alloc = applyJammerStrategy(m, [], x, params, activeSet);
    y.push(alloc);
  }
  
  const convergenceHistory: ConvergenceEntry[] = [];
  let converged = false;
  let iterations = 0;
  let maxChange = Infinity;
  
  const stepSize = 0.5;
  
  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    maxChange = 0;
    
    const xOld = x.map(row => [...row]);
    const yOld = y.map(row => [...row]);
    const defenderDeltas: number[] = [];
    const attackerDeltas: number[] = [];
    
    // Update defenders
    for (let d = 0; d < D; d++) {
      const grad = defenderGradient(d, x, y, params);
      const update = x[d].map((val, i) => val + stepSize * grad[i]);
      const projected = projectToSimplex(update, PT[d]);
      
      let playerMaxChange = 0;
      for (let i = 0; i < N; i++) {
        const newVal = (1 - alpha) * xOld[d][i] + alpha * projected[i];
        const delta = Math.abs(newVal - xOld[d][i]);
        playerMaxChange = Math.max(playerMaxChange, delta);
        maxChange = Math.max(maxChange, delta);
        x[d][i] = newVal;
      }
      defenderDeltas.push(playerMaxChange);
    }
    
    // Update active set after defender moves
    const newActiveSet = getActiveSet(x, params);
    
    // Update attackers
    for (let m = 0; m < M; m++) {
      let newY: number[];
      
      if (params.attackerMode === 'coordinated' || params.jammerStrategy !== 'J3_optimization') {
        // Use strategy-based allocation
        newY = applyJammerStrategy(m, y, x, params, newActiveSet);
      } else {
        // Independent gradient-based update
        const grad = attackerGradient(m, x, y, params, newActiveSet);
        const update = y[m].map((val, i) => val + stepSize * grad[i]);
        newY = projectToSimplex(update, PJ[m]);
      }
      
      let playerMaxChange = 0;
      for (let i = 0; i < N; i++) {
        const dampedVal = (1 - alpha) * yOld[m][i] + alpha * newY[i];
        const delta = Math.abs(dampedVal - yOld[m][i]);
        playerMaxChange = Math.max(playerMaxChange, delta);
        maxChange = Math.max(maxChange, delta);
        y[m][i] = dampedVal;
      }
      attackerDeltas.push(playerMaxChange);
    }
    
    // Record history
    const defenderUtilities = Array.from({ length: D }, (_, d) => 
      calculateDefenderUtility(d, x, y, params, newActiveSet, true)
    );
    const attackerUtilities = Array.from({ length: M }, (_, m) => 
      calculateAttackerUtility(m, x, y, params, newActiveSet)
    );
    
    convergenceHistory.push({
      iter: iter + 1,
      maxChange,
      defenderUtilities,
      attackerUtilities,
      defenderDeltas,
      attackerDeltas,
    });
    
    if (maxChange < epsilon) {
      converged = true;
      console.log(`Converged at iteration ${iter + 1} with maxChange=${maxChange}`);
      break;
    }
  }
  
  // Build results
  const finalActiveSet = getActiveSet(x, params);
  
  const defenders: PlayerAllocation[] = Array.from({ length: D }, (_, d) => ({
    playerId: d,
    allocation: x[d],
    utility: calculateDefenderUtility(d, x, y, params, finalActiveSet, true),
  }));
  
  const attackers: PlayerAllocation[] = Array.from({ length: M }, (_, m) => ({
    playerId: m,
    allocation: y[m],
    utility: calculateAttackerUtility(m, x, y, params, finalActiveSet),
  }));
  
  // Channel summary
  const channelSummary: ChannelSummary[] = [];
  for (let i = 0; i < N; i++) {
    const config = params.channelConfig[i];
    const owner = config.owner;
    const totalDefenderPower = x[owner]?.[i] || 0;
    const totalAttackerPower = y.reduce((sum, ym) => sum + ym[i], 0);
    
    let sinr = 0;
    let rate = 0;
    if (totalDefenderPower > 0) {
      let interference = params.sigma2;
      for (let m = 0; m < M; m++) {
        interference += y[m][i] * params.g[m][i];
      }
      sinr = (totalDefenderPower * params.h[owner][i]) / interference;
      rate = Math.log2(1 + sinr);
    }
    
    // Average h and g for display
    const avgH = params.h[owner]?.[i] || 1;
    const avgG = params.g.reduce((s, gm) => s + gm[i], 0) / params.M;
    
    channelSummary.push({
      channel: i,
      owner,
      channelType: config.type,
      totalDefenderPower,
      totalAttackerPower,
      sinr,
      rate,
      h: avgH,
      g: avgG,
      isActive: finalActiveSet.has(i),
    });
  }
  
  const metrics = computeMetrics(x, y, params, finalActiveSet);
  metrics.symmetricEquilibrium = checkSymmetricEquilibrium(defenders, attackers, epsilon);
  
  return {
    defenders,
    attackers,
    converged,
    iterations,
    maxChange,
    convergenceHistory,
    channelSummary,
    metrics,
  };
}

// ============ INPUT VALIDATION ============

const MAX_N = 100;          // Max channels
const MAX_D = 20;           // Max defenders
const MAX_M = 20;           // Max attackers
const MAX_ITER = 1000;      // Max equilibrium iterations
const MAX_SWEEP_POINTS = 50; // Max sweep range points
const MAX_POWER = 10000;    // Max power budget

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateNumber(value: unknown, name: string, min: number, max: number): ValidationResult {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { valid: false, error: `${name} must be a finite number` };
  }
  if (value < min || value > max) {
    return { valid: false, error: `${name} must be between ${min} and ${max}` };
  }
  return { valid: true };
}

function validateArray(arr: unknown, name: string, maxLength: number): ValidationResult {
  if (!Array.isArray(arr)) {
    return { valid: false, error: `${name} must be an array` };
  }
  if (arr.length > maxLength) {
    return { valid: false, error: `${name} exceeds maximum length of ${maxLength}` };
  }
  return { valid: true };
}

function validateSimulationParams(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }
  
  const params = body as Record<string, unknown>;
  
  // Validate required numeric parameters
  const checks: ValidationResult[] = [
    validateNumber(params.N, 'N', 1, MAX_N),
    validateNumber(params.NR, 'NR', 0, MAX_N),
    validateNumber(params.ND, 'ND', 0, MAX_N),
    validateNumber(params.PT, 'PT', 0, MAX_POWER),
    validateNumber(params.PJ, 'PJ', 0, MAX_POWER),
    validateNumber(params.sigma2, 'sigma2', 0.0001, MAX_POWER),
    validateNumber(params.tau, 'tau', 0, MAX_POWER),
  ];
  
  for (const check of checks) {
    if (!check.valid) return check;
  }
  
  // Validate arrays
  if (params.h !== undefined) {
    const arrCheck = validateArray(params.h, 'h', MAX_N);
    if (!arrCheck.valid) return arrCheck;
    for (const val of params.h as unknown[]) {
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
        return { valid: false, error: 'h array must contain non-negative numbers' };
      }
    }
  }
  
  if (params.g !== undefined) {
    const arrCheck = validateArray(params.g, 'g', MAX_N);
    if (!arrCheck.valid) return arrCheck;
    for (const val of params.g as unknown[]) {
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
        return { valid: false, error: 'g array must contain non-negative numbers' };
      }
    }
  }
  
  // Validate policy strings
  if (params.defenderPolicy !== undefined) {
    if (!['D1', 'D2', 'D3'].includes(params.defenderPolicy as string)) {
      return { valid: false, error: 'defenderPolicy must be D1, D2, or D3' };
    }
  }
  
  if (params.jammerMode !== undefined) {
    if (!['J1', 'J2', 'J3'].includes(params.jammerMode as string)) {
      return { valid: false, error: 'jammerMode must be J1, J2, or J3' };
    }
  }
  
  return { valid: true };
}

function validateSweepParams(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }
  
  const params = body as Record<string, unknown>;
  
  // Validate baseParams
  if (!params.baseParams || typeof params.baseParams !== 'object') {
    return { valid: false, error: 'baseParams is required and must be an object' };
  }
  
  // Validate NDRange
  const ndRangeCheck = validateArray(params.NDRange, 'NDRange', MAX_SWEEP_POINTS);
  if (!ndRangeCheck.valid) return ndRangeCheck;
  
  // Validate secondaryRange if present
  if (params.secondaryRange !== undefined) {
    const secCheck = validateArray(params.secondaryRange, 'secondaryRange', MAX_SWEEP_POINTS);
    if (!secCheck.valid) return secCheck;
  }
  
  return { valid: true };
}

function validateEquilibriumParams(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }
  
  const params = body as Record<string, unknown>;
  
  // Validate numeric parameters with strict bounds
  const checks: ValidationResult[] = [
    validateNumber(params.N, 'N', 1, MAX_N),
    validateNumber(params.D, 'D', 1, MAX_D),
    validateNumber(params.M, 'M', 1, MAX_M),
    validateNumber(params.sigma2, 'sigma2', 0.0001, MAX_POWER),
    validateNumber(params.tau, 'tau', 0, MAX_POWER),
    validateNumber(params.alpha, 'alpha', 0.01, 1),
    validateNumber(params.maxIter, 'maxIter', 1, MAX_ITER),
    validateNumber(params.epsilon, 'epsilon', 0.0000001, 1),
    validateNumber(params.topK, 'topK', 1, MAX_N),
  ];
  
  for (const check of checks) {
    if (!check.valid) return check;
  }
  
  // Validate power arrays
  const ptCheck = validateArray(params.PT, 'PT', MAX_D);
  if (!ptCheck.valid) return ptCheck;
  
  const pjCheck = validateArray(params.PJ, 'PJ', MAX_M);
  if (!pjCheck.valid) return pjCheck;
  
  // Validate 2D arrays h and g
  if (!Array.isArray(params.h)) {
    return { valid: false, error: 'h must be a 2D array' };
  }
  if ((params.h as unknown[]).length > MAX_D) {
    return { valid: false, error: `h exceeds maximum of ${MAX_D} defenders` };
  }
  for (const row of params.h as unknown[]) {
    const rowCheck = validateArray(row, 'h row', MAX_N);
    if (!rowCheck.valid) return rowCheck;
  }
  
  if (!Array.isArray(params.g)) {
    return { valid: false, error: 'g must be a 2D array' };
  }
  if ((params.g as unknown[]).length > MAX_M) {
    return { valid: false, error: `g exceeds maximum of ${MAX_M} attackers` };
  }
  for (const row of params.g as unknown[]) {
    const rowCheck = validateArray(row, 'g row', MAX_N);
    if (!rowCheck.valid) return rowCheck;
  }
  
  // Validate channelConfig
  const configCheck = validateArray(params.channelConfig, 'channelConfig', MAX_N);
  if (!configCheck.valid) return configCheck;
  
  // Validate strategy strings
  if (!['J1_uniform', 'J2_topK', 'J3_optimization'].includes(params.jammerStrategy as string)) {
    return { valid: false, error: 'jammerStrategy must be J1_uniform, J2_topK, or J3_optimization' };
  }
  
  if (!['deception', 'oracle'].includes(params.jammerObjective as string)) {
    return { valid: false, error: 'jammerObjective must be deception or oracle' };
  }
  
  if (!['coordinated', 'independent'].includes(params.attackerMode as string)) {
    return { valid: false, error: 'attackerMode must be coordinated or independent' };
  }
  
  return { valid: true };
}

// ============ SERVER ============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (path === 'run' || path === 'simulate') {
      console.log('Running single simulation');
      
      const validation = validateSimulationParams(body);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const result = runSimulation(body as SimulationParams);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (path === 'sweep') {
      console.log('Running sweep simulation');
      
      const validation = validateSweepParams(body);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const result = runSweep(body as SweepParams);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (path === 'equilibrium') {
      console.log('Running equilibrium simulation');
      
      const validation = validateEquilibriumParams(body);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const result = runEquilibrium(body as EquilibriumParams);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log('Running default simulation');
      
      const validation = validateSimulationParams(body);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const result = runSimulation(body as SimulationParams);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Simulation error:', error);
    // Return generic error message to avoid leaking internal details
    return new Response(
      JSON.stringify({ error: 'Simulation failed. Please check your input parameters.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
