'use client';

import { useState } from 'react';
import { AlertTriangle, AlertOctagon, CheckCircle2, MessageCircle, Clock, ShieldAlert } from 'lucide-react';

export default function AlertFeed({ alerts = [], onSelectAlert, designatedContact }) {
  const [filter, setFilter] = useState('all');

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'falls') return a.type === 'fall';
    if (filter === 'panics') return a.type === 'panic';
    return true;
  });

  const getBadgeClass = (type) => {
    if (type === 'panic') return 'pill-panic';
    if (type === 'test') return 'pill-test';
    return 'pill-fall';
  };

  const getTypeLabel = (type) => {
    if (type === 'panic') return '🚨 PÁNICO SOS';
    if (type === 'test') return '🧪 PRUEBA';
    return '⚠️ CAÍDA DETECTADA';
  };

  return (
    <div className="glass-panel" style={{ padding: 22, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header del Feed */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldAlert size={22} color="#ef4444" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
            Registro Crítico de Eventos
          </h2>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {alerts.length} registros persistidos
        </span>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setFilter('all')}
          className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
        >
          Todos ({alerts.length})
        </button>
        <button
          onClick={() => setFilter('falls')}
          className={`btn ${filter === 'falls' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
        >
          Caídas ({alerts.filter((a) => a.type === 'fall').length})
        </button>
        <button
          onClick={() => setFilter('panics')}
          className={`btn ${filter === 'panics' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
        >
          Pánico ({alerts.filter((a) => a.type === 'panic').length})
        </button>
      </div>

      {/* Lista de alertas */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        paddingRight: 4,
      }}>
        {filteredAlerts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 12,
          }}>
            <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px auto' }} />
            <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: 4 }}>
              Sin incidentes registrados
            </div>
            <div style={{ fontSize: '0.82rem' }}>
              El sistema está monitoreando activamente los sensores inerciales.
            </div>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const timeStr = new Date((alert.ts || Math.floor(Date.now() / 1000)) * 1000).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const dateStr = new Date((alert.ts || Math.floor(Date.now() / 1000)) * 1000).toLocaleDateString([], {
              day: '2-digit',
              month: 'short',
            });

            const waText = encodeURIComponent(
              `🚨 *ALERTA VIGILMOTION*\n` +
              `Evento: ${alert.type === 'panic' ? 'Botón de pánico' : 'Caída detectada'}\n` +
              `Dispositivo: ${alert.device}\n` +
              `Impacto: ${alert.impactG}g | Inclinación: ${alert.tiltDeg}°\n` +
              `Hora: ${timeStr} (${dateStr})`
            );

            return (
              <div
                key={alert.id || alert.ts}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderLeft: `4px solid ${alert.type === 'panic' ? '#dc2626' : '#ef4444'}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`pill ${getBadgeClass(alert.type)}`}>
                    {getTypeLabel(alert.type)}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <Clock size={13} />
                    <span>{dateStr} {timeStr}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                      Dispositivo: {alert.device || 'adulto-01'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      Impacto: <strong style={{ color: '#fff' }}>{alert.impactG}g</strong> · Inclinación: <strong style={{ color: '#fff' }}>{alert.tiltDeg}°</strong>
                    </div>
                  </div>

                  {(() => {
                    const cleanPhone = designatedContact ? String(designatedContact.phone).replace(/[^0-9]/g, '') : '';
                    const link = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waText}` : `https://wa.me/?text=${waText}`;
                    return (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-whatsapp"
                        style={{ padding: '6px 12px', fontSize: '0.78rem', textDecoration: 'none' }}
                        title={designatedContact ? `Enviar reporte a ${designatedContact.name}` : 'Compartir por WhatsApp'}
                      >
                        <MessageCircle size={14} />
                        <span>{designatedContact ? `WhatsApp a ${designatedContact.name.split(' ')[0]}` : 'WhatsApp'}</span>
                      </a>
                    );
                  })()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
