import React, { useState } from 'react';
import type { AgentLog, AgentResponse } from '../types';

interface AgentConsoleProps {
  logs: AgentLog[];
  assessment: AgentResponse | null;
  loading: boolean;
  onRunAssessment: (reasoningEffort: string) => void;
  hasMutated: boolean;
}

const AGENT_META: Record<string, { color: string; cssClass: string }> = {
  Renderer:        { color: 'var(--accent-primary)',     cssClass: 'agent-renderer' },
  Evolution:       { color: 'var(--warning)',            cssClass: 'agent-evolution' },
  Cheminformatics: { color: 'var(--success)',            cssClass: 'agent-cheminformatics' },
  Assessor:        { color: 'var(--accent-secondary)',   cssClass: 'agent-assessor' },
  Spatial:         { color: '#8b5cf6',                  cssClass: 'agent-assessor' },
  System:          { color: 'var(--text-muted)',         cssClass: 'agent-system' },
};

// Inline bolding (**) and code (`) formatter for Markdown
const renderInlineStyles = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 650, color: 'var(--navy-900)' }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{ 
          fontFamily: 'var(--font-mono)', 
          background: 'var(--gray-100)', 
          padding: '2px 6px', 
          borderRadius: '4px', 
          fontSize: '0.78rem',
          color: 'var(--accent-secondary)',
          border: '1px solid var(--border-default)'
        }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};

// Lightweight custom Markdown parser and formatter
const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: '6px' }} />;

        // Header 1 (# ...)
        if (line.startsWith('# ')) {
          return (
            <h1 key={i} style={{ 
              fontSize: '1.2rem', 
              fontWeight: 700, 
              color: 'var(--navy-800)', 
              marginTop: '10px',
              marginBottom: '4px',
              borderBottom: '1px solid var(--border-default)',
              paddingBottom: '4px'
            }}>
              {renderInlineStyles(line.substring(2))}
            </h1>
          );
        }

        // Header 2 (## ...)
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} style={{ 
              fontSize: '1.02rem', 
              fontWeight: 650, 
              color: 'var(--navy-700)', 
              marginTop: '8px',
              marginBottom: '2px'
            }}>
              {renderInlineStyles(line.substring(3))}
            </h2>
          );
        }

        // Header 3 (### ...)
        if (line.startsWith('### ')) {
          return (
            <h3 key={i} style={{ 
              fontSize: '0.9rem', 
              fontWeight: 600, 
              color: 'var(--text-primary)', 
              marginTop: '6px'
            }}>
              {renderInlineStyles(line.substring(4))}
            </h3>
          );
        }

        // Bullet list item (* ... or - ...)
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: '8px', paddingLeft: '10px', fontSize: '0.82rem', lineHeight: '1.5' }}>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>•</span>
              <div style={{ flex: 1, color: 'var(--text-secondary)' }}>
                {renderInlineStyles(trimmed.substring(2))}
              </div>
            </div>
          );
        }

        // Normal paragraph text
        return (
          <p key={i} style={{ margin: '0 0 4px 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            {renderInlineStyles(line)}
          </p>
        );
      })}
    </div>
  );
};

export const AgentConsole: React.FC<AgentConsoleProps> = ({
  logs, assessment, loading, onRunAssessment, hasMutated
}) => {
  const [effort, setEffort] = useState('high');
  const [activeTab, setActiveTab] = useState<string>('director');
  const [showReasoning, setShowReasoning] = useState(false);

  const parseContent = (content: string = '') => {
    if (content.includes('<think>')) {
      const parts = content.split('</think>');
      return { thinking: parts[0].replace('<think>', '').trim(), report: parts[1]?.trim() || '' };
    }
    return { thinking: '', report: content };
  };

  const getTabContent = () => {
    if (!assessment) return { text: '', thinking: '' };
    if (assessment.transcripts) {
      const tx = assessment.transcripts;
      if (activeTab === 'director') return { text: tx.director, thinking: '' };
      if (activeTab === 'evolution') return { text: tx.evolution, thinking: '' };
      if (activeTab === 'cheminformatics') return { text: tx.cheminformatics, thinking: '' };
      if (activeTab === 'spatial') return { text: tx.spatial ?? '', thinking: '' };
      if (activeTab === 'assessor') {
        const parsed = parseContent(tx.assessor);
        return { text: parsed.report, thinking: parsed.thinking };
      }
    } else if (assessment.content) {
      const parsed = parseContent(assessment.content);
      if (activeTab === 'report' || activeTab === 'director') return { text: parsed.report, thinking: parsed.thinking };
      if (activeTab === 'thinking') return { text: parsed.thinking, thinking: '' };
    }
    return { text: '', thinking: '' };
  };

  const { text: tabText, thinking: tabThinking } = getTabContent();

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            5-Agent Pipeline
          </div>
          {/* Vision badge */}
          {assessment?.vision_metadata?.assessor && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 999,
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em',
              background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Gemma 4 Vision · {assessment.vision_metadata.assessor.images_used} imgs
            </span>
          )}
        </div>
        {hasMutated && !assessment && !loading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={effort} onChange={(e) => setEffort(e.target.value)} className="input-field"
              style={{ padding: '5px 10px', fontSize: '0.75rem', width: 'auto' }}>
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <button onClick={() => onRunAssessment(effort)} className="btn btn-sm">
              Analyze with Gemma-4
            </button>
          </div>
        )}
      </div>

      {/* Agent Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
        {(['Renderer', 'Assessor', 'Spatial', 'Evolution', 'Cheminformatics'] as const).map((name) => {
          const agentLogs = logs.filter(l => l.agentName === name);
          const last = agentLogs[agentLogs.length - 1];
          const status = last ? last.status : 'idle';
          const meta = AGENT_META[name];
          const isVision = name === 'Assessor' || name === 'Spatial';

          return (
            <div className="agent-card" key={name} style={{ position: 'relative' }}>
              {isVision && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  fontSize: '0.55rem', fontWeight: 700,
                  background: '#ede9fe', color: '#7c3aed',
                  padding: '1px 4px', borderRadius: 4,
                }}>VISION</span>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="agent-name" style={{ color: meta.color }}>{name}</span>
                <span className={`status-dot ${status}`} />
              </div>
              <span className="agent-status-text">{last ? last.message : 'Standing by...'}</span>
            </div>
          );
        })}
      </div>

      {/* Terminal Logs */}
      <div className="terminal-box">
        {logs.map((log, i) => {
          const meta = AGENT_META[log.agentName] || AGENT_META['System'];
          return (
            <div key={i} className="terminal-line">
              <span className="ts">[{log.timestamp}]</span>{' '}
              <span className={`agent ${meta.cssClass}`}>{log.agentName}:</span>{' '}
              <span className={log.status === 'error' ? 'msg-error' : ''}>{log.message}</span>
            </div>
          );
        })}
      </div>

      {/* Loading Spinner */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div className="spinner" />
          <p style={{ marginTop: '12px', fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Running 5-Agent Gemma 4 Vision Pipeline on Cerebras...
          </p>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {['Assessor (3-img)', 'Spatial (3D)', 'Evolution', 'Chem', 'Director'].map(a => (
              <span key={a} style={{
                fontSize: '0.65rem', padding: '2px 8px', borderRadius: 999,
                background: 'var(--gray-100)', color: 'var(--text-muted)',
                border: '1px solid var(--gray-200)',
              }}>{a}</span>
            ))}
          </div>
        </div>
      )}

      {/* Assessment Output */}
      {assessment && !loading && (
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          
          {/* Tabs */}
          <div className="tab-bar">
            {assessment.transcripts ? (
              <>
                <button className={`tab-btn ${activeTab === 'director' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('director'); setShowReasoning(false); }}>
                  Consensus
                </button>
                <button className={`tab-btn ${activeTab === 'assessor' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('assessor'); setShowReasoning(false); }}>
                  👁 Visual Assessor
                </button>
                {assessment.transcripts.spatial && (
                  <button className={`tab-btn ${activeTab === 'spatial' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('spatial'); setShowReasoning(false); }}>
                    🔄 Spatial 3D
                  </button>
                )}
                <button className={`tab-btn ${activeTab === 'evolution' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('evolution'); setShowReasoning(false); }}>
                  Evolution
                </button>
                <button className={`tab-btn ${activeTab === 'cheminformatics' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('cheminformatics'); setShowReasoning(false); }}>
                  Affinity
                </button>
              </>
            ) : (
              <>
                <button className={`tab-btn ${activeTab === 'report' || activeTab === 'director' ? 'active' : ''}`}
                  onClick={() => setActiveTab('report')}>
                  Assessor Report
                </button>
                {tabThinking && (
                  <button className={`tab-btn ${activeTab === 'thinking' ? 'active' : ''}`}
                    onClick={() => setActiveTab('thinking')}>
                    Chain-of-Thought
                  </button>
                )}
              </>
            )}
          </div>

          {/* Reasoning Toggle */}
          {activeTab === 'assessor' && tabThinking && (
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowReasoning(!showReasoning)} className="btn btn-secondary btn-sm">
                {showReasoning ? 'Hide Thought Trace' : 'Show Thought Trace'}
              </button>
            </div>
          )}

          {/* Tab Content */}
          <div className="tab-content">
            {showReasoning && activeTab === 'assessor' && tabThinking ? (
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-secondary)', fontSize: '0.8rem' }}>
                {tabThinking}
              </div>
            ) : (
              <MarkdownRenderer text={tabText} />
            )}
          </div>

          {/* Footer */}
          <div className="tab-footer">
            <span>Inference: <strong>Cerebras</strong></span>
            <span>Latency: <strong>{assessment.metrics.total_latency_sec}s</strong></span>
            <span>Speed: <strong>{assessment.metrics.tokens_per_sec} t/s</strong></span>
            <span>Tokens: <strong>{assessment.usage?.total_tokens ?? '—'}</strong></span>
            {assessment.vision_metadata?.assessor && (
              <span style={{ color: '#7c3aed', fontWeight: 700 }}>
                🖼 {assessment.vision_metadata.assessor.images_used
                  + (assessment.vision_metadata.spatial?.images_used ?? 0)} imgs analyzed
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
