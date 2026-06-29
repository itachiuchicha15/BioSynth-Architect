import { useState } from 'react';
import { Microscope, Stethoscope } from 'lucide-react';
import { ProteinSearch } from './components/ProteinSearch';
import { MutationForm } from './components/MutationForm';
import { StructureViewer } from './components/StructureViewer';
import { AgentConsole } from './components/AgentConsole';
import { SpeedMetrics } from './components/SpeedMetrics';
import { ClinicalPortal } from './components/ClinicalPortal';
import { api } from './services/api';
import type { 
  ProteinInfo, 
  MutationFiles, 
  MutationMetrics, 
  AgentResponse, 
  AgentLog 
} from './types';

function App() {
  const [viewMode, setViewMode] = useState<'workspace' | 'clinical'>('workspace');
  const [selectedProtein, setSelectedProtein] = useState<ProteinInfo | null>(null);
  const [mutationFiles, setMutationFiles] = useState<MutationFiles | null>(null);
  const [mutationMetrics, setMutationMetrics] = useState<MutationMetrics | null>(null);
  const [agentAssessment, setAgentAssessment] = useState<AgentResponse | null>(null);
  const [ligands, setLigands] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingLigands, setLoadingLigands] = useState(false);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([
    {
      agentName: 'System',
      message: 'BioSynth Workbench initialized. Ready to simulate structural variants.',
      status: 'success',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);

  const logMessage = (
    message: string, 
    agentName: AgentLog['agentName'], 
    status: AgentLog['status']
  ) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { agentName, message, status, timestamp }]);
  };

  const handleSelectProtein = async (protein: ProteinInfo) => {
    setSelectedProtein(protein);
    setMutationFiles(null);
    setMutationMetrics(null);
    setAgentAssessment(null);
    setLigands([]);
    
    setLoadingLigands(true);
    logMessage(`Cheminformatics Agent fetching bioactive molecules for target ${protein.accession}...`, 'Cheminformatics', 'running');
    
    try {
      const res = await api.getChEMBLCompounds(protein.accession, 8);
      if (res.success && res.compounds) {
        setLigands(res.compounds);
        logMessage(`Found ${res.compounds.length} active compounds matching target in ChEMBL.`, 'Cheminformatics', 'success');
      } else {
        setLigands([]);
        logMessage(`No active compounds found for target in ChEMBL.`, 'Cheminformatics', 'idle');
      }
    } catch (err: any) {
      console.error(err);
      logMessage(`Failed to query ChEMBL: ${err.message || err}`, 'Cheminformatics', 'error');
    } finally {
      setLoadingLigands(false);
    }
  };

  const handleMutate = async (residue: string, targetAA: string, chain: string) => {
    if (!selectedProtein) return;
    
    setLoading(true);
    setMutationFiles(null);
    setMutationMetrics(null);
    setAgentAssessment(null);
    
    logMessage(`Initiating mutation simulation for ${selectedProtein.name} chain ${chain} resi ${residue} -> ${targetAA}...`, 'System', 'running');
    
    try {
      logMessage(`Renderer Agent downloading 3D coordinates from structural database...`, 'Renderer', 'running');
      const structRes = await api.downloadStructure(selectedProtein.accession);
      if (!structRes.success || !structRes.filepath) {
        throw new Error("Failed to retrieve structural coordinate file.");
      }
      
      logMessage(`Coordinate file loaded: ${structRes.filepath.split('\\').pop()}`, 'Renderer', 'success');
      
      logMessage(`Renderer Agent running headless PyMOL in silico mutagenesis...`, 'Renderer', 'running');
      const mutRes = await api.runMutagenesis(structRes.filepath, residue, targetAA, chain);
      
      if (mutRes.success && mutRes.files && mutRes.metrics) {
        setMutationFiles(mutRes.files);
        setMutationMetrics(mutRes.metrics);
        
        logMessage(`Mutagenesis completed successfully. Active site aligned.`, 'Renderer', 'success');
        logMessage(
          `Metrics calculated — WT H-bonds: ${mutRes.metrics.wildtype_contacts} | Mutant H-bonds: ${mutRes.metrics.mutant_contacts}`, 
          'Renderer', 
          'success'
        );
        
        logMessage(`Evolution Agent mapped variant positions in UniProt KB for Residue ${residue}.`, 'Evolution', 'success');

      } else {
        throw new Error(mutRes.log || "PyMOL rendering script failed.");
      }
      
    } catch (err: any) {
      console.error(err);
      logMessage(`Mutation simulation failed: ${err.message || err}`, 'System', 'error');
      logMessage(`Renderer execution aborted.`, 'Renderer', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAssessment = async (reasoningEffort: string) => {
    if (!selectedProtein || !mutationFiles || !mutationMetrics) return;

    setLoadingAgent(true);
    setAgentAssessment(null);

    const mutationDesc = `${selectedProtein.name} (${selectedProtein.accession}) — ${mutationMetrics.original_aa} → ${mutationMetrics.target_aa} (residue site)`;

    // Log the multimodal pipeline startup
    const imgCount = mutationFiles.mutant_full ? 3 : 2;
    logMessage(
      `Assessor Agent launching ${imgCount}-image interleaved multimodal analysis (Gemma 4 Vision · Reasoning: ${reasoningEffort.toUpperCase()})...`,
      'Assessor', 'running'
    );

    if (mutationFiles.rotation_views && mutationFiles.rotation_views.length > 0) {
      logMessage(
        `Spatial Agent queuing ${mutationFiles.rotation_views.length} rotation-angle renders for 3D geometric reasoning...`,
        'Spatial', 'running'
      );
    }

    try {
      const res = await api.assessMutation(
        mutationFiles.wt_pocket,
        mutationFiles.mut_pocket,
        mutationDesc,
        reasoningEffort,
        ligands,
        mutationFiles.mutant_full,
        mutationFiles.rotation_views,
      );

      setAgentAssessment(res);

      const vMeta = res.vision_metadata?.assessor;
      const sMeta = res.vision_metadata?.spatial;

      logMessage(
        `Assessor Agent: ${vMeta?.images_used ?? imgCount} images analyzed via interleaved multimodal prompt.`,
        'Assessor', 'success'
      );
      if (sMeta?.images_used) {
        logMessage(
          `Spatial Agent: ${sMeta.images_used} rotation views analyzed (angles: ${(sMeta.angles_degrees ?? []).join('°, ')}°).`,
          'Spatial', 'success'
        );
      }
      logMessage(
        `5-Agent pipeline complete on Cerebras in ${res.metrics.total_latency_sec}s · ${res.metrics.tokens_per_sec} t/s · ${res.usage?.total_tokens ?? '—'} total tokens.`,
        'System', 'success'
      );
    } catch (err: any) {
      console.error(err);
      logMessage(`Assessor Agent evaluation failed: ${err.message || err}`, 'Assessor', 'error');
    } finally {
      setLoadingAgent(false);
    }
  };

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header" style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '10px' }}>
        <div className="header-brand">
          <h1 className="brand-title">BioSynth Architect</h1>
          <p className="brand-subtitle">
            Cerebras · Gemma-4 Autonomous Molecular Lab & Mutation Simulator
          </p>
        </div>

        {/* View Mode Tabs */}
        <nav style={{ display: 'flex', gap: '4px', background: 'var(--gray-100)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
          <button
            onClick={() => setViewMode('workspace')}
            className={`tab-btn ${viewMode === 'workspace' ? 'active' : ''}`}
            style={{ padding: '7px 18px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '7px' }}
          >
            <Microscope size={15} strokeWidth={2} />
            Molecular Workspace
          </button>
          <button
            onClick={() => setViewMode('clinical')}
            className={`tab-btn ${viewMode === 'clinical' ? 'active' : ''}`}
            style={{ padding: '7px 18px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '7px' }}
          >
            <Stethoscope size={15} strokeWidth={2} />
            Clinical Translation Portal
          </button>
        </nav>

        <div className="header-telemetry">
          <div className="telemetry-item">
            <span className="telemetry-label">Inference</span>
            <span className="telemetry-value">Cerebras CS-3</span>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-label">Status</span>
            <span className="status-dot active" />
          </div>
        </div>
      </header>

      {/* Main Grid or Clinical Portal */}
      {viewMode === 'workspace' ? (
        <main className="app-grid">
          {/* Left Panel */}
          <aside className="grid-left">
            <ProteinSearch 
              onSelectProtein={handleSelectProtein} 
              onLog={logMessage} 
            />
            <MutationForm 
              protein={selectedProtein} 
              onMutate={handleMutate} 
              loading={loading} 
            />
          </aside>

          {/* Center Panel */}
          <section className="grid-center">
            <StructureViewer 
              files={mutationFiles} 
              metrics={mutationMetrics}
              ligands={ligands}
              loadingLigands={loadingLigands}
            />
          </section>

          {/* Right Panel */}
          <aside className="grid-right">
            <AgentConsole 
              logs={logs} 
              assessment={agentAssessment}
              loading={loadingAgent}
              onRunAssessment={handleRunAssessment}
              hasMutated={!!mutationFiles}
            />
            <SpeedMetrics 
              onLog={logMessage}
            />
          </aside>
        </main>
      ) : (
        <main className="clinical-page">
          <ClinicalPortal
            protein={selectedProtein}
            onLog={logMessage}
          />
        </main>
      )}
    </div>
  );
}

export default App;
