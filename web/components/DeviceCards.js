'use client';

import { Wifi, Battery, User, HeartPulse, Radio } from 'lucide-react';

export default function DeviceCards({ devices = {}, onTriggerPanic }) {
  const deviceList = Object.entries(devices);

  // Si aún no hay dispositivos en línea vía MQTT, mostrar plantilla visual activa
  const displayList = deviceList.length > 0 ? deviceList : [
    ['adulto-01', { rssi: -68, state: 0, armed: true, lastSeen: Date.now() - 4000 }]
  ];

  const getRssiColor = (rssi) => {
    if (rssi > -70) return '#10b981';
    if (rssi > -85) return '#f59e0b';
    return '#ef4444';
  };

  const fmtSeen = (lastSeen) => {
    if (!lastSeen) return 'hace un momento';
    const s = Math.floor((Date.now() - lastSeen) / 1000);
    if (s < 60) return `hace ${s}s`;
    const m = Math.floor(s / 60);
    return `hace ${m}m`;
  };

  return (
    <div className="glass-panel" style={{ padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HeartPulse size={22} color="#10b981" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
            Dispositivos & Pacientes
          </h2>
        </div>
        <span className="pill pill-online">
          {displayList.length} en línea
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {displayList.map(([id, dev]) => (
          <div
            key={id}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 14,
              padding: 16,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(14, 165, 233, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                }}>
                  <User size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#f8fafc' }}>
                    {id === 'adulto-01' ? 'D. Antonio Aguirre' : id}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    ID Hardware: {id} · Sensor: MPU6050
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: getRssiColor(dev.rssi || -70),
                }}>
                  <Wifi size={14} />
                  <span>{dev.rssi || -68} dBm</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {fmtSeen(dev.lastSeen)}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              fontSize: '0.8rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981' }}>
                <Radio size={14} className="pulse-indicator" />
                <span>Modo: Detección Activa 100 Hz</span>
              </div>

              <button
                onClick={() => onTriggerPanic && onTriggerPanic(id)}
                className="btn btn-secondary"
                style={{ padding: '5px 10px', fontSize: '0.75rem', color: '#fca5a5' }}
              >
                Pánico SOS
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
