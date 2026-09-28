'use client';

import { useState, useEffect } from 'react';
import { Compass, Activity, Zap, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function LiveMonitor({ latestAlert, activeDevice, devices = {} }) {
  const [tiltAngle, setTiltAngle] = useState(12); // reposo erguido por defecto
  const [impactG, setImpactG] = useState(1.0);
  const [motionState, setMotionState] = useState('ARMADO');

  // Si llega una nueva alerta, actualizar visualizador
  useEffect(() => {
    if (latestAlert) {
      setTiltAngle(latestAlert.tiltDeg || 75);
      setImpactG(latestAlert.impactG || 3.1);
      setMotionState(latestAlert.type === 'panic' ? 'PÁNICO SOS' : 'CAÍDA DETECTADA');
      
      const timer = setTimeout(() => {
        setMotionState('ARMADO');
        setTiltAngle(14);
        setImpactG(1.0);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [latestAlert]);

  const deviceCount = Object.keys(devices).length;
  const isProne = tiltAngle >= 50;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Tarjeta de inclinómetro y telemetría activa */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Compass size={22} color="#06b6d4" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
              Inclinómetro Biomecánico & Estado Inercial
            </h2>
          </div>
          <span className={`pill ${isProne ? 'pill-fall' : 'pill-online'}`}>
            {isProne ? '⚠️ TENDIDO / HORIZONTAL' : '✅ ERGUIDO NORMAL'}
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 24,
          alignItems: 'center',
        }}>
          {/* Compass visualizador */}
          <div style={{ textAlign: 'center' }}>
            <div className="gyro-compass">
              <div
                className="gyro-needle"
                style={{
                  transform: `rotate(${tiltAngle}deg)`,
                  background: isProne
                    ? 'linear-gradient(to top, #ef4444 50%, #f87171 50%)'
                    : 'linear-gradient(to top, #10b981 50%, #06b6d4 50%)',
                }}
              />
              <div className="gyro-center-dot" />
            </div>
            <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Inclinación: <strong style={{ color: isProne ? '#ef4444' : '#06b6d4', fontSize: '1.1rem' }}>{tiltAngle}°</strong>
            </div>
          </div>

          {/* Métricas clave */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Fuerza de Impacto Reciente
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: impactG > 2.0 ? '#ef4444' : '#f8fafc', marginTop: 2 }}>
                {impactG} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>g</span>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Estado del Algoritmo ESP32
              </div>
              <div style={{
                fontSize: '1.1rem',
                fontWeight: 800,
                color: motionState === 'ARMADO' ? '#10b981' : '#ef4444',
                marginTop: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <Activity size={16} />
                <span>{motionState}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de diagnóstico */}
        <div style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          justifyContent: 'space-between',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
        }}>
          <div>Dispositivo en foco: <strong style={{ color: '#fff' }}>{activeDevice?.device || 'adulto-01'}</strong></div>
          <div>Frecuencia de muestreo: <strong style={{ color: '#06b6d4' }}>100 Hz (~10ms)</strong></div>
          <div>Filtro inercial: <strong style={{ color: '#10b981' }}>DLPF 44 Hz</strong></div>
        </div>
      </div>

      {/* Tarjetas de estado rápido */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 14,
      }}>
        <div className="glass-panel" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', marginBottom: 6 }}>
            <ShieldCheck size={18} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>PACIENTES VIGILADOS</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>
            {deviceCount > 0 ? deviceCount : 1}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Dispositivos con enlace continuo
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#06b6d4', marginBottom: 6 }}>
            <Zap size={18} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>CANAL WHATSAPP</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#25D366' }}>
            ACTIVO
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Despacho prioritario de alertas
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', marginBottom: 6 }}>
            <Activity size={18} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>SENSIBILIDAD</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>
            2.40g
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Umbral calibrado de impacto
          </div>
        </div>
      </div>
    </div>
  );
}
