import React, { useEffect, useRef, useState } from 'react';
import {
  FlaskConical,
  GitBranch,
  Dna,
  ExternalLink,
  ChevronRight,
  BadgeCheck,
  Building2,
  TrendingUp,
  Layers,
  Search,
  AlertCircle,
  BarChart3,
  Sparkles,
  Brain,
  Eye,
} from 'lucide-react';
import { api } from '../services/api';
import type { ProteinInfo } from '../types';


interface ClinicalPortalProps {
  protein: ProteinInfo | null;
  onLog: (msg: string, agent: 'System' | 'Renderer' | 'Assessor' | 'Evolution' | 'Cheminformatics', status: 'running' | 'success' | 'error') => void;
}

/** Minimal markdown-like paragraph renderer for Gemma 4 output */
const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  return (
    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
      {text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <br key={i} />;
        if (trimmed.startsWith('## ') || trimmed.startsWith('**') && trimmed.endsWith('**')) {
          return <h4 key={i} style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-800)', margin: '10px 0 4px' }}>{trimmed.replace(/^#+\s*|\*\*/g, '')}</h4>;
        }
        if (trimmed.startsWith('1.') || trimmed.startsWith('2.') || trimmed.startsWith('3.') || trimmed.startsWith('4.')) {
          const parts = trimmed.match(/^(\d+\.\s*)(.+)/) ?? [];
          return <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}><span style={{ color: 'var(--accent-primary)', fontWeight: 700, flexShrink: 0 }}>{parts[1]}</span><span>{parts[2]}</span></div>;
        }
        return <p key={i} style={{ margin: '0 0 4px 0' }}>{trimmed}</p>;
      })}
    </div>
  );
};

// ── Status badge chip ─────────────────────────────────────────────────────────
const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    RECRUITING:              { bg: '#dcfce7', text: '#15803d', label: 'Recruiting' },
    COMPLETED:               { bg: '#f1f5f9', text: '#475569', label: 'Completed' },
    ACTIVE_NOT_RECRUITING:   { bg: '#fef9c3', text: '#a16207', label: 'Active' },
    NOT_YET_RECRUITING:      { bg: '#eff6ff', text: '#1d4ed8', label: 'Not Yet Open' },
    TERMINATED:              { bg: '#fee2e2', text: '#b91c1c', label: 'Terminated' },
    SUSPENDED:               { bg: '#fdf2f8', text: '#9d174d', label: 'Suspended' },
    WITHDRAWN:               { bg: '#f3f4f6', text: '#6b7280', label: 'Withdrawn' },
  };
  const cfg = map[status] ?? { bg: '#f1f5f9', text: '#64748b', label: status };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '999px',
      fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.02em',
      background: cfg.bg, color: cfg.text,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.text, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
};

// ── Phase badge ───────────────────────────────────────────────────────────────
const PhaseBadge: React.FC<{ phase: string }> = ({ phase }) => {
  if (!phase) return null;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '4px',
      fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.04em',
      background: '#eff6ff', color: '#1d4ed8',
      border: '1px solid #bfdbfe',
      textTransform: 'uppercase',
    }}>
      {phase}
    </span>
  );
};

// ── Section header ────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; sub?: string; count?: number }> = ({ icon, title, sub, count }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
    <div style={{
      width: 36, height: 36, borderRadius: '10px',
      background: 'var(--blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--accent-primary)', flexShrink: 0,
    }}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--navy-800)', margin: 0 }}>{title}</h3>
        {count !== undefined && (
          <span style={{
            fontSize: '0.68rem', fontWeight: 600, color: 'var(--accent-primary)',
            background: 'var(--blue-50)', padding: '1px 7px', borderRadius: '999px',
          }}>{count}</span>
        )}
      </div>
      {sub && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{sub}</p>}
    </div>
  </div>
);

// ── Skeleton loader ───────────────────────────────────────────────────────────
const Skeleton: React.FC<{ lines?: number; message: string }> = ({ lines = 3, message }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
      <div className="spinner" style={{ width: 16, height: 16 }} />
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{message}</span>
    </div>
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} style={{
        height: i === 0 ? 56 : 44,
        borderRadius: 8, background: 'var(--gray-100)',
        marginBottom: 10,
        animation: 'pulse 1.5s ease-in-out infinite',
        opacity: 1 - i * 0.15,
      }} />
    ))}
  </div>
);

// ── Empty state ───────────────────────────────────────────────────────────────
const Empty: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ textAlign: 'center', padding: '32px 16px' }}>
    <AlertCircle size={28} color="var(--gray-300)" strokeWidth={1.5} />
    <p style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 220, margin: '10px auto 0' }}>{message}</p>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
export const ClinicalPortal: React.FC<ClinicalPortalProps> = ({ protein, onLog }) => {
  const [gtex,     setGtex]     = useState<any[]>([]);
  const [pathways, setPathways] = useState<any[]>([]);
  const [trials,   setTrials]   = useState<any[]>([]);

  const [loadingGtex,     setLoadingGtex]     = useState(false);
  const [loadingPathways, setLoadingPathways] = useState(false);
  const [loadingTrials,   setLoadingTrials]   = useState(false);

  // ── Enhancement 3: Gemma 4 GTEx chart interpretation ──────────────────────
  const [chartInterpretation, setChartInterpretation]     = useState<string>('');
  const [loadingInterpretation, setLoadingInterpretation] = useState(false);
  const [showInterpretation, setShowInterpretation]       = useState(false);
  const gtexChartRef = useRef<HTMLDivElement>(null);

  /**
   * Renders the GTEx bar chart to an off-screen HTML5 Canvas, exports it as
   * a PNG base64 string, and sends it to the Gemma 4 Vision endpoint.
   * This is Enhancement 3: GTEx Chart → Gemma 4 Clinical Interpretation.
   */
  const interpretGTExChart = async () => {
    if (!protein || gtex.length === 0) return;
    const gene = protein.geneName || protein.accession;

    setLoadingInterpretation(true);
    setShowInterpretation(true);
    setChartInterpretation('');

    try {
      // Draw bar chart to canvas
      const canvas = document.createElement('canvas');
      const W = 800, BAR_H = 28, PAD = 60, LABEL_W = 220;
      canvas.width  = W;
      canvas.height = PAD + gtex.length * (BAR_H + 8) + PAD;
      const ctx = canvas.getContext('2d')!;

      const maxTpm = Math.max(...gtex.map((g: any) => g.median), 1);

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Title
      ctx.fillStyle = '#0f2035';
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillText(`${gene} — GTEx V10 Tissue Expression (TPM)`, PAD, 36);

      gtex.forEach((item: any, i: number) => {
        const y   = PAD + i * (BAR_H + 8) + 10;
        const pct = Math.min(1, item.median / maxTpm);
        const barW = Math.max(2, pct * (W - LABEL_W - PAD * 2));

        // Tissue label
        ctx.fillStyle = '#334155';
        ctx.font = '11px Inter, sans-serif';
        const label = item.tissueSiteDetailId.replace(/_/g, ' ').substring(0, 30);
        ctx.fillText(label, PAD, y + BAR_H / 2 + 4);

        // Bar
        const grad = ctx.createLinearGradient(LABEL_W, y, LABEL_W + barW, y);
        grad.addColorStop(0, i === 0 ? '#2563eb' : '#93c5fd');
        grad.addColorStop(1, i === 0 ? '#4f46e5' : '#a5b4fc');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(LABEL_W, y, barW, BAR_H, 4);
        ctx.fill();

        // Value
        ctx.fillStyle = '#64748b';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(`${item.median.toFixed(1)} TPM`, LABEL_W + barW + 6, y + BAR_H / 2 + 4);
      });

      const chartB64 = canvas.toDataURL('image/png');

      const context = `GTEx V10 RNA expression profile for gene ${gene} across human tissues. Values are median TPM (Transcripts Per Million) normalized expression levels.`;

      const result = await api.interpretChart(chartB64, context, gene);
      setChartInterpretation(result.interpretation);
    } catch (err: any) {
      setChartInterpretation(`Analysis failed: ${err.message || String(err)}`);
    } finally {
      setLoadingInterpretation(false);
    }
  };

  useEffect(() => {
    setGtex([]); setPathways([]); setTrials([]);
    if (!protein) return;

    const gene      = protein.geneName  || '';
    const accession = protein.accession || '';

    (async () => {
      if (gene) {
        setLoadingGtex(true);
        onLog(`Querying GTEx portal expression for ${gene}...`, 'System', 'running');
        try {
          const r = await api.getGTExExpression(gene);
          if (r.success) { setGtex(r.results); onLog(`GTEx data loaded for ${gene}.`, 'System', 'success'); }
        } catch { /* silent */ } finally { setLoadingGtex(false); }
      }

      if (accession) {
        setLoadingPathways(true);
        onLog(`Mapping Reactome pathways for ${accession}...`, 'System', 'running');
        try {
          const r = await api.getReactomePathways(accession);
          if (r.success) { setPathways(r.results); onLog(`Mapped ${r.results.length} pathways.`, 'System', 'success'); }
        } catch { /* silent */ } finally { setLoadingPathways(false); }
      }

      if (gene) {
        setLoadingTrials(true);
        onLog(`Searching ClinicalTrials.gov for ${gene}...`, 'System', 'running');
        try {
          const r = await api.getClinicalTrials(gene);
          if (r.success) { setTrials(r.results); onLog(`Retrieved ${r.results.length} clinical trial records.`, 'System', 'success'); }
        } catch { /* silent */ } finally { setLoadingTrials(false); }
      }
    })();
  }, [protein]);

  // ── No protein selected ───────────────────────────────────────────────────
  if (!protein) {
    return (
      <div style={{
        minHeight: 480, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        gap: 16, padding: '40px 24px',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'var(--blue-50)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--accent-primary)',
        }}>
          <Search size={32} strokeWidth={1.5} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy-800)', marginBottom: 8 }}>
            No Target Protein Selected
          </h3>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', maxWidth: 340, lineHeight: 1.6 }}>
            Select a protein template or search UniProt in the{' '}
            <strong style={{ color: 'var(--accent-primary)' }}>Molecular Workspace</strong>{' '}
            to populate clinical and translational data.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          {['GTEx Expression', 'Reactome Pathways', 'Clinical Trials'].map(label => (
            <span key={label} style={{
              padding: '5px 12px', borderRadius: 8,
              background: 'var(--gray-100)', color: 'var(--text-muted)',
              fontSize: '0.75rem', fontWeight: 500,
              border: '1px solid var(--gray-200)',
            }}>
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const maxTpm = Math.max(...gtex.map(g => g.median), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Target Hero Banner ─────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'linear-gradient(135deg, var(--blue-50), #e0e7ff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: 'var(--accent-primary)',
        }}>
          <Dna size={26} strokeWidth={1.8} />
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 4 }}>
            Translational Target Profile
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-900)', margin: '0 0 4px 0', lineHeight: 1.3 }}>
            {protein.name}
          </h2>
          {protein.function && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, maxWidth: 600, lineHeight: 1.5 }}>
              {protein.function.length > 160 ? protein.function.slice(0, 160) + '…' : protein.function}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Accession', value: protein.accession },
            { label: 'Gene',      value: protein.geneName  || '—' },
            { label: 'Organism',  value: protein.organism  || '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              padding: '8px 14px', borderRadius: 10,
              background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
              textAlign: 'center', minWidth: 80,
            }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--navy-800)', fontFamily: label === 'Accession' ? 'var(--font-mono)' : 'inherit' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main 2-col grid ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT: Clinical Trials ─────────────────────────────────────── */}
        <div style={{
          background: 'var(--white)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', padding: '20px 22px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <SectionHeader
            icon={<FlaskConical size={18} strokeWidth={2} />}
            title="ClinicalTrials.gov Studies"
            sub="Active, recruiting & completed intervention trials"
            count={trials.length}
          />

          {loadingTrials ? (
            <Skeleton lines={3} message="Querying ClinicalTrials.gov API…" />
          ) : trials.length === 0 ? (
            <Empty message="No trials matched this gene symbol." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {trials.map((trial, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid var(--gray-200)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    background: 'var(--gray-50)',
                    transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--blue-500)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--gray-200)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  }}
                >
                  {/* Row 1: ID + badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <a
                      href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontFamily: 'var(--font-mono)', fontSize: '0.73rem', fontWeight: 600,
                        color: 'var(--accent-primary)', textDecoration: 'none',
                        padding: '2px 8px', background: 'var(--blue-50)',
                        border: '1px solid var(--blue-100)', borderRadius: 6,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#dbeafe')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--blue-50)')}
                    >
                      {trial.nct_id}
                      <ExternalLink size={10} />
                    </a>
                    <StatusChip status={trial.status} />
                    <PhaseBadge phase={trial.phase} />
                  </div>

                  {/* Row 2: Title */}
                  <h4 style={{ fontSize: '0.86rem', fontWeight: 650, color: 'var(--navy-800)', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                    {trial.title}
                  </h4>

                  {/* Row 3: Summary */}
                  <p style={{
                    fontSize: '0.77rem', color: 'var(--text-secondary)', margin: '0 0 10px 0',
                    lineHeight: 1.55, display: '-webkit-box',
                    WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {trial.summary}
                  </p>

                  {/* Row 4: Sponsor */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    paddingTop: 10, borderTop: '1px solid var(--gray-200)',
                    fontSize: '0.72rem', color: 'var(--text-muted)',
                  }}>
                    <Building2 size={12} strokeWidth={2} />
                    <span>Lead Sponsor:</span>
                    <strong style={{ color: 'var(--text-secondary)' }}>{trial.sponsor}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT column ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* GTEx Expression */}
          <div ref={gtexChartRef} style={{
            background: 'var(--white)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', padding: '20px 22px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', flexShrink: 0 }}>
                  <BarChart3 size={18} strokeWidth={2} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--navy-800)', margin: 0 }}>Tissue Expression</h3>
                    {gtex.length > 0 && (
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--accent-primary)', background: 'var(--blue-50)', padding: '1px 7px', borderRadius: 999 }}>{gtex.length}</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>GTEx V10 · Median TPM</p>
                </div>
              </div>
              {/* Enhancement 3 — Gemma 4 Vision button */}
              {gtex.length > 0 && (
                <button
                  onClick={interpretGTExChart}
                  disabled={loadingInterpretation}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8, border: 'none', cursor: loadingInterpretation ? 'not-allowed' : 'pointer',
                    background: loadingInterpretation ? 'var(--gray-100)' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    color: loadingInterpretation ? 'var(--text-muted)' : '#fff',
                    fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--font-sans)',
                    transition: 'all 0.15s ease',
                    boxShadow: loadingInterpretation ? 'none' : '0 2px 8px rgba(124,58,237,0.3)',
                  }}
                >
                  {loadingInterpretation
                    ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Analyzing...</>
                    : <><Sparkles size={12} strokeWidth={2.5} /> Analyze with Gemma 4 Vision</>
                  }
                </button>
              )}
            </div>

            {loadingGtex ? (
              <Skeleton lines={4} message="Fetching GTEx transcript levels…" />
            ) : gtex.length === 0 ? (
              <Empty message="No expression data available for this gene." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {gtex.map((item, i) => {
                  const pct = Math.min(100, (item.median / maxTpm) * 100);
                  const isTop = i === 0;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isTop && <TrendingUp size={12} color="var(--success)" strokeWidth={2.5} />}
                          <span style={{ fontSize: '0.78rem', fontWeight: isTop ? 700 : 500, color: isTop ? 'var(--navy-800)' : 'var(--text-primary)' }}>
                            {item.tissueSiteDetailId.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                          {item.median.toFixed(1)}
                        </span>
                      </div>
                      <div style={{ height: 7, borderRadius: 99, background: 'var(--gray-100)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 99, width: `${pct}%`,
                          background: isTop
                            ? 'linear-gradient(to right, #2563eb, #4f46e5)'
                            : 'linear-gradient(to right, #93c5fd, #a5b4fc)',
                          transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                        }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 6, fontSize: '0.66rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                  Transcripts Per Million (TPM)
                </div>
              </div>
            )}

            {/* Enhancement 3 — Gemma 4 Chart Interpretation Panel */}
            {showInterpretation && (
              <div style={{
                marginTop: 16, borderTop: '1px solid var(--gray-200)', paddingTop: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Brain size={14} color="#7c3aed" strokeWidth={2} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7c3aed' }}>Gemma 4 Clinical Interpretation</span>
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                    background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe',
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    <Eye size={9} /> Vision · 1 chart image
                  </span>
                  {chartInterpretation && (
                    <button onClick={() => setShowInterpretation(false)} style={{
                      marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer',
                      fontSize: '0.7rem', color: 'var(--text-muted)', padding: '2px 6px',
                    }}>Dismiss</button>
                  )}
                </div>

                {loadingInterpretation ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    Gemma 4 is reading the expression chart...
                  </div>
                ) : (
                  <div style={{
                    background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10,
                    padding: '14px 16px',
                  }}>
                    <SimpleMarkdown text={chartInterpretation} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reactome Pathways */}
          <div style={{
            background: 'var(--white)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', padding: '20px 22px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <SectionHeader
              icon={<GitBranch size={18} strokeWidth={2} />}
              title="Reactome Pathways"
              sub="Enriched biological pathways · FDR-filtered"
              count={pathways.length}
            />

            {loadingPathways ? (
              <Skeleton lines={4} message="Analyzing cellular pathways in Reactome…" />
            ) : pathways.length === 0 ? (
              <Empty message="No pathway associations detected." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pathways.map((path, i) => (
                  <a
                    key={i}
                    href={`https://reactome.org/content/detail/${path.stId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 10,
                      border: '1px solid var(--gray-200)',
                      background: 'var(--gray-50)',
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = 'var(--blue-500)';
                      el.style.background = 'var(--blue-50)';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = 'var(--gray-200)';
                      el.style.background = 'var(--gray-50)';
                    }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--blue-50), #e0e7ff)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--accent-primary)',
                      }}>
                        <Layers size={14} strokeWidth={2} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 2 }}>
                          {path.stId}
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy-800)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {path.name}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{
                          fontSize: '0.65rem', fontWeight: 700,
                          color: 'var(--accent-primary)',
                          background: 'var(--blue-50)', border: '1px solid var(--blue-100)',
                          padding: '2px 6px', borderRadius: 4, marginBottom: 2,
                        }}>
                          p={path.pValue < 0.0001 ? path.pValue.toExponential(1) : path.pValue.toFixed(4)}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                          FDR {path.fdr < 0.0001 ? path.fdr.toExponential(1) : path.fdr.toFixed(3)}
                        </div>
                      </div>

                      <ChevronRight size={14} color="var(--gray-400)" strokeWidth={2} />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Data source credits */}
          <div style={{
            padding: '12px 16px', borderRadius: 10,
            background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
          }}>
            <div style={{ fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Data Sources
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { icon: <BadgeCheck size={12} color="var(--success)" />, label: 'GTEx Portal V10', desc: 'NIH Common Fund' },
                { icon: <BadgeCheck size={12} color="var(--success)" />, label: 'Reactome v89',    desc: 'EBI / OICR' },
                { icon: <BadgeCheck size={12} color="var(--success)" />, label: 'ClinicalTrials.gov API v2', desc: 'U.S. National Library of Medicine' },
              ].map(({ icon, label, desc }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {icon}
                  <span style={{ fontSize: '0.73rem', color: 'var(--text-primary)', fontWeight: 550 }}>{label}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>· {desc}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
