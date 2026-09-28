/**
 * Módulo de seguridad, sanitización y protección contra abusos (Rate Limiting)
 */

// Memoria de limitación de tasa por IP / clave
const rateLimitMap = new Map();

/**
 * Limitador de tasa (Rate Limiting) en memoria
 * @param {string} ip - Identificador o IP del cliente
 * @param {number} maxRequests - Número máximo de peticiones permitidas en la ventana
 * @param {number} windowMs - Duración de la ventana en milisegundos (ej: 60000 = 1 min)
 * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
 */
export function checkRateLimit(ip = 'anonymous', maxRequests = 30, windowMs = 60000) {
  const now = Date.now();
  const clientData = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };

  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + windowMs;
  } else {
    clientData.count += 1;
  }

  rateLimitMap.set(ip, clientData);

  const allowed = clientData.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - clientData.count);
  const resetMs = Math.max(0, clientData.resetTime - now);

  // Limpieza periódica de entradas viejas
  if (rateLimitMap.size > 2000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetTime) rateLimitMap.delete(key);
    }
  }

  return { allowed, remaining, resetMs };
}

/**
 * Sanitiza cadenas de texto para prevenir inyección de código (XSS)
 */
export function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '') // Elimina etiquetas HTML
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .slice(0, 500); // Evita payloads excesivos
}

/**
 * Valida formato de número de teléfono internacional E.164
 */
export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  // Permite números de 8 a 16 dígitos con o sin + inicial
  const clean = phone.replace(/[\s\-\(\)]/g, '');
  return /^\+?[0-9]{8,16}$/.test(clean);
}

/**
 * Validador de token secreto para Webhooks del ESP32 (opcional)
 */
export function verifyWebhookSecret(authHeader, expectedSecret) {
  if (!expectedSecret) return true; // Si no hay secreto configurado, se permite
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token === expectedSecret.trim();
}
