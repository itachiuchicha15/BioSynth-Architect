import React, { useState, useEffect } from 'react';
import type { ProteinInfo } from '../types';

interface MutationFormProps {
  protein: ProteinInfo | null;
  onMutate: (residue: string, targetAA: string, chain: string) => void;
  loading: boolean;
}

const AMINO_ACIDS = [
  { code: 'ALA', name: 'Alanine (A)' },
  { code: 'ARG', name: 'Arginine (R)' },
  { code: 'ASN', name: 'Asparagine (N)' },
  { code: 'ASP', name: 'Aspartic Acid (D)' },
  { code: 'CYS', name: 'Cysteine (C)' },
  { code: 'GLN', name: 'Glutamine (Q)' },
  { code: 'GLU', name: 'Glutamic Acid (E)' },
  { code: 'GLY', name: 'Glycine (G)' },
  { code: 'HIS', name: 'Histidine (H)' },
  { code: 'ILE', name: 'Isoleucine (I)' },
  { code: 'LEU', name: 'Leucine (L)' },
  { code: 'LYS', name: 'Lysine (K)' },
  { code: 'MET', name: 'Methionine (M)' },
  { code: 'PHE', name: 'Phenylalanine (F)' },
  { code: 'PRO', name: 'Proline (P)' },
  { code: 'SER', name: 'Serine (S)' },
  { code: 'THR', name: 'Threonine (T)' },
  { code: 'TRP', name: 'Tryptophan (W)' },
  { code: 'TYR', name: 'Tyrosine (Y)' },
  { code: 'VAL', name: 'Valine (V)' }
];

export const MutationForm: React.FC<MutationFormProps> = ({ protein, onMutate, loading }) => {
  const [residue, setResidue] = useState('600');
  const [targetAA, setTargetAA] = useState('GLU');
  const [chain, setChain] = useState('A');
  const [detectedWT, setDetectedWT] = useState<string>('');

  useEffect(() => {
    if (!protein) return;
    if (protein.accession === 'P15056') {
      setResidue('600'); setTargetAA('GLU');
    } else if (protein.accession === 'P01112') {
      setResidue('12'); setTargetAA('ASP');
    } else if (protein.accession === 'A0A0K8P6T7') {
      setResidue('233'); setTargetAA('ALA');
    } else {
      setResidue('100'); setTargetAA('ALA');
    }
  }, [protein]);

  useEffect(() => {
    if (!protein || !protein.sequence || !residue) { setDetectedWT(''); return; }
    const idx = parseInt(residue, 10) - 1;
    if (idx >= 0 && idx < protein.sequence.length) {
      setDetectedWT(protein.sequence[idx]);
    } else {
      setDetectedWT('?');
    }
  }, [protein, residue]);

  if (!protein) {
    return (
      <div className="panel empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <p>Select a target protein to begin simulation.</p>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!residue || !targetAA) return;
    onMutate(residue, targetAA, chain);
  };

  return (
    <div className="panel">
      <div className="panel-title">
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
        </svg>
        Mutation Workspace
      </div>

      {/* Active Protein Info */}
      <div style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '14px', marginBottom: '14px' }}>
        <div className="info-row">
          <span className="label">Active ID</span>
          <span className="value accent">{protein.accession}</span>
        </div>
        <div className="info-row">
          <span className="label">Name</span>
          <span className="value">{protein.name}</span>
        </div>
        <div className="info-row">
          <span className="label">Gene</span>
          <span className="value" style={{ fontFamily: 'var(--font-mono)' }}>{protein.geneName}</span>
        </div>
        {protein.function && (
          <p style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            {protein.function}
          </p>
        )}
      </div>

      {/* Mutation Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 500 }}>
              Residue Index
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number"
                value={residue}
                onChange={(e) => setResidue(e.target.value)}
                className="input-field"
                disabled={loading}
                min="1"
                required
              />
              {detectedWT && (
                <span className="badge badge-blue" style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                  title={`Amino acid at index ${residue}: ${detectedWT}`}>
                  {detectedWT}
                </span>
              )}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 500 }}>
              Chain
            </label>
            <input
              type="text"
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              className="input-field"
              disabled={loading}
              required
            />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 500 }}>
            Target Amino Acid
          </label>
          <select
            value={targetAA}
            onChange={(e) => setTargetAA(e.target.value)}
            className="input-field"
            disabled={loading}
          >
            {AMINO_ACIDS.map((aa) => (
              <option key={aa.code} value={aa.code}>
                {aa.code} — {aa.name}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn" style={{ width: '100%' }}
          disabled={loading || !residue || detectedWT === '?'}>
          {loading ? 'Simulating Mutation...' : 'Synthesize Mutant'}
        </button>
      </form>

      {/* Sequence Preview */}
      {protein.sequence && (
        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 500 }}>
            FASTA Sequence
          </label>
          <div className="sequence-box">{protein.sequence}</div>
        </div>
      )}
    </div>
  );
};
