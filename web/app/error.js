'use client';

import { useEffect } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    console.error('VigilMotion Error Boundary caught:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg-main)',
    }}>
      <div className="glass-panel" style={{
        maxWidth: 520,
        width: '100%',
        padding: 32,
        textAlign: 'center',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        boxShadow: '0 8px 32px rgba(239, 68, 68, 0.2)',
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'rgba(239, 68, 68, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          color: '#ef4444',
        }}>
          <AlertOctagon size={32} />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginBottom: 12 }}>
          Interrupción en el Telemonitoreo
        </h2>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
          Se ha producido una anomalía inesperada al procesar los datos de telemetría. Para mantener la seguridad del paciente, reinicia la interfaz de monitoreo.
        </p>

        {error?.message && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: '0.78rem',
            fontFamily: 'var(--font-mono)',
            color: '#fca5a5',
            marginBottom: 24,
            textAlign: 'left',
            wordBreak: 'break-all',
          }}>
            {error.message}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button
            onClick={() => reset()}
            className="btn btn-primary"
            style={{ padding: '10px 20px' }}
          >
            <RotateCcw size={16} />
            <span>Reintentar Conexión</span>
          </button>
        </div>
      </div>
    </div>
  );
}
