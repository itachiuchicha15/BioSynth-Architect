import React, { useState } from 'react';
import { api } from '../services/api';
import { WebGLViewer } from './WebGLViewer';
import type { MutationFiles, MutationMetrics } from '../types';

interface StructureViewerProps {
  files: MutationFiles | null;
  metrics: MutationMetrics | null;
  ligands: any[];
  loadingLigands: boolean;
}

export const StructureViewer: React.FC<StructureViewerProps> = ({
  files, metrics, ligands, loadingLigands
}) => {
  const [viewMode, setViewMode] = useState<'interactive' | 'static'>('interactive');

  if (!files || !metrics) {
    return (
      <div className="panel empty-state" style={{ minHeight: '380px' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        <p>Simulation results will be rendered here.</p>
        <span className="hint">Choose a protein, residue, and click "Synthesize Mutant" to start.</span>
      </div>
    );
  }

  const contactDiff = metrics.mutant_contacts - metrics.wildtype_contacts;
  const resiMatch = files.structure_file.match(/_mut_(\d+)_/);
  const residueIndex = resiMatch ? resiMatch[1] : '100';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* 3D / Static Viewer Panel */}
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>
            Structure Viewer
          </div>
          <div className="view-toggle">
            <button className={viewMode === 'interactive' ? 'active' : ''} onClick={() => setViewMode('interactive')}>
              Interactive 3D
            </button>
            <button className={viewMode === 'static' ? 'active' : ''} onClick={() => setViewMode('static')}>
              Static (PyMOL)
            </button>
          </div>
        </div>

        {viewMode === 'interactive' ? (
          <WebGLViewer pdbUrl={api.getAssetUrl(files.structure_file)} residueIndex={residueIndex} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <img src={api.getAssetUrl(files.wt_pocket)} alt="Wild-type pocket" style={{ width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }} />
              <div className="img-label">WT: {metrics.original_aa}</div>
            </div>
            <div style={{ position: 'relative' }}>
              <img src={api.getAssetUrl(files.mut_pocket)} alt="Mutant pocket" style={{ width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }} />
              <div className="img-label" style={{ background: 'var(--accent-secondary)' }}>MUT: {metrics.target_aa}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'flex-end' }}>
          <a href={api.getAssetUrl(files.session_file)} download className="btn btn-secondary btn-sm">
            Download .PSE
          </a>
          <a href={api.getAssetUrl(files.structure_file)} download className="btn btn-secondary btn-sm">
            Export .PDB
          </a>
        </div>
      </div>

      {/* Pocket Metrics */}
      <div className="panel">
        <div className="panel-title">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          Pocket Mechanics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div className="metric-card">
            <div className="metric-label">WT Contacts</div>
            <div className="metric-value">{metrics.wildtype_contacts}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Mutant Contacts</div>
            <div className="metric-value">{metrics.mutant_contacts}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">H-Bond Delta</div>
            <div className={`metric-value ${contactDiff > 0 ? 'positive' : contactDiff < 0 ? 'negative' : ''}`}>
              {contactDiff > 0 ? `+${contactDiff}` : contactDiff}
            </div>
          </div>
        </div>
      </div>

      {/* ChEMBL Ligands */}
      <div className="panel">
        <div className="panel-title">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
          Bioactivity (ChEMBL Ligands)
        </div>

        {loadingLigands ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div className="spinner" />
            <p style={{ marginTop: '10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Querying ChEMBL...</p>
          </div>
        ) : ligands.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
            No active small molecule ligands found for this target.
          </p>
        ) : (
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ChEMBL ID</th>
                  <th>Type</th>
                  <th>Activity</th>
                  <th>Value</th>
                  <th>Journal</th>
                </tr>
              </thead>
              <tbody>
                {ligands.map((lig, i) => (
                  <tr key={i}>
                    <td className="mono">{lig.molecule_chembl_id}</td>
                    <td>{lig.standard_relation || '='}</td>
                    <td>{lig.standard_type}</td>
                    <td style={{ fontWeight: 600 }}>
                      {lig.standard_value ? parseFloat(lig.standard_value).toFixed(2) : 'N/A'} {lig.standard_units || 'nM'}
                    </td>
                    <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={lig.document_journal || 'N/A'}>
                      {lig.document_journal ? `${lig.document_journal} (${lig.document_year || ''})` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
