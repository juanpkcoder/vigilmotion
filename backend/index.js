import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mqtt from 'mqtt';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 3000);
const MQTT_URL = process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';
const TOPICS = {
  fall: process.env.MQTT_TOPIC_FALL || 'vigilmotion/+/fall',
  status: process.env.MQTT_TOPIC_STATUS || 'vigilmotion/+/status',
};

// ============================================================
// Almacenamiento persistente simple (JSON en disco)
// ============================================================
const TOKENS_FILE = path.join(__dirname, 'tokens.json');
const ALERTS_FILE = path.join(__dirname, 'alerts.json');

const state = {
  alerts: [],            // historial persistente de alertas
  devices: new Map(),    // deviceId -> última telemetría
  pushTokens: [],        // tokens Expo de los móviles registrados
};

// Carga inicial de tokens
if (fs.existsSync(TOKENS_FILE)) {
  try {
    state.pushTokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  } catch (err) {
    console.warn('No se pudo leer tokens.json:', err.message);
  }
}
const saveTokens = () => {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(state.pushTokens, null, 2));
  } catch (err) {
    console.error('Error guardando tokens.json:', err.message);
  }
};

// Carga inicial de alertas
if (fs.existsSync(ALERTS_FILE)) {
  try {
    const raw = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
    if (Array.isArray(raw)) state.alerts = raw.slice(0, 200);
  } catch (err) {
    console.warn('No se pudo leer alerts.json:', err.message);
  }
}
const saveAlerts = () => {
  try {
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(state.alerts, null, 2));
  } catch (err) {
    console.error('Error guardando alerts.json:', err.message);
  }
};

// ============================================================
// Normalización de Payloads (Compatibilidad Dual ES/EN)
// ============================================================
export function normalizeAlert(raw = {}, fallbackDevice = 'desconocido') {
  // Manejo de tipo / evento
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
    raw: raw.raw || undefined,
  };
}

// ============================================================
// Push notifications (Expo Push Service)
// ============================================================
async function sendExpoPush(tokens, title, body, data = {}) {
  const valid = tokens.filter((t) => t && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken')));
  if (valid.length === 0) {
    console.log('No hay push tokens válidos registrados para notificar.');
    return;
  }

  const messages = valid.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data: { url: data.url, alertId: data.alertId, device: data.device },
    priority: 'high',
    channelId: 'fall-alerts',
  }));

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });
    const result = await res.json();
    console.log(`Push enviada (${valid.length} destinatarios) -> Status: ${res.status}`);
    if (result.errors) {
      console.warn('Expo Push advertencias:', result.errors);
    }
  } catch (err) {
    console.error('Error enviando push notification:', err.message);
  }
}

async function notifyFall(alert) {
  const isPanic = alert.type === 'panic';
  const title = isPanic ? '🚨 ¡BOTÓN DE PÁNICO ACTIVADO!' : '⚠️ ¡CAÍDA DETECTADA!';
  const body = isPanic
    ? `El paciente pulsó el botón de pánico en el dispositivo (${alert.device}). Requiere asistencia inmediata.`
    : `Alerta en ${alert.device}: impacto medido de ${alert.impactG}g con inclinación de ${alert.tiltDeg}°. Persona potencialmente tendida.`;

  await sendExpoPush(
    state.pushTokens,
    title,
    body,
    {
      alertId: alert.id,
      device: alert.device,
      url: PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}/alert/${alert.id}` : undefined,
    }
  );
}

// ============================================================
// Servidor HTTP + SSE
// ============================================================
const app = express();
app.use(cors());
app.use(express.json());

const sseClients = new Set();

function broadcast(event, payload) {
  for (const res of sseClients) {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch {
      sseClients.delete(res);
    }
  }
}

// Registro y difusión de alertas
function registerAlert(rawAlert, fallbackDevice) {
  const alert = normalizeAlert(rawAlert, fallbackDevice);

  // Filtro antiduplicados estricto: evita alertar 2 veces por el mismo impacto en 5s
  const prev = state.alerts.find(
    (a) => a.device === alert.device && a.type === alert.type && Math.abs(a.ts - alert.ts) < 5
  );
  if (prev) {
    console.log(`[AntiDuplicado] Alerta ignorada (${alert.device}, ts=${alert.ts})`);
    return prev;
  }

  state.alerts.unshift(alert);
  if (state.alerts.length > 200) state.alerts.length = 200;
  saveAlerts();

  console.log(`[ALERTA REGISTRADA] Tipo: ${alert.type} | Disp: ${alert.device} | ${alert.impactG}g | ${alert.tiltDeg}°`);
  broadcast('fall', alert);
  notifyFall(alert);
  return alert;
}

// SSE: Eventos en tiempo real para la App
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write('retry: 3000\n\n');
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Registrar Push Token del teléfono
app.post('/api/push-token', (req, res) => {
  const { token } = req.body || {};
  if (!token || (!token.startsWith('ExponentPushToken') && !token.startsWith('ExpoPushToken'))) {
    return res.status(400).json({ error: 'Token Expo inválido' });
  }
  if (!state.pushTokens.includes(token)) {
    state.pushTokens.push(token);
    saveTokens();
    console.log(`Nuevo token Expo registrado. Total tokens: ${state.pushTokens.length}`);
  }
  res.json({ ok: true, total: state.pushTokens.length });
});

// Obtener estado y telemetría de dispositivos
app.get('/api/devices', (_req, res) => {
  res.json(Object.fromEntries(state.devices));
});

// Historial de alertas
app.get('/api/alerts', (_req, res) => {
  res.json(state.alerts);
});

// Endpoint Webhook HTTP para el ESP32 (soporta /api/alerts y /api/alertas)
const handleWebhookAlert = (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Cuerpo JSON inválido' });
  }
  console.log('Webhook HTTP recibido desde ESP32:', JSON.stringify(payload));
  const saved = registerAlert(payload, 'esp32-http');
  res.status(201).json({ ok: true, alert: saved });
};
app.post('/api/alerts', handleWebhookAlert);
app.post('/api/alertas', handleWebhookAlert);

// Endpoint de prueba de alertas
app.post('/api/test-alert', (_req, res) => {
  const alert = {
    type: 'test',
    device: 'simulador-prueba',
    ts: Math.floor(Date.now() / 1000),
    impactG: 3.4,
    tiltDeg: 78.5,
  };
  const saved = registerAlert(alert, 'simulador-prueba');
  res.json(saved);
});

// Endpoint para disparar pánico manual desde la app hacia el ESP32
app.post('/api/panic', (req, res) => {
  const { device = 'adulto-01' } = req.body || {};
  const panicTopic = `vigilmotion/${device}/panic`;
  if (client.connected) {
    client.publish(panicTopic, JSON.stringify({ action: 'panic', ts: Date.now() }));
    console.log(`Comando de pánico enviado al topic MQTT: ${panicTopic}`);
  }
  const alert = registerAlert({ type: 'panic', device, ts: Math.floor(Date.now() / 1000), impactG: 0, tiltDeg: 0 }, device);
  res.json({ ok: true, alert });
});

// Heartbeat SSE del servidor
setInterval(() => broadcast('ping', { ts: Date.now() }), 15000);

const server = app.listen(PORT, () => {
  console.log(`Backend VigilMotion escuchando en http://localhost:${PORT}`);
});

// ============================================================
// Cliente MQTT (comunicación con ESP32)
// ============================================================
const client = mqtt.connect(MQTT_URL, {
  reconnectPeriod: 3000,
  connectTimeout: 10000,
});

client.on('connect', () => {
  console.log('MQTT conectado exitosamente a', MQTT_URL);
  client.subscribe(TOPICS.fall, (err) => {
    if (err) console.error('Error suscribiendo a', TOPICS.fall, err.message);
    else console.log('Suscrito a tópico de caídas:', TOPICS.fall);
  });
  client.subscribe(TOPICS.status, (err) => {
    if (err) console.error('Error suscribiendo a', TOPICS.status, err.message);
    else console.log('Suscrito a tópico de telemetría:', TOPICS.status);
  });
});

client.on('message', (topic, payload) => {
  try {
    const raw = JSON.parse(payload.toString());
    const topicParts = topic.split('/');
    const topicDevice = topicParts[1] || 'desconocido';

    if (topic.endsWith('/fall')) {
      console.log(`[MQTT /fall] ${topic} ->`, payload.toString());
      registerAlert(raw, topicDevice);
    } else if (topic.endsWith('/status')) {
      const devName = raw.device || raw.dispositivo || topicDevice;
      const devState = {
        ...raw,
        device: devName,
        lastSeen: Date.now(),
        rssi: Number(raw.rssi ?? -70),
        state: raw.state ?? 0,
        batteryPct: raw.batteryPct ?? raw.bateria ?? null,
      };
      state.devices.set(devName, devState);
      broadcast('status', devState);
    }
  } catch (err) {
    console.error('Mensaje MQTT inválido:', payload.toString(), err.message);
  }
});

client.on('error', (err) => console.error('MQTT error de conexión:', err.message));
client.on('offline', () => console.warn('MQTT offline'));
client.on('reconnect', () => console.log('MQTT reconectando...'));

// Cierre ordenado
process.on('SIGINT', () => {
  console.log('Cerrando servidor VigilMotion...');
  client.end(true);
  server.close(() => process.exit(0));
});