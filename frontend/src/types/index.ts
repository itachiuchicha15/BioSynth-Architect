export interface ProteinInfo {
  accession: string;
  name?: string;
  geneName?: string;
  organism?: string;
  function?: string;
  sequence?: string;
}

export interface MutationMetrics {
  original_aa: string;
  target_aa: string;
  wildtype_contacts: number;
  mutant_contacts: number;
}

export interface MutationFiles {
  wt_pocket: string;
  mut_pocket: string;
  mutant_full: string;
  session_file: string;
  structure_file: string;
  /** Enhancement 2 — rotation view paths at 0°, 90°, 180° */
  rotation_views?: string[];
}

export interface MutationResult {
  success: boolean;
  metrics: MutationMetrics;
  files: MutationFiles;
  log: string;
}

export interface BenchmarkMetrics {
  ttft: number;
  tps: number;
  total_latency: number;
}

export interface BenchmarkResult {
  prompt: string;
  response: string;
  token_count: number;
  cerebras: BenchmarkMetrics;
  gpu_baseline: BenchmarkMetrics;
  speedups: {
    ttft_multiplier: number;
    tps_multiplier: number;
    overall_multiplier: number;
  };
}

/** Metadata about which Gemma 4 vision mode was used */
export interface VisionMetadata {
  images_used: number;
  prompt_mode: 'interleaved_text_image' | 'multi_angle_spatial' | 'chart_interpretation';
  model: string;
  angles_degrees?: number[];
  gene?: string;
}

export interface AgentResponse {
  content?: string;
  transcripts?: {
    assessor: string;
    spatial?: string;
    evolution: string;
    cheminformatics: string;
    director: string;
  };
  /** Enhancement 1 & 2 — vision metadata from multimodal agents */
  vision_metadata?: {
    assessor?: VisionMetadata;
    spatial?: VisionMetadata;
  };
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens: number;
  };
  metrics: {
    total_latency_sec: number;
    ttft_sec?: number;
    tokens_per_sec: number;
    is_cerebras: boolean;
  };
}

/** Enhancement 3 — GTEx chart interpretation response */
export interface ChartInterpretationResult {
  success: boolean;
  interpretation: string;
  vision_metadata: VisionMetadata;
  metrics: {
    total_latency_sec: number;
    tokens_per_sec: number;
    is_cerebras: boolean;
  };
  usage: {
    total_tokens: number;
  };
}

export interface AgentLog {
  agentName: 'Renderer' | 'Assessor' | 'Spatial' | 'Evolution' | 'Cheminformatics' | 'System';
  message: string;
  status: 'idle' | 'running' | 'success' | 'error';
  timestamp: string;
}
