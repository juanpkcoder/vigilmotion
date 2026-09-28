export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main)',
      gap: 16,
    }}>
      <div style={{
        width: 50,
        height: 50,
        borderRadius: '50%',
        border: '3px solid rgba(14, 165, 233, 0.2)',
        borderTopColor: '#0ea5e9',
        animation: 'spin 1s linear infinite',
      }} />
      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
        Iniciando Centro de Teleasistencia VigilMotion...
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
