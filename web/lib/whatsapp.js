import { getContacts, getSettings, getDesignatedContact } from './storage.js';

/**
 * Limpia y normaliza un número de teléfono a formato internacional estándar (E.164 sin signos raros)
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  // Elimina espacios, guiones, paréntesis
  let cleaned = String(phone).trim().replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  // Si no tiene '+' pero tiene más de 9 dígitos, asumimos que ya incluye prefijo o lo limpiamos
  return cleaned;
}

/**
 * Genera el número sin el '+' para gateways que requieren formato numérico puro (ej. wa.me)
 */
export function getNumericOnlyPhone(phone) {
  return String(phone || '').replace(/[^0-9]/g, '');
}

/**
 * Formatea un mensaje de emergencia de alta visibilidad para WhatsApp
 */
export function formatEmergencyMessage(alert) {
  const isPanic = alert.type === 'panic';
  const timestamp = Number(alert.ts) > 0 ? Number(alert.ts) : Math.floor(Date.now() / 1000);
  const timeStr = new Date(timestamp * 1000).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'America/Bogota',
  });

  if (isPanic) {
    return (
      `🚨 *ALERTA URGENTE DE VIGILMOTION*\n\n` +
      `⚠️ *BOTÓN DE PÁNICO ACTIVADO*\n` +
      `👤 *Dispositivo:* ${alert.device || 'adulto-01'}\n` +
      `⏰ *Fecha y Hora:* ${timeStr}\n` +
      `📍 *Situación:* El paciente ha pulsado el botón de auxilio solicitando asistencia inmediata.\n\n` +
      `👉 Por favor comuníquese de inmediato con el adulto mayor o acuda a verificar su estado.`
    );
  }

  const impactG = alert.impactG ?? alert.fuerza_g ?? 0;
  const tiltDeg = alert.tiltDeg ?? alert.angulo ?? 0;

  return (
    `🚨 *ALERTA CRÍTICA DE CAÍDA — VIGILMOTION*\n\n` +
    `⚠️ *POSIBLE CAÍDA DEL ADULTO MAYOR DETECTADA*\n` +
    `👤 *Dispositivo:* ${alert.device || 'adulto-01'}\n` +
    `💥 *Fuerza de Impacto:* ${impactG} g\n` +
    `📐 *Inclinación del Torso:* ${tiltDeg}° (Persona tendida)\n` +
    `⏰ *Fecha y Hora:* ${timeStr}\n` +
    `📍 *Diagnóstico:* Secuencia biomecánica de caída validada (ingravidez + impacto + inmovilidad en reposo).\n\n` +
    `👉 Comuníquese de inmediato o llame al servicio médico de urgencias.`
  );
}

/**
 * Envío individual de mensaje a través de CallMeBot
 */
export async function sendViaCallMeBot(phone, text, apiKey) {
  if (!phone || !apiKey) {
    return { ok: false, error: 'Número de teléfono o API Key de CallMeBot faltante' };
  }

  // CallMeBot acepta teléfono con prefijo internacional, ej: +573001234567 o 573001234567
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const encodedText = encodeURIComponent(text);
  const encodedPhone = encodeURIComponent(cleanPhone);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodedPhone}&text=${encodedText}&apikey=${apiKey.trim()}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'VigilMotion-Monitor/2.0',
      },
    });
    clearTimeout(timeoutId);

    const body = await res.text();
    const isSuccess = res.ok && !body.toLowerCase().includes('error');
    console.log(`[CallMeBot] Envío a ${cleanPhone} -> Status: ${res.status}, Respuesta: ${body.substring(0, 80)}`);

    return {
      ok: isSuccess,
      status: res.status,
      body,
      phone: cleanPhone,
    };
  } catch (err) {
    console.error(`[CallMeBot Error] Envío a ${cleanPhone}:`, err.message);
    return { ok: false, error: err.message, phone: cleanPhone };
  }
}

/**
 * Envío individual de mensaje a través de Green-API
 */
export async function sendViaGreenApi(phone, text, instanceId, token) {
  if (!instanceId || !token) {
    return { ok: false, error: 'Instance ID o Token de Green-API faltante' };
  }
  let cleanNumber = getNumericOnlyPhone(phone);
  if (!cleanNumber.endsWith('@c.us')) {
    cleanNumber = `${cleanNumber}@c.us`;
  }

  const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: cleanNumber,
        message: text,
      }),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (err) {
    console.error(`[Green-API Error]:`, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Genera un enlace directo wa.me para abrir en WhatsApp Web o WhatsApp Móvil
 * Enfocado al contacto designado o número específico
 */
export function generateDirectWhatsAppLink(phone, text) {
  const numericPhone = getNumericOnlyPhone(phone);
  const encodedText = encodeURIComponent(text);
  if (numericPhone) {
    return `https://wa.me/${numericPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Despacho inteligente a todos los contactos de emergencia,
 * priorizando al Contacto Designado Principal.
 */
export async function dispatchAlertToContacts(alert) {
  const contacts = getContacts();
  const settings = getSettings();
  const designated = getDesignatedContact();
  const message = formatEmergencyMessage(alert);
  const isPanic = alert.type === 'panic';

  const designatedLink = designated
    ? generateDirectWhatsAppLink(designated.phone, message)
    : generateDirectWhatsAppLink('', message);

  const results = [];

  // Ordenar contactos para que el contacto designado se procese primero
  const sortedContacts = [...contacts].sort((a, b) => {
    if (a.isDesignated) return -1;
    if (b.isDesignated) return 1;
    return 0;
  });

  for (const contact of sortedContacts) {
    const shouldNotify = isPanic ? contact.notifyOnPanic : contact.notifyOnFall;
    if (!shouldNotify) continue;

    const directLink = generateDirectWhatsAppLink(contact.phone, message);
    let dispatchStatus = {
      contactId: contact.id,
      name: contact.name,
      phone: contact.phone,
      isDesignated: Boolean(contact.isDesignated),
      method: settings.provider,
      sent: false,
      directLink,
    };

    if (settings.provider === 'callmebot') {
      const apiKey = (contact.callMeBotKey || settings.callMeBotApiKey || '').trim();
      if (apiKey) {
        const sendRes = await sendViaCallMeBot(contact.phone, message, apiKey);
        dispatchStatus.sent = sendRes.ok;
        dispatchStatus.details = sendRes;
      } else {
        dispatchStatus.sent = false;
        dispatchStatus.note = 'Sin API Key individual configurada. Disponible enlace directo.';
      }
    } else if (settings.provider === 'greenapi') {
      if (settings.greenApiInstanceId && settings.greenApiToken) {
        const sendRes = await sendViaGreenApi(contact.phone, message, settings.greenApiInstanceId, settings.greenApiToken);
        dispatchStatus.sent = sendRes.ok;
        dispatchStatus.details = sendRes;
      }
    } else {
      // Método Direct / Manual
      dispatchStatus.sent = true;
      dispatchStatus.note = 'Enlace directo preparado listo para WhatsApp';
    }

    results.push(dispatchStatus);
  }

  return {
    message,
    designatedContact: designated,
    designatedLink,
    results,
  };
}
