'use client';

import { Shield, Bell, Send, Settings, Radio, Activity, AlertOctagon, Users } from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  connected,
  onQuickPanic,
  onSimulateFall,
  alertsCount = 0,
}) {
  return (
    <header style={{
      background: 'rgba(6, 9, 19, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '12px 20px',
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(14, 165, 233, 0.35)',
          }}>
            <Shield size={24} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                VigilMotion
              </span>
              <span className={`pill ${connected ? 'pill-online' : 'pill-fall'}`} style={{ fontSize: '0.7rem' }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: connected ? '#10b981' : '#ef4444',
                  display: 'inline-block',
                }} className={connected ? 'pulse-indicator' : ''} />
                {connected ? '24/7 EN VIVO' : 'RECONECTANDO'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Teleasistencia Médica & Detección de Caídas
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255, 255, 255, 0.03)',
          padding: 4,
          borderRadius: 14,
          border: '1px solid var(--border-subtle)',
        }} className="desktop-tabs">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`btn ${activeTab === 'monitor' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Activity size={16} />
            <span>Monitoreo</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`btn ${activeTab === 'alerts' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem', position: 'relative' }}
          >
            <Bell size={16} />
            <span>Alertas</span>
            {alertsCount > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: '0.65rem',
                borderRadius: 99,
                padding: '2px 6px',
                fontWeight: 700,
                marginLeft: 4,
              }}>
                {alertsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`btn ${activeTab === 'whatsapp' ? 'btn-whatsapp' : 'btn-secondary'}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Send size={16} />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`btn ${activeTab === 'about' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Users size={16} />
            <span>Sobre Nosotros</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Settings size={16} />
            <span>Ajustes</span>
          </button>
        </nav>

        {/* Actions */}
        <div className="header-actions" style={{ alignItems: 'center', gap: 10 }}>
          <button
            onClick={onSimulateFall}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem', padding: '8px 12px' }}
            title="Prueba de laboratorio: simula una caída real del paciente"
          >
            <Radio size={15} color="#38bdf8" />
            <span>Simular Caída</span>
          </button>

          <button
            onClick={onQuickPanic}
            className="btn btn-panic"
            style={{ fontSize: '0.85rem', padding: '8px 14px' }}
            title="Dispara alarma de auxilio en el dispositivo y WhatsApp"
          >
            <AlertOctagon size={16} />
            <span>SOS Pánico</span>
          </button>
        </div>
      </div>
    </header>
  );
}
