import mqtt from 'mqtt';
import { saveAlert, updateDevice } from './storage.js';
import { dispatchAlertToContacts } from './whatsapp.js';

const MQTT_URL = process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883';
const TOPIC_FALL = 'vigilmotion/+/fall';
const TOPIC_STATUS = 'vigilmotion/+/status';

// Almacenamos los suscriptores SSE activos en memoria global
if (!globalThis._sseListeners) {
  globalThis._sseListeners = new Set();
}

export function addSseListener(sendFn) {
  globalThis._sseListeners.add(sendFn);
  return () => {
    globalThis._sseListeners.delete(sendFn);
  };
}

export function broadcastSse(event, data) {
  for (const listener of globalThis._sseListeners) {
    try {
      listener(event, data);
    } catch {
      globalThis._sseListeners.delete(listener);
    }
  }
}

/**
 * Normaliza cualquier formato recibido (español o inglés)
 */
export function normalizeIncomingAlert(raw, fallbackDevice = 'adulto-01') {
  let type = raw.type || raw.evento || 'fall';
  if (type === 'caida_detectada') type = 'fall';
  if (type === 'panico_manual') type = 'panic';

  const device = String(raw.device || raw.dispositivo || fallbackDevice);
  const ts = Number(raw.ts) > 0 ? Number(raw.ts) : Math.floor(Date.now() / 1000);
  const impactG = Number(raw.impactG ?? raw.fuerza_g ?? 0);
  const tiltDeg = Number(raw.tiltDeg ?? raw.angulo ?? 0);

  return {
    id: raw.id || `al-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type,
    device,
    ts,
    impactG: Math.round(impactG * 10) / 10,
    tiltDeg: Math.round(tiltDeg * 10) / 10,
  };
}

/**
 * Registra una alerta, envía WhatsApp a los contactos y notifica a los clientes web
 */
export async function processAlert(rawAlert, fallbackDevice) {
  const alert = normalizeIncomingAlert(rawAlert, fallbackDevice);
  const saved = saveAlert(alert);
  if (!saved) {
    console.log(`[AntiDuplicado Web] Alerta suprimida (${alert.device}, ${alert.type})`);
    return alert;
  }

  console.log(`🚨 [ALERTA PROCESADA] ${saved.type.toUpperCase()} en ${saved.device} (${saved.impactG}g, ${saved.tiltDeg}°)`);

  // Difundir en tiempo real a las pestañas y teléfonos conectados vía SSE
  broadcastSse('fall', saved);

  // Enviar alertas de emergencia a WhatsApp
  try {
    const waDispatch = await dispatchAlertToContacts(saved);
    console.log(`[WhatsApp Dispatch] Notificaciones despachadas a ${waDispatch.results.length} contactos.`);
    broadcastSse('whatsapp_sent', { alertId: saved.id, results: waDispatch.results });
  } catch (err) {
    console.error('Error enviando WhatsApp:', err);
  }

  return saved;
}

/**
 * Inicializador singleton del cliente MQTT
 */
export function initMqttClient() {
  if (globalThis._vigilMotionMqtt) {
    return globalThis._vigilMotionMqtt;
  }

  // En Vercel serverless functions las conexiones TCP de larga duración se suspenden al finalizar la petición HTTP
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isVercel && process.env.ENABLE_MQTT_SERVERLESS !== 'true') {
    // En Vercel el sensor se comunica preferentemente vía Webhook HTTP (/api/alerts)
    return null;
  }

  try {
    console.log('[MQTT] Iniciando conexión persistente a', MQTT_URL);
    const client = mqtt.connect(MQTT_URL, {
      reconnectPeriod: 5000,
      connectTimeout: 5000,
    });

  client.on('connect', () => {
    console.log('[MQTT Conectado] Suscribiendo a canales de caídas y telemetría...');
    client.subscribe(TOPIC_FALL, (err) => {
      if (err) console.error('[MQTT Fall Subscribe Error]:', err);
      else console.log('[MQTT OK] Escuchando caídas en', TOPIC_FALL);
    });
    client.subscribe(TOPIC_STATUS, (err) => {
      if (err) console.error('[MQTT Status Subscribe Error]:', err);
      else console.log('[MQTT OK] Escuchando estado en', TOPIC_STATUS);
    });
  });

  client.on('message', async (topic, payload) => {
    try {
      const raw = JSON.parse(payload.toString());
      const parts = topic.split('/');
      const deviceId = parts[1] || 'adulto-01';

      if (topic.endsWith('/fall')) {
        await processAlert(raw, deviceId);
      } else if (topic.endsWith('/status')) {
        const deviceData = {
          ...raw,
          rssi: Number(raw.rssi ?? -70),
          state: raw.state ?? 0,
        };
        const updated = updateDevice(deviceId, deviceData);
        broadcastSse('status', updated);
      }
    } catch (e) {
      console.warn('[MQTT Error procesando mensaje]:', e.message);
    }
  });

  client.on('error', (err) => {
    console.warn('[MQTT Error de transporte]:', err.message);
  });

    globalThis._vigilMotionMqtt = client;
    return client;
  } catch (err) {
    console.warn('[MQTT] Error iniciando cliente:', err.message);
    return null;
  }
}
