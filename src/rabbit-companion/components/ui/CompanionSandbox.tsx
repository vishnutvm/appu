import React, { useState, useEffect, useRef } from 'react';
import { RabbitScene } from '../scene/RabbitScene';

export const CompanionSandbox: React.FC = () => {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop handler for .glb/.gltf 3D files
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
        const url = URL.createObjectURL(file);
        setModelUrl(url);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setModelUrl(url);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 40%, #1e293b 0%, #0f172a 65%, #050814 100%)',
        userSelect: 'none',
        margin: 0,
        padding: 0,
      }}
    >
      {/* Hidden file input for uploading .glb directly */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Pure 3D Character Scene */}
      <RabbitScene enableOrbit={true} modelUrl={modelUrl} />

      {/* Subtle, Minimal Model Switcher in top corner */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 40,
          display: 'flex',
          gap: '8px',
        }}
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#cbd5e1',
            borderRadius: '16px',
            padding: '6px 14px',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
            transition: 'all 0.15s ease',
          }}
          title="Drag and drop or select a custom rigged .glb file"
        >
          {modelUrl ? '📁 Custom GLB Active' : '📁 Load .GLB Model'}
        </button>

        {modelUrl && (
          <button
            onClick={() => setModelUrl(null)}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              borderRadius: '16px',
              padding: '6px 12px',
              fontSize: '11px',
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Visual drag-over indicator */}
      {isDragOver && (
        <div
          style={{
            position: 'absolute',
            inset: '20px',
            border: '2px dashed #00f3ff',
            borderRadius: '24px',
            background: 'rgba(0, 243, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 100,
            color: '#00f3ff',
            fontSize: '18px',
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Drop .GLB / .GLTF 3D Character Model Here
        </div>
      )}
    </div>
  );
};
