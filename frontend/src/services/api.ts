import type {
  MutationResult,
  BenchmarkResult,
  AgentResponse,
  ChartInterpretationResult,
} from '../types';

const API_BASE_URL = 'http://localhost:8000';

class BioSynthAPIClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `API error: ${response.statusText}`);
      }
      return await response.json() as T;
    } catch (error) {
      console.error(`Request to ${url} failed:`, error);
      throw error;
    }
  }

  getAssetUrl(relativePath: string): string {
    return `${API_BASE_URL}/${relativePath}`;
  }

  async searchProteins(query: string, limit: number = 5): Promise<{ success: boolean; results: any[] }> {
    return this.request<{ success: boolean; results: any[] }>('/api/protein/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    });
  }

  async fetchProteinInfo(accession: string): Promise<{ success: boolean; data: any }> {
    return this.request<{ success: boolean; data: any }>(`/api/protein/info/${accession}`);
  }

  async downloadStructure(accession: string): Promise<{ success: boolean; filepath: string }> {
    return this.request<{ success: boolean; filepath: string }>(`/api/protein/structure/${accession}`, {
      method: 'POST',
    });
  }

  async getChEMBLCompounds(accession: string, limit: number = 10): Promise<{ success: boolean; compounds: any[] }> {
    return this.request<{ success: boolean; compounds: any[] }>(`/api/protein/compounds/${accession}?limit=${limit}`);
  }

  async runMutagenesis(
    structurePath: string,
    residue: string,
    targetAA: string,
    chain: string = 'A'
  ): Promise<MutationResult> {
    return this.request<MutationResult>('/api/mutate/run', {
      method: 'POST',
      body: JSON.stringify({
        structure_path: structurePath,
        residue,
        target_aa: targetAA,
        chain,
      }),
    });
  }

  /**
   * Enhancement 1 & 2: Extended assess call now supports:
   * - full_protein_rel_path: 3rd image for interleaved 3-image assessor
   * - rotation_view_paths:   multi-angle rotation views for Spatial agent
   */
  async assessMutation(
    wtImageRelPath: string,
    mutImageRelPath: string,
    mutationDescription: string,
    reasoningEffort: string = 'high',
    compounds: any[] = [],
    fullProteinRelPath?: string,
    rotationViewPaths?: string[],
  ): Promise<AgentResponse> {
    return this.request<AgentResponse>('/api/agent/assess', {
      method: 'POST',
      body: JSON.stringify({
        wt_image_rel_path:     wtImageRelPath,
        mut_image_rel_path:    mutImageRelPath,
        mutation_description:  mutationDescription,
        reasoning_effort:      reasoningEffort,
        compounds,
        full_protein_rel_path: fullProteinRelPath,
        rotation_view_paths:   rotationViewPaths ?? [],
      }),
    });
  }

  async runBenchmark(prompt?: string): Promise<BenchmarkResult> {
    return this.request<BenchmarkResult>('/api/benchmark/run', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  async getGTExExpression(geneSymbol: string): Promise<{ success: boolean; results: any[] }> {
    return this.request<{ success: boolean; results: any[] }>(`/api/protein/gtex/${geneSymbol}`);
  }

  async getReactomePathways(accession: string): Promise<{ success: boolean; results: any[] }> {
    return this.request<{ success: boolean; results: any[] }>(`/api/protein/pathways/${accession}`);
  }

  async getClinicalTrials(geneSymbol: string): Promise<{ success: boolean; results: any[] }> {
    return this.request<{ success: boolean; results: any[] }>(`/api/protein/trials/${geneSymbol}`);
  }

  /**
   * Enhancement 3: Send a base64 chart image to Gemma 4 for clinical interpretation.
   * The frontend captures the GTEx expression chart via canvas.toDataURL() and
   * sends the base64 payload here for multimodal analysis.
   */
  async interpretChart(
    chartImageB64: string,
    chartContext: string,
    geneName: string,
  ): Promise<ChartInterpretationResult> {
    // Strip the data URI prefix if present ("data:image/png;base64,...")
    const cleanB64 = chartImageB64.startsWith('data:')
      ? chartImageB64.split(',')[1]
      : chartImageB64;

    return this.request<ChartInterpretationResult>('/api/agent/interpret-chart', {
      method: 'POST',
      body: JSON.stringify({
        chart_image_b64: cleanB64,
        chart_context:   chartContext,
        gene_name:       geneName,
      }),
    });
  }
}

export const api = new BioSynthAPIClient();
