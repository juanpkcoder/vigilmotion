'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import LiveMonitor from '@/components/LiveMonitor';
import AlertFeed from '@/components/AlertFeed';
import DeviceCards from '@/components/DeviceCards';
import WhatsAppManager from '@/components/WhatsAppManager';
import AudioSiren from '@/components/AudioSiren';
import MobileNav from '@/components/MobileNav';
import AboutUs from '@/components/AboutUs';
import CookieBanner from '@/components/CookieBanner';
import { Shield, Heart, Cookie } from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('monitor');
  const [alerts, setAlerts] = useState([]);
  const [devices, setDevices] = useState({});
  const [contacts, setContacts] = useState([]);
  const [settings, setSettings] = useState({});
  const [connected, setConnected] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState(null);
  const [cookieKey, setCookieKey] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const sseRef = useRef(null);

  // Carga inicial de datos
  const loadData = async () => {
    try {
      const [alertsRes, devicesRes, contactsRes, settingsRes] = await Promise.all([
        fetch('/api/alerts').then((r) => r.json()),
        fetch('/api/devices').then((r) => r.json()),
        fetch('/api/contacts').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
      ]);

      if (Array.isArray(alertsRes)) setAlerts(alertsRes);
      if (devicesRes && typeof devicesRes === 'object') setDevices(devicesRes);
      if (Array.isArray(contactsRes)) setContacts(contactsRes);
      if (settingsRes && typeof settingsRes === 'object') setSettings(settingsRes);
      setConnected(true);
    } catch (e) {
      console.warn('Error en carga inicial:', e);
      setConnected(false);
    } finally {
      setInitialLoading(false);
    }
  };

  // Conexión en tiempo real vía Server-Sent Events (SSE)
  useEffect(() => {
    loadData();

    // Polling de respaldo cada 8 segundos
    const pollInterval = setInterval(loadData, 8000);

    // Conexión SSE
    try {
      const es = new EventSource('/api/events');
      sseRef.current = es;

      es.onopen = () => setConnected(true);

      es.addEventListener('fall', (e) => {
        try {
          const alert = JSON.parse(e.data);
          setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)].slice(0, 200));
          setActiveAlarm(alert);

          // Vibración en dispositivos móviles
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([400, 200, 400, 200, 600]);
          }
        } catch (err) {
          console.error('Error parseando evento fall:', err);
        }
      });

      es.addEventListener('status', (e) => {
        try {
          const dev = JSON.parse(e.data);
          setDevices((prev) => ({ ...prev, [dev.device]: { ...prev[dev.device], ...dev } }));
        } catch {}
      });

      es.onerror = () => {
        setConnected(false);
      };
    } catch (e) {
      console.warn('SSE no soportado en este entorno:', e);
    }

    return () => {
      clearInterval(pollInterval);
      if (sseRef.current) sseRef.current.close();
    };
  }, []);

  // Disparar pánico SOS
  const handleQuickPanic = async (deviceId = 'adulto-01') => {
    try {
      const res = await fetch('/api/panic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: deviceId }),
      });
      const data = await res.json();
      if (data.alert) {
        setActiveAlarm(data.alert);
      }
      loadData();
    } catch (e) {
      alert('Error contactando con el servidor.');
    }
  };

  // Simular caída con datos biomecánicos reales
  const handleSimulateFall = async () => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'fall',
          evento: 'caida_detectada',
          device: 'adulto-01',
          impactG: 3.4,
          tiltDeg: 78.5,
          ts: Math.floor(Date.now() / 1000),
        }),
      });
      const data = await res.json();
      if (data.alert) {
        setActiveAlarm(data.alert);
      }
      loadData();
    } catch (e) {
      alert('Error ejecutando simulación.');
    }
  };

  // Gestión de contactos
  const handleAddContact = async (contact) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contact),
      });
      const data = await res.json();
      if (data.contact) {
        setContacts((prev) => [...prev, data.contact]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteContact = async (id) => {
    try {
      const res = await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.contacts) {
        setContacts(data.contacts);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateSettings = async (newSettings) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const reopenCookies = () => {
    try {
      localStorage.removeItem('vigilmotion_cookie_consent');
      setCookieKey((k) => k + 1);
    } catch {}
  };

  const latestAlert = alerts[0] || null;
  const activeDevice = Object.values(devices)[0] || { device: 'adulto-01', rssi: -68 };
  const designatedContact = contacts.find((c) => c.isDesignated) || contacts[0] || null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Alarma sonora y estroboscópica con botón directo a WhatsApp */}
      <AudioSiren
        isTriggered={Boolean(activeAlarm)}
        alertData={activeAlarm}
        onDismiss={() => setActiveAlarm(null)}
        designatedContact={designatedContact}
      />

      {/* Cabecera de Navegación */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connected={connected}
        onQuickPanic={() => handleQuickPanic('adulto-01')}
        onSimulateFall={handleSimulateFall}
        alertsCount={alerts.length}
      />

      {/* Contenido Principal */}
      <main className="dashboard-grid">
        {/* Vista Centro de Monitoreo */}
        {activeTab === 'monitor' && (
          initialLoading ? (
            <>
              <div className="glass-panel" style={{ padding: 20 }}>
                <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 110, width: '100%', marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 110, width: '100%' }} />
              </div>
              <div className="glass-panel" style={{ padding: 20 }}>
                <div className="skeleton" style={{ height: 28, width: '70%', marginBottom: 20 }} />
                <div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0' }}>
                  <div className="skeleton" style={{ width: 140, height: 140, borderRadius: '50%' }} />
                </div>
                <div className="skeleton" style={{ height: 80, width: '100%' }} />
              </div>
              <div className="glass-panel" style={{ padding: 20 }}>
                <div className="skeleton" style={{ height: 24, width: '50%', marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 70, width: '100%', marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 70, width: '100%', marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 70, width: '100%' }} />
              </div>
            </>
          ) : (
            <>
              <div>
                <DeviceCards devices={devices} onTriggerPanic={handleQuickPanic} />
              </div>
              <div>
                <LiveMonitor
                  latestAlert={latestAlert}
                  activeDevice={activeDevice}
                  devices={devices}
                />
              </div>
              <div>
                <AlertFeed alerts={alerts} designatedContact={designatedContact} />
              </div>
            </>
          )
        )}

        {/* Vista Alertas */}
        {activeTab === 'alerts' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <AlertFeed alerts={alerts} designatedContact={designatedContact} />
          </div>
        )}

        {/* Vista WhatsApp */}
        {activeTab === 'whatsapp' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <WhatsAppManager
              contacts={contacts}
              onAddContact={handleAddContact}
              onDeleteContact={handleDeleteContact}
              onUpdateSettings={handleUpdateSettings}
              onRefreshContacts={loadData}
              settings={settings}
            />
          </div>
        )}

        {/* Vista Sobre Nosotros (Basado en el documento de investigación) */}
        {activeTab === 'about' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <AboutUs />
          </div>
        )}

        {/* Vista Ajustes */}
        {activeTab === 'settings' && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Panel Conexión Vercel & ESP32 */}
            <div className="glass-panel" style={{ padding: 24, border: '1px solid rgba(14, 165, 233, 0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(14, 165, 233, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                  <Shield size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                    Parámetros de Despliegue en Vercel & Firmware ESP32
                  </h2>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Conecta tu sensor físico en Bogotá o cualquier lugar del mundo a la nube 24/7
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <p style={{ lineHeight: 1.5 }}>
                  Al desplegar este repositorio en <strong>Vercel</strong>, obtendrás una URL HTTPS pública (ej. <code style={{ color: '#38bdf8' }}>https://vigilmotion.vercel.app</code>). El ESP32 enviará las caídas y estados directamente a esta API vía HTTP POST con cifrado SSL.
                </p>

                <div style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: 8, fontSize: '0.85rem' }}>
                    1. URL DEL WEBHOOK PARA EL ARCHIVO config.py (MicroPython) O config.h (Arduino):
                  </div>
                  <code style={{ display: 'block', background: 'rgba(255, 255, 255, 0.05)', padding: '10px 14px', borderRadius: 8, color: '#4ade80', fontSize: '0.88rem', wordBreak: 'break-all' }}>
                    WEBHOOK_URL = "{typeof window !== 'undefined' ? `${window.location.origin}/api/alerts` : 'https://TU-PROYECTO.vercel.app/api/alerts'}"
                  </code>
                </div>

                <div style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: 8, fontSize: '0.85rem' }}>
                    2. VARIABLES DE ENTORNO RECOMENDADAS PARA VERCEL (Project Settings → Environment Variables):
                  </div>
                  <ul style={{ marginLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.84rem' }}>
                    <li><code>DESIGNATED_CONTACT_PHONE</code>: Teléfono del contacto principal (ej. <code>+573001234567</code>)</li>
                    <li><code>DESIGNATED_CONTACT_NAME</code>: Nombre del cuidador asignado</li>
                    <li><code>CALLMEBOT_API_KEY</code>: Clave de CallMeBot para envío directo y automático a WhatsApp</li>
                    <li><code>NEXT_PUBLIC_APP_URL</code>: URL de producción asignada por Vercel</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Ajustes Generales */}
            <div className="glass-panel" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', marginBottom: 16 }}>
                Canales de Telemetría Activos
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                <div>
                  <strong>Broker MQTT:</strong> <code style={{ color: '#38bdf8' }}>broker.hivemq.com:1883</code>
                </div>
                <div>
                  <strong>Tópicos MQTT:</strong> <code style={{ color: '#38bdf8' }}>vigilmotion/+/fall</code> y <code style={{ color: '#38bdf8' }}>vigilmotion/+/status</code>
                </div>
                <div>
                  <strong>Endpoint de Recepción:</strong> <code style={{ color: '#38bdf8' }}>POST /api/alerts</code>
                </div>
                <div style={{ paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={handleSimulateFall} className="btn btn-secondary">
                    🧪 Probar Simulación de Caída
                  </button>
                  <button onClick={reopenCookies} className="btn btn-secondary">
                    <Cookie size={16} />
                    <span>Configurar Cookies y Privacidad</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Profesional */}
      <footer style={{
        marginTop: 'auto',
        background: 'rgba(4, 7, 15, 0.95)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '24px 20px',
        color: 'var(--text-muted)',
        fontSize: '0.82rem',
        textAlign: 'center',
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem' }}>
              VigilMotion — Telemetría IoT & Detección de Caídas
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Investigación en Engativá, Bogotá · Mariana Baracaldo, Matías Ñañez, Julián Rodríguez · Dir. Wilson Pérez
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => setActiveTab('about')}
              style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.82rem' }}
            >
              Sobre el Proyecto
            </button>
            <button
              onClick={reopenCookies}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem' }}
            >
              Preferencias de Cookies
            </button>
          </div>
        </div>
      </footer>

      {/* Barra de navegación inferior para Smartphones */}
      <MobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onQuickPanic={() => handleQuickPanic('adulto-01')}
        alertsCount={alerts.length}
      />

      {/* Gestor y Banner de Consentimiento de Cookies */}
      <CookieBanner key={cookieKey} />
    </div>
  );
}
