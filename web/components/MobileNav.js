'use client';

import { Activity, Bell, Send, AlertOctagon, Users } from 'lucide-react';

export default function MobileNav({ activeTab, setActiveTab, onQuickPanic, alertsCount = 0 }) {
  return (
    <nav className="mobile-nav">
      <button
        onClick={() => setActiveTab('monitor')}
        className={`mobile-nav-item ${activeTab === 'monitor' ? 'active' : ''}`}
      >
        <Activity size={20} />
        <span>Monitoreo</span>
      </button>

      <button
        onClick={() => setActiveTab('alerts')}
        className={`mobile-nav-item ${activeTab === 'alerts' ? 'active' : ''}`}
        style={{ position: 'relative' }}
      >
        <Bell size={20} />
        <span>Alertas</span>
        {alertsCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 4,
            right: 18,
            background: '#ef4444',
            color: '#fff',
            fontSize: '0.6rem',
            fontWeight: 800,
            borderRadius: 99,
            width: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {alertsCount}
          </span>
        )}
      </button>

      <button
        onClick={() => setActiveTab('whatsapp')}
        className={`mobile-nav-item ${activeTab === 'whatsapp' ? 'active' : ''}`}
      >
        <Send size={19} color={activeTab === 'whatsapp' ? '#25D366' : 'currentColor'} />
        <span>WhatsApp</span>
      </button>

      <button
        onClick={() => setActiveTab('about')}
        className={`mobile-nav-item ${activeTab === 'about' ? 'active' : ''}`}
      >
        <Users size={19} />
        <span>Nosotros</span>
      </button>

      <button
        onClick={onQuickPanic}
        className="mobile-nav-item"
        style={{ color: '#ef4444' }}
      >
        <AlertOctagon size={20} />
        <span>Pánico</span>
      </button>
    </nav>
  );
}
