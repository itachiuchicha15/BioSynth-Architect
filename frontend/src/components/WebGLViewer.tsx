import React, { useEffect, useRef } from 'react';

// Extend window interface to recognize 3Dmol global namespace loaded via CDN
declare global {
  interface Window {
    $3Dmol: any;
  }
}

interface WebGLViewerProps {
  pdbUrl: string;
  residueIndex: string;
}

export const WebGLViewer: React.FC<WebGLViewerProps> = ({ pdbUrl, residueIndex }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !window.$3Dmol) {
      console.warn("WebGL container or 3Dmol library is not ready.");
      return;
    }

    // Clear previous visual models in container
    containerRef.current.innerHTML = '';

    // Initialize 3Dmol viewer inside target element ref
    const viewer = window.$3Dmol.createViewer(containerRef.current, {
      backgroundColor: '#0b0d13'
    });
    viewerRef.current = viewer;

    // Load PDB file contents and configure layout properties
    fetch(pdbUrl)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error fetching PDB: ${response.statusText}`);
        return response.text();
      })
      .then(pdbData => {
        // Parse PDB format
        viewer.addModel(pdbData, "pdb");

        // Set global representation style to cartoon with a spectrum color scheme
        viewer.setStyle({}, { cartoon: { color: 'spectrum' } });

        // Isolate and highlight the target mutation residue
        const resiNum = parseInt(residueIndex, 10);
        if (!isNaN(resiNum)) {
          // Render mutant side chain as sticks with green carbon coloring
          viewer.setStyle(
            { resi: resiNum },
            { stick: { colorscheme: 'greenCarbon', radius: 0.3 } }
          );
          
          // Draw spheres around mutation residue to emphasize steric bounds
          viewer.addSphere({
            center: { resi: resiNum },
            radius: 2.0,
            color: 'lime',
            opacity: 0.25
          });

          // Focus camera and zoom onto the mutated coordinates
          viewer.zoomTo({ resi: resiNum });
        } else {
          viewer.zoomTo();
        }

        viewer.render();
      })
      .catch(err => {
        console.error("WebGL loader failed:", err);
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-secondary); font-size:0.8rem;">
              WebGL 3D render unavailable: Coordinates missing or server offline.
            </div>
          `;
        }
      });

    // Cleanup viewer context on component unmount
    return () => {
      if (viewerRef.current) {
        viewerRef.current.clear();
      }
    };
  }, [pdbUrl, residueIndex]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '350px', 
          borderRadius: '8px',
          border: '1px solid var(--border-light)',
          background: '#0b0d13',
          overflow: 'hidden'
        }}
      />
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        right: '10px', 
        background: 'rgba(8,10,15,0.8)', 
        padding: '4px 10px', 
        borderRadius: '6px',
        fontSize: '0.65rem',
        border: '1px solid var(--border-light)',
        color: 'var(--text-secondary)',
        pointerEvents: 'none'
      }}>
        WebGL Interactive Canvas (Drag to Rotate • Scroll to Zoom)
      </div>
    </div>
  );
};
export default WebGLViewer;
