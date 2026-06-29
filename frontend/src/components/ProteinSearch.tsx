import React, { useState } from 'react';
import { api } from '../services/api';
import type { ProteinInfo } from '../types';

interface ProteinSearchProps {
  onSelectProtein: (protein: ProteinInfo) => void;
  onLog: (msg: string, agent: 'System' | 'Renderer' | 'Assessor' | 'Evolution' | 'Cheminformatics', status: 'running' | 'success' | 'error') => void;
}

const PRESETS: ProteinInfo[] = [
  {
    accession: 'P15056',
    name: 'BRAF Kinase',
    geneName: 'BRAF',
    organism: 'Human',
    function: 'Serine/threonine-protein kinase in the MAPK/ERK pathway. Frequently mutated in cancers (e.g. V600E).',
    sequence: 'MAALSGGGGGGAEPGQALFNGDMEPEAGAGAGAAASSAADPAIPEEVWNIKQMIKLTQEHIEALDKFGGEHNPPSIYQEDEYDEGLNDLDNDL'
  },
  {
    accession: 'P01112',
    name: 'GTPase KRas',
    geneName: 'KRAS',
    organism: 'Human',
    function: 'Ras proteins bind GDP/GTP and possess intrinsic GTPase activity. Crucial oncology drug target.',
    sequence: 'MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDI'
  },
  {
    accession: 'A0A0K8P6T7',
    name: 'PETase (PET Hydrolase)',
    geneName: 'PETase',
    organism: 'Ideonella sakaiensis',
    function: 'Enzyme capable of hydrolyzing PET plastic. Major target for industrial synthetic biology engineering.',
    sequence: 'MNFPRASRLMQAAVLGGLMAVSAAATAQTNPYARGPNPTAASLEASAGPFTVRSFTVSRPSGYGAGTVYYPTNAGGTVGAIAIVPGYTARQSSIKWWGPRLASHGFVVITIDTNSTLDQPSSRSSQQMAALRQVASLNGTSSSPIYGKVDTARMGVMGWSMGGGGSLISAANNPSLKAAAPQAPWDSSTNFSSVTVPTLIFACENDSIAPVNSSALPIYDSMSRNAKQFLEINGGSHSCANSGNSNQALIGKKGVAWMKRFMDNDTRYSTFACENPNSTRVSDFRTANCS'
  }
];

export const ProteinSearch: React.FC<ProteinSearchProps> = ({ onSelectProtein, onLog }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const formatOrganism = (org: any): string => {
    if (!org) return 'Unknown';
    if (typeof org === 'string') return org;
    return org.scientificName || org.commonName || JSON.stringify(org);
  };

  const formatGene = (gene: any): string => {
    if (!gene) return 'N/A';
    if (typeof gene === 'string') return gene;
    if (Array.isArray(gene)) return gene.join(', ');
    return gene.scientificName || JSON.stringify(gene);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    onLog(`Searching UniProtKB for "${query}"...`, 'System', 'running');

    try {
      const res = await api.searchProteins(query, 5);
      if (res.success && res.results && res.results.length > 0) {
        setSearchResults(res.results);
        onLog(`Found ${res.results.length} protein results in UniProt.`, 'System', 'success');
      } else {
        setSearchResults([]);
        onLog('No proteins matched the search query.', 'System', 'error');
      }
    } catch (err: any) {
      console.error(err);
      onLog(`Search failed: ${err.message || err}`, 'System', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectPreset = (preset: ProteinInfo) => {
    onSelectProtein(preset);
    onLog(`Selected preset template: ${preset.name} (${preset.accession})`, 'System', 'success');
  };

  const handleSelectResult = async (result: any) => {
    setLoading(true);
    const accession = result.accession;
    onLog(`Fetching detailed UniProt metadata for ${accession}...`, 'System', 'running');

    try {
      const res = await api.fetchProteinInfo(accession);
      if (res.success && res.data) {
        const info: ProteinInfo = {
          accession: res.data.accession || accession,
          name: res.data.protein_name || result.protein_name || 'Unknown Protein',
          geneName: formatGene(res.data.gene_names || result.gene_names),
          organism: formatOrganism(res.data.organism || result.organism),
          function: res.data.cc_function || 'Function not annotated.',
          sequence: res.data.sequence || ''
        };
        onSelectProtein(info);
        onLog(`Loaded metadata and sequence for ${info.name}.`, 'System', 'success');
      }
    } catch (err: any) {
      console.error(err);
      onLog(`Failed to fetch protein info: ${err.message || err}`, 'System', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-title">
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        Target Selection
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '4px' }}>
        {PRESETS.map(preset => (
          <button
            key={preset.accession}
            onClick={() => selectPreset(preset)}
            className="preset-btn"
          >
            <span className="preset-name">{preset.name}</span>
            <span className="badge badge-blue" style={{ marginLeft: '8px' }}>{preset.accession}</span>
            <span className="preset-meta">
              {preset.organism} · {preset.geneName}
            </span>
          </button>
        ))}
      </div>

      <div className="divider"><span>or search UniProt</span></div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. BRAF, PETase, Rubisco..."
          className="input-field"
          disabled={loading}
        />
        <button type="submit" className="btn" disabled={loading}>
          {loading ? '...' : 'Search'}
        </button>
      </form>

      {searchResults.length > 0 && (
        <div style={{
          marginTop: '12px',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--white)',
          maxHeight: '180px',
          overflowY: 'auto'
        }}>
          {searchResults.map((res: any) => (
            <div
              key={res.accession}
              onClick={() => handleSelectResult(res)}
              className="search-result"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>{res.protein_name}</span>
                <span className="badge badge-blue">{res.accession}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Gene: {formatGene(res.gene_names)} · {formatOrganism(res.organism)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
