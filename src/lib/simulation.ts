import { supabase } from "@/integrations/supabase/client";

export interface SimulationParams {
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

export interface SingleRunResult {
  x: number[];
  y: number[];
  channelTypes: ('real' | 'decoy' | 'inactive')[];
  activeSet: number[];
  rates: number[];
  U_real: number;
  U_jammer: number;
  sinr: number[];
  powerOnDecoys: number;
  jammingPerActive: number;
}

export interface SweepParams {
  baseParams: Omit<SimulationParams, 'ND'>;
  NDRange: number[];
  sweepType?: 'ND' | 'tau' | 'PJ';
  secondaryRange?: number[];
}

export interface SweepResult {
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

export async function runSimulation(params: SimulationParams): Promise<SingleRunResult> {
  const { data, error } = await supabase.functions.invoke('simulate', {
    body: params,
  });

  if (error) {
    throw new Error(error.message || 'Simulation failed');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data as SingleRunResult;
}

export async function runSweep(params: SweepParams): Promise<SweepResult> {
  const { data, error } = await supabase.functions.invoke('simulate/sweep', {
    body: params,
  });

  if (error) {
    throw new Error(error.message || 'Sweep failed');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data as SweepResult;
}

export function generateDefaultParams(seed?: number): SimulationParams {
  return {
    N: 20,
    NR: 1,
    ND: 5,
    PT: 10,
    PJ: 10,
    sigma2: 1,
    tau: 0.2,
    h: new Array(20).fill(1),
    g: new Array(20).fill(1),
    defenderPolicy: 'D1',
    jammerMode: 'J1',
    topK: 3,
    seed,
  };
}

export function generateRandomChannelGains(N: number, seed?: number): { h: number[], g: number[] } {
  const random = seed !== undefined ? seededRandom(seed) : Math.random;
  const h = Array.from({ length: N }, () => 0.5 + random() * 1.5);
  const g = Array.from({ length: N }, () => 0.5 + random() * 1.5);
  return { h, g };
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

export function exportToCSV(data: SweepResult): string {
  const rows = ['ND,U_real'];
  for (let i = 0; i < data.NDValues.length; i++) {
    rows.push(`${data.NDValues[i]},${data.U_realValues[i]}`);
  }
  rows.push('');
  rows.push(`Best ND,${data.bestND}`);
  rows.push(`Best U_real,${data.bestU_real}`);
  return rows.join('\n');
}