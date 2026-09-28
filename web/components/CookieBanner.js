'use client';

import { useState, useEffect } from 'react';
import { Cookie, Shield, Check, X, Sliders, ExternalLink } from 'lucide-react';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [preferencesEnabled, setPreferencesEnabled] = useState(true);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('vigilmotion_cookie_consent');
      if (!consent) {
        // Mostrar con un leve retardo para entrada suave
        const t = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  const saveConsent = (type) => {
    try {
      const consentData = {
        acceptedAt: new Date().toISOString(),
        type,
        essential: true,
        analytics: type === 'all' || analyticsEnabled,
        preferences: type === 'all' || preferencesEnabled,
      };
      localStorage.setItem('vigilmotion_cookie_consent', JSON.stringify(consentData));
    } catch {}
    setVisible(false);
    setShowModal(false);
  };

  if (!visible && !showModal) return null;

  return (
    <>
      {/* Banner Flotante Inferior */}
      {visible && (
        <div className="cookie-banner-wrapper" style={{
          position: 'fixed',
          bottom: 20,
          left: 20,
          right: 20,
          maxWidth: 960,
          margin: '0 auto',
          zIndex: 9000,
          background: 'rgba(11, 17, 33, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(14, 165, 233, 0.35)',
          borderRadius: 16,
          padding: '18px 24px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(14, 165, 233, 0.15)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: '1 1 500px' }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'rgba(14, 165, 233, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              flexShrink: 0,
            }}>
              <Cookie size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#f8fafc', marginBottom: 4 }}>
                Aviso de Privacidad y Cookies de Telemonitoreo
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                VigilMotion utiliza cookies técnicas y almacenamiento local estrictamente necesarios para mantener el streaming SSE en vivo con el sensor ESP32, persistir los contactos de emergencia y asegurar el despacho prioritario de alertas médicas a WhatsApp sin almacenar datos personales para rastreo publicitario.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowModal(true)}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '8px 14px' }}
            >
              <Sliders size={14} />
              <span>Personalizar</span>
            </button>

            <button
              onClick={() => saveConsent('essential')}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '8px 14px' }}
            >
              Solo Necesarias
            </button>

            <button
              onClick={() => saveConsent('all')}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem', padding: '8px 16px' }}
            >
              <Check size={14} />
              <span>Aceptar Todo</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Personalización de Cookies */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 18,
            maxWidth: 600,
            width: '100%',
            padding: 24,
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={22} color="#10b981" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                  Preferencias de Privacidad y Cookies
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              Para garantizar la protección de datos sensibles conforme a normativas de teleasistencia médica y protección de datos personales, puedes seleccionar las categorías de almacenamiento que autorizas:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Esenciales */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                    Cookies Estrictamente Necesarias (Obligatorias)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Canal SSE de telemetría inercial, socket MQTT, persistencia de pánico y sirena acústica.
                  </div>
                </div>
                <span className="pill pill-online" style={{ fontSize: '0.7rem' }}>SIEMPRE ACTIVAS</span>
              </div>

              {/* Preferencias */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                    Almacenamiento Local de Contactos y Gateways
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Guarda la agenda de teléfonos de familiares y API keys de CallMeBot en tu propio navegador.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferencesEnabled}
                  onChange={(e) => setPreferencesEnabled(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#0ea5e9' }}
                />
              </div>

              {/* Diagnóstico */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                    Diagnóstico Biomecánico Anónimo
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Métricas de fuerza G para calibración de falsos positivos en estudios de Engativá (Bogotá).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={analyticsEnabled}
                  onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#0ea5e9' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => saveConsent('custom')}
                className="btn btn-primary"
                style={{ padding: '8px 18px' }}
              >
                Guardar Mis Preferencias
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
