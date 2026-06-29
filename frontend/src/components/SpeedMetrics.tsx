import React, { useState } from 'react';
import { api } from '../services/api';
import type { BenchmarkResult } from '../types';

interface SpeedMetricsProps {
  onLog: (msg: string, agent: 'System' | 'Renderer' | 'Assessor' | 'Evolution' | 'Cheminformatics', status: 'running' | 'success' | 'error') => void;
}

export const SpeedMetrics: React.FC<SpeedMetricsProps> = ({ onLog }) => {
  const [prompt, setPrompt] = useState('Explain why ultra-low latency inference is essential for closed-loop visual feedback systems.');
  const [running, setRunning] = useState(false);
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || running) return;

    setRunning(true);
    onLog('Starting benchmark execution comparing Cerebras Cloud vs standard GPU latency...', 'System', 'running');

    try {
      const res = await api.runBenchmark(prompt);
      setBenchmark(res);
      onLog(`Benchmark complete! Cerebras: ${res.cerebras.total_latency}s | GPU: ${res.gpu_baseline.total_latency}s (${res.speedups.overall_multiplier}x speedup)`, 'System', 'success');
    } catch (err: any) {
      console.error(err);
      onLog(`Benchmark run failed: ${err.message || err}`, 'System', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="panel-title">
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        Speed Benchmark
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Compare Cerebras inference speed against standard cloud GPU instances.
      </p>

      <form onSubmit={handleRun} style={{ display: 'flex', gap: '8px' }}>
        <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="Custom benchmark prompt..." className="input-field" disabled={running} />
        <button type="submit" className="btn" disabled={running} style={{ minWidth: '120px' }}>
          {running ? 'Running...' : 'Benchmark'}
        </button>
      </form>

      {benchmark && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Speedup Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="metric-card">
              <div className="metric-label">TTFT Speedup</div>
              <div className="metric-value positive">{benchmark.speedups.ttft_multiplier}×</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Faster first token</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Throughput Speedup</div>
              <div className="metric-value positive">{benchmark.speedups.tps_multiplier}×</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>More tokens/sec</div>
            </div>
          </div>

          {/* TTFT Progress */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '5px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Time-To-First-Token</span>
              <span style={{ color: 'var(--text-muted)' }}>
                Cerebras: <strong style={{ color: 'var(--accent-primary)' }}>{benchmark.cerebras.ttft}s</strong> vs GPU: <strong>{benchmark.gpu_baseline.ttft}s</strong>
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill blue" style={{ width: `${Math.max(3, (benchmark.cerebras.ttft / benchmark.gpu_baseline.ttft) * 100)}%` }} />
            </div>
          </div>

          {/* Throughput Progress */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '5px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Throughput (tokens/s)</span>
              <span style={{ color: 'var(--text-muted)' }}>
                Cerebras: <strong style={{ color: 'var(--accent-primary)' }}>{benchmark.cerebras.tps}</strong> vs GPU: <strong>{benchmark.gpu_baseline.tps}</strong>
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill indigo" style={{ width: `${Math.min(100, (benchmark.cerebras.tps / 400) * 100)}%` }} />
            </div>
          </div>

          {/* Response Preview */}
          <div className="sequence-box" style={{ maxHeight: '80px' }}>
            <strong style={{ color: 'var(--accent-primary)' }}>Response: </strong>
            {benchmark.response}
          </div>
        </div>
      )}
    </div>
  );
};
