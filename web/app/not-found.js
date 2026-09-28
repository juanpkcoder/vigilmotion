import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function NotFound() {
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
        maxWidth: 480,
        width: '100%',
        padding: 32,
        textAlign: 'center',
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'rgba(14, 165, 233, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          color: '#38bdf8',
        }}>
          <ShieldAlert size={32} />
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', marginBottom: 12 }}>
          Página No Encontrada (404)
        </h1>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
          La ruta solicitada no forma parte del sistema de telemonitoreo VigilMotion.
        </p>

        <Link
          href="/"
          className="btn btn-primary"
          style={{ textDecoration: 'none', display: 'inline-flex', padding: '10px 20px' }}
        >
          <ArrowLeft size={16} />
          <span>Volver al Centro de Monitoreo</span>
        </Link>
      </div>
    </div>
  );
}
