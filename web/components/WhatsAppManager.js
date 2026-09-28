'use client';

import { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Send,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Phone,
  UserCheck,
  Star,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export default function WhatsAppManager({
  contacts = [],
  onAddContact,
  onDeleteContact,
  onUpdateSettings,
  onRefreshContacts,
  settings = {},
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('Familiar Principal');
  const [newKey, setNewKey] = useState('');
  const [newIsDesignated, setNewIsDesignated] = useState(false);

  const [testStatus, setTestStatus] = useState(null);
  const [testingPhone, setTestingPhone] = useState(null);

  const [callMeBotApiKey, setCallMeBotApiKey] = useState(settings.callMeBotApiKey || '');
  const [designatedPhone, setDesignatedPhone] = useState(settings.designatedPhone || '');
  const [settingsSaved, setSettingsSaved] = useState(false);

  const designatedContact = contacts.find((c) => c.isDesignated) || contacts[0] || null;

  const handleSaveContact = (e) => {
    e.preventDefault();
    if (!newName || !newPhone) return;

    onAddContact({
      name: newName,
      phone: newPhone,
      role: newRole,
      callMeBotKey: newKey || callMeBotApiKey,
      isDesignated: newIsDesignated || contacts.length === 0,
      notifyOnFall: true,
      notifyOnPanic: true,
    });

    setNewName('');
    setNewPhone('');
    setNewKey('');
    setNewIsDesignated(false);
    setShowAddModal(false);
  };

  const handleSetDesignated = async (id) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_designated', id }),
      });
      const data = await res.json();
      if (data.ok && onRefreshContacts) {
        onRefreshContacts();
      }
    } catch (e) {
      console.error('Error asignando contacto designado:', e);
    }
  };

  const handleSaveGatewaySettings = async () => {
    await onUpdateSettings({
      callMeBotApiKey,
      designatedPhone: designatedPhone || (designatedContact ? designatedContact.phone : ''),
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleTestWhatsApp = async (contact) => {
    const phoneToTest = contact ? contact.phone : designatedPhone;
    const keyToTest = (contact ? contact.callMeBotKey : '') || callMeBotApiKey;

    setTestingPhone(phoneToTest);
    setTestStatus({ loading: true });

    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneToTest,
          apiKey: keyToTest,
        }),
      });
      const data = await res.json();
      setTestStatus({
        loading: false,
        success: data.ok,
        message: data.message || (data.ok ? 'Mensaje enviado a WhatsApp con éxito.' : (data.error || 'Fallo de entrega.')),
        directLink: data.directLink,
      });
    } catch (e) {
      setTestStatus({ loading: false, success: false, message: e.message });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Panel Destacado: Contacto Designado Principal */}
      <div className="glass-panel" style={{
        padding: 24,
        background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.08) 0%, rgba(14, 21, 38, 0.85) 100%)',
        border: '1px solid rgba(37, 211, 102, 0.35)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(37, 211, 102, 0.4)',
            }}>
              <Star size={24} color="#fff" fill="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                  Contacto Designado de Emergencia
                </h2>
                <span className="pill" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', fontSize: '0.72rem' }}>
                  PRIORIDAD 1
                </span>
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                Este contacto recibirá de forma prioritaria las alertas inmediatas en caso de caída o activación de pánico
              </div>
            </div>
          </div>

          {designatedContact && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => handleTestWhatsApp(designatedContact)}
                disabled={testStatus?.loading && testingPhone === designatedContact.phone}
                className="btn btn-whatsapp"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                <Send size={15} />
                <span>{testStatus?.loading && testingPhone === designatedContact.phone ? 'Enviando Alerta...' : 'Enviar Prueba al Designado'}</span>
              </button>
            </div>
          )}
        </div>

        {designatedContact ? (
          <div style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
          }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                {designatedContact.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: '0.85rem' }}>
                <span style={{ color: '#25D366', fontWeight: 600 }}>📞 {designatedContact.phone}</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: '#38bdf8' }}>{designatedContact.role}</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: designatedContact.callMeBotKey || callMeBotApiKey ? '#10b981' : '#f59e0b', fontSize: '0.78rem' }}>
                  {designatedContact.callMeBotKey || callMeBotApiKey ? '✓ Gateway Automático Vinculado' : '⚠️ Sin API Key (Enlace Directo)'}
                </span>
              </div>
            </div>

            <a
              href={`https://wa.me/${String(designatedContact.phone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hola, este es el canal de alertas de telemonitoreo VigilMotion.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '8px 14px' }}
            >
              <ExternalLink size={14} />
              <span>Abrir Chat Directo</span>
            </a>
          </div>
        ) : (
          <div style={{ color: '#fca5a5', padding: 12, fontSize: '0.9rem' }}>
            No hay ningún contacto designado registrado. Añade uno abajo para vincularlo al sistema de emergencias.
          </div>
        )}
      </div>

      {/* Panel Superior: Guía e Integración de Gateway CallMeBot */}
      <div className="glass-panel" style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={22} color="#25D366" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
              Configuración de Gateway Automático (CallMeBot)
            </h3>
          </div>
          <span className="pill" style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#25D366' }}>
            GRATUITO & ILIMITADO
          </span>
        </div>

        <div style={{
          background: 'rgba(37, 211, 102, 0.05)',
          border: '1px solid rgba(37, 211, 102, 0.2)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 18,
          fontSize: '0.85rem',
          lineHeight: '1.5',
          color: 'var(--text-secondary)',
        }}>
          <strong style={{ color: '#25D366', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <HelpCircle size={16} /> ¿Cómo activar el envío 100% automático al WhatsApp del cuidador?
          </strong>
          CallMeBot envía mensajes automáticos al WhatsApp del contacto designado sin necesidad de que nadie abra una app ni pulse botones:
          <ol style={{ marginLeft: 20, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <li>Guarda en la agenda de WhatsApp del cuidador el número del bot: <code style={{ color: '#38bdf8', fontWeight: 700 }}>+34 644 10 55 84</code></li>
            <li>Desde el WhatsApp del cuidador, envíale al bot este mensaje exacto: <code style={{ color: '#38bdf8', fontWeight: 700 }}>I allow callmebot to send me messages</code></li>
            <li>El bot responderá en segundos con tu <strong>apikey de 6 dígitos</strong>. Pégala abajo junto al número del teléfono.</li>
          </ol>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
          alignItems: 'end',
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              TELÉFONO DEL CONTACTO DESIGNADO (CON PREFIJO INTERNACIONAL)
            </label>
            <input
              type="tel"
              placeholder="Ej: +573001234567 (Colombia) o +521... (México)"
              value={designatedPhone}
              onChange={(e) => setDesignatedPhone(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              API KEY GLOBAL DE CALLMEBOT
            </label>
            <input
              type="text"
              placeholder="Ej: 948123"
              value={callMeBotApiKey}
              onChange={(e) => setCallMeBotApiKey(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <button
              onClick={handleSaveGatewaySettings}
              className="btn btn-whatsapp"
              style={{ width: '100%', padding: '10px 16px' }}
            >
              <CheckCircle size={16} />
              <span>{settingsSaved ? '¡Configuración Guardada!' : 'Guardar Parámetros de WhatsApp'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Estado del Test */}
      {testStatus && (
        <div style={{
          background: testStatus.success ? 'rgba(37, 211, 102, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${testStatus.success ? '#25D366' : '#ef4444'}`,
          borderRadius: 12,
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          fontSize: '0.88rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {testStatus.success ? <CheckCircle size={20} color="#25D366" /> : <AlertCircle size={20} color="#ef4444" />}
            <div>
              <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                {testStatus.success ? 'Entrega Confirmada' : 'Aviso de Entrega Automática'}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                {testStatus.message}
              </div>
            </div>
          </div>
          {testStatus.directLink && (
            <a
              href={testStatus.directLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp"
              style={{ padding: '6px 14px', fontSize: '0.82rem', textDecoration: 'none' }}
            >
              <ExternalLink size={14} />
              <span>Probar Enlace en WhatsApp</span>
            </a>
          )}
        </div>
      )}

      {/* Panel de Contactos de Emergencia */}
      <div className="glass-panel" style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
              Agenda de Contactos del Paciente
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Familiares y médicos asignados a este dispositivo ({contacts.length} registrados)
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
            style={{ padding: '8px 14px', fontSize: '0.82rem' }}
          >
            <Plus size={16} />
            <span>Añadir Cuidador</span>
          </button>
        </div>

        {/* Modal de añadir contacto */}
        {showAddModal && (
          <form onSubmit={handleSaveContact} style={{
            background: 'rgba(17, 26, 48, 0.95)',
            border: '1px solid var(--border-active)',
            borderRadius: 14,
            padding: 20,
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            <h4 style={{ color: '#38bdf8', fontSize: '1rem', fontWeight: 700 }}>Nuevo Contacto de Alerta</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>NOMBRE COMPLETO</label>
                <input
                  type="text"
                  placeholder="Ej: Mariana Baracaldo"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>TELÉFONO INTERNACIONAL</label>
                <input
                  type="tel"
                  placeholder="Ej: +573001234567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>ROL / RELACIÓN</label>
                <input
                  type="text"
                  placeholder="Ej: Hija, Cuidador, Médico"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>API KEY CALLMEBOT INDIVIDUAL</label>
                <input
                  type="text"
                  placeholder="Opcional si usa la global"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input
                type="checkbox"
                id="isDesignatedCheck"
                checked={newIsDesignated}
                onChange={(e) => setNewIsDesignated(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#25D366' }}
              />
              <label htmlFor="isDesignatedCheck" style={{ fontSize: '0.85rem', color: '#f8fafc', cursor: 'pointer' }}>
                Establecer como <strong>Contacto Designado Principal</strong> para despacho prioritario
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ padding: '8px 14px' }}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 18px' }}>
                Guardar Contacto
              </button>
            </div>
          </form>
        )}

        {/* Lista de Contactos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {contacts.map((contact) => {
            const isMain = Boolean(contact.isDesignated);
            return (
              <div
                key={contact.id}
                style={{
                  background: isMain ? 'rgba(37, 211, 102, 0.05)' : 'rgba(255, 255, 255, 0.03)',
                  border: isMain ? '1px solid rgba(37, 211, 102, 0.4)' : '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: isMain ? 'rgba(37, 211, 102, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isMain ? '#25D366' : 'var(--text-muted)',
                  }}>
                    {isMain ? <Star size={20} fill="#25D366" /> : <UserCheck size={20} />}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.98rem', color: '#f8fafc' }}>
                        {contact.name}
                      </span>
                      {isMain && (
                        <span className="pill" style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#25D366', fontSize: '0.68rem', padding: '2px 8px' }}>
                          DESIGNADO
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {contact.phone} · <span style={{ color: '#38bdf8' }}>{contact.role}</span>
                      {contact.callMeBotKey && <span style={{ marginLeft: 8, color: '#10b981' }}>· Key: {contact.callMeBotKey}</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {!isMain && (
                    <button
                      onClick={() => handleSetDesignated(contact.id)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                      title="Hacer contacto principal prioritario"
                    >
                      <Star size={13} />
                      <span>Hacer Designado</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleTestWhatsApp(contact)}
                    disabled={testStatus?.loading && testingPhone === contact.phone}
                    className="btn btn-whatsapp"
                    style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                  >
                    <Send size={13} />
                    <span>{testStatus?.loading && testingPhone === contact.phone ? 'Enviando...' : 'Probar'}</span>
                  </button>

                  <button
                    onClick={() => onDeleteContact(contact.id)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', color: '#fca5a5' }}
                    title="Eliminar contacto"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
