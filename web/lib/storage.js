import fs from 'node:fs';
import path from 'node:path';

// En entornos serverless de Vercel/AWS Lambda, el sistema de archivos raíz es de solo lectura.
// Por ello, en Vercel utilizamos /tmp/vigilmotion-data para persistencia temporal sin errores EROFS.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const BUNDLED_DATA_DIR = path.join(process.cwd(), 'data');
const DATA_DIR = isServerless ? path.join('/tmp', 'vigilmotion-data') : BUNDLED_DATA_DIR;

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[Storage] Directorio data en memoria:', e.message);
}

const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');

// Contactos de emergencia predeterminados con soporte de variables de entorno (Vercel)
const envDesignatedPhone = process.env.DESIGNATED_CONTACT_PHONE || process.env.CALLMEBOT_PHONE || '+573052078345';
const envDesignatedName = process.env.DESIGNATED_CONTACT_NAME || 'Mariana Baracaldo (Cuidador Principal)';
const envCallMeBotKey = process.env.CALLMEBOT_API_KEY || '';

const DEFAULT_CONTACTS = [
  {
    id: 'c-1',
    name: envDesignatedName,
    phone: envDesignatedPhone,
    role: 'Familiar / Cuidador Principal',
    callMeBotKey: envCallMeBotKey,
    notifyOnFall: true,
    notifyOnPanic: true,
    isDesignated: true, // Contacto designado principal
  },
  {
    id: 'c-2',
    name: 'Dr. Wilson Pérez (Médico Director)',
    phone: '+573109876543',
    role: 'Médico de Cabecera',
    callMeBotKey: '',
    notifyOnFall: true,
    notifyOnPanic: false,
    isDesignated: false,
  },
  {
    id: 'c-3',
    name: 'Centro de Teleasistencia Engativá',
    phone: '+573009998877',
    role: 'Línea de Emergencia 24/7',
    callMeBotKey: '',
    notifyOnFall: true,
    notifyOnPanic: true,
    isDesignated: false,
  },
];

const DEFAULT_SETTINGS = {
  provider: 'callmebot', // 'callmebot' | 'greenapi' | 'direct'
  designatedContactId: 'c-1',
  designatedPhone: envDesignatedPhone,
  callMeBotApiKey: envCallMeBotKey,
  callMeBotPhone: envDesignatedPhone,
  greenApiInstanceId: process.env.GREEN_API_INSTANCE || '',
  greenApiToken: process.env.GREEN_API_TOKEN || '',
  enableAudioSiren: true,
  autoNotifyWhatsApp: true,
  autoRearmSeconds: 15,
};

function readJsonFile(filePath, fallback, bundledFallbackName = '') {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    // Si estamos en Vercel y el archivo en /tmp aún no existe, intentamos leer el original empaquetado en repo
    if (isServerless && bundledFallbackName) {
      const bundledPath = path.join(BUNDLED_DATA_DIR, bundledFallbackName);
      if (fs.existsSync(bundledPath)) {
        const data = JSON.parse(fs.readFileSync(bundledPath, 'utf8'));
        // Guardamos copia en /tmp para futuras lecturas
        try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8'); } catch {}
        return data;
      }
    }
  } catch (err) {
    console.warn(`[Storage] Lectura de ${filePath}:`, err.message);
  }
  return fallback;
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[Storage] Escritura en ${filePath} (usando caché en memoria):`, err.message);
  }
}

// In-memory cache
let alertsCache = readJsonFile(ALERTS_FILE, [], 'alerts.json');
let contactsCache = readJsonFile(CONTACTS_FILE, DEFAULT_CONTACTS, 'contacts.json');
let settingsCache = readJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS, 'settings.json');
let devicesCache = readJsonFile(DEVICES_FILE, {}, 'devices.json');

// Asegurar que al menos un contacto esté marcado como designado
if (Array.isArray(contactsCache) && contactsCache.length > 0) {
  const hasDesignated = contactsCache.some((c) => c.isDesignated);
  if (!hasDesignated) {
    contactsCache[0].isDesignated = true;
  }
}

export function getAlerts() {
  return alertsCache;
}

export function saveAlert(alert) {
  const isDuplicate = alertsCache.some(
    (a) => a.device === alert.device && a.type === alert.type && Math.abs(a.ts - alert.ts) < 5
  );
  if (isDuplicate) return null;

  alertsCache.unshift(alert);
  if (alertsCache.length > 200) alertsCache = alertsCache.slice(0, 200);
  writeJsonFile(ALERTS_FILE, alertsCache);
  return alert;
}

export function getContacts() {
  return contactsCache;
}

export function getDesignatedContact() {
  const designated = contactsCache.find((c) => c.isDesignated);
  if (designated) return designated;
  if (settingsCache.designatedContactId) {
    const byId = contactsCache.find((c) => c.id === settingsCache.designatedContactId);
    if (byId) return byId;
  }
  return contactsCache[0] || null;
}

export function setDesignatedContact(contactId) {
  contactsCache = contactsCache.map((c) => ({
    ...c,
    isDesignated: c.id === contactId,
  }));
  const designated = contactsCache.find((c) => c.id === contactId);
  if (designated) {
    settingsCache.designatedContactId = designated.id;
    settingsCache.designatedPhone = designated.phone;
    writeJsonFile(SETTINGS_FILE, settingsCache);
  }
  writeJsonFile(CONTACTS_FILE, contactsCache);
  return contactsCache;
}

export function saveContacts(contacts) {
  contactsCache = contacts;
  writeJsonFile(CONTACTS_FILE, contactsCache);
  return contactsCache;
}

export function addContact(contact) {
  const isFirst = contactsCache.length === 0;
  const newContact = {
    id: `c-${Date.now()}`,
    name: contact.name || 'Nuevo Contacto',
    phone: contact.phone || '',
    role: contact.role || 'Cuidador',
    callMeBotKey: contact.callMeBotKey || '',
    notifyOnFall: contact.notifyOnFall !== false,
    notifyOnPanic: contact.notifyOnPanic !== false,
    isDesignated: contact.isDesignated || isFirst,
  };

  if (newContact.isDesignated) {
    contactsCache = contactsCache.map((c) => ({ ...c, isDesignated: false }));
    settingsCache.designatedContactId = newContact.id;
    settingsCache.designatedPhone = newContact.phone;
    writeJsonFile(SETTINGS_FILE, settingsCache);
  }

  contactsCache.push(newContact);
  writeJsonFile(CONTACTS_FILE, contactsCache);
  return newContact;
}

export function deleteContact(id) {
  contactsCache = contactsCache.filter((c) => c.id !== id);
  // Si eliminamos el designado, reasignar al primero
  if (contactsCache.length > 0 && !contactsCache.some((c) => c.isDesignated)) {
    contactsCache[0].isDesignated = true;
    settingsCache.designatedContactId = contactsCache[0].id;
    settingsCache.designatedPhone = contactsCache[0].phone;
    writeJsonFile(SETTINGS_FILE, settingsCache);
  }
  writeJsonFile(CONTACTS_FILE, contactsCache);
  return contactsCache;
}

export function getSettings() {
  return settingsCache;
}

export function updateSettings(newSettings) {
  settingsCache = { ...settingsCache, ...newSettings };
  writeJsonFile(SETTINGS_FILE, settingsCache);
  return settingsCache;
}

export function getDevices() {
  return devicesCache;
}

export function updateDevice(deviceId, data) {
  devicesCache[deviceId] = {
    ...devicesCache[deviceId],
    ...data,
    device: deviceId,
    lastSeen: Date.now(),
  };
  writeJsonFile(DEVICES_FILE, devicesCache);
  return devicesCache[deviceId];
}
