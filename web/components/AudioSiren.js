'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, AlertTriangle, MessageCircle } from 'lucide-react';

export default function AudioSiren({ isTriggered, alertData, onDismiss, designatedContact }) {
  const [muted, setMuted] = useState(false);
  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);
  const gainRef = useRef(null);
  const timerRef = useRef(null);

  const stopSiren = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (oscRef.current) {
      try {
        oscRef.current.stop();
        oscRef.current.disconnect();
      } catch {}
      oscRef.current = null;
    }
  }, []);

  const startSiren = useCallback(() => {
    if (muted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (oscRef.current) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      oscRef.current = osc;
      gainRef.current = gain;

      // Modulación de frecuencia de sirena de emergencia (880Hz <-> 600Hz)
      let high = true;
      timerRef.current = setInterval(() => {
        if (!oscRef.current) return;
        const now = ctx.currentTime;
        oscRef.current.frequency.setTargetAtTime(high ? 880 : 587, now, 0.1);
        high = !high;
      }, 450);
    } catch (e) {
      console.warn('AudioContext no inicializado:', e);
    }
  }, [muted]);

  useEffect(() => {
    if (isTriggered && !muted) {
      startSiren();
    } else {
      stopSiren();
    }
    return () => stopSiren();
  }, [isTriggered, muted, startSiren, stopSiren]);

  if (!isTriggered) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: 'linear-gradient(90deg, #b91c1c 0%, #ef4444 50%, #b91c1c 100%)',
      color: '#fff',
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 4px 30px rgba(239, 68, 68, 0.7)',
      animation: 'emergencyStrobe 1s infinite alternate',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <AlertTriangle size={28} color="#fff" />
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em' }}>
            {alertData?.type === 'panic' ? '🚨 ¡BOTÓN DE PÁNICO ACTIVADO!' : '⚠️ ¡CAÍDA DETECTADA EN TIEMPO REAL!'}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
            Dispositivo: <strong>{alertData?.device || 'adulto-01'}</strong> · Impacto: {alertData?.impactG || 0}g · Inclinación: {alertData?.tiltDeg || 0}°
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {designatedContact && (
          <a
            href={`https://wa.me/${String(designatedContact.phone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
              `🚨 *ALERTA URGENTE VIGILMOTION*\n\n` +
              `Evento: ${alertData?.type === 'panic' ? '🚨 Botón de Pánico' : '⚠️ Caída Detectada'}\n` +
              `Dispositivo: ${alertData?.device || 'adulto-01'}\n` +
              `Impacto: ${alertData?.impactG || 0}g | Inclinación: ${alertData?.tiltDeg || 0}°\n` +
              `¡Verifique al paciente de inmediato!`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-whatsapp"
            style={{ padding: '8px 14px', fontSize: '0.82rem', textDecoration: 'none' }}
          >
            <MessageCircle size={16} />
            <span>WhatsApp a {designatedContact.name?.split(' ')[0] || 'Cuidador'}</span>
          </a>
        )}

        <button
          onClick={() => setMuted(!muted)}
          className="btn"
          style={{ background: 'rgba(0, 0, 0, 0.3)', color: '#fff', padding: '8px 12px' }}
          title={muted ? 'Activar sonido' : 'Silenciar sonido'}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          <span>{muted ? 'Silenciado' : 'Silenciar'}</span>
        </button>

        <button
          onClick={onDismiss}
          className="btn"
          style={{ background: '#fff', color: '#b91c1c', fontWeight: 800, padding: '8px 16px' }}
        >
          Atender Alerta
        </button>
      </div>
    </div>
  );
}
