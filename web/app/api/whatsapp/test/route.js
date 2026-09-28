import { NextResponse } from 'next/server';
import { getSettings, getContacts } from '@/lib/storage';
import { sendViaCallMeBot, sendViaGreenApi, generateDirectWhatsAppLink } from '@/lib/whatsapp';
import { checkRateLimit, sanitizeText, validatePhone } from '@/lib/security';

export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    // Máximo 4 pruebas de WhatsApp por minuto para proteger las cuentas de cuotas/bloqueos
    const rate = checkRateLimit(ip + ':wa_test', 4, 60000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Has alcanzado el límite de pruebas de WhatsApp. Espera 1 minuto para evitar bloqueos del proveedor.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const settings = getSettings();
    const contacts = getContacts();

    let targetPhone = body.phone ? sanitizeText(body.phone) : (contacts[0] ? contacts[0].phone : null);
    if (!targetPhone || !validatePhone(targetPhone)) {
      return NextResponse.json({ error: 'Número de teléfono inválido o no configurado.' }, { status: 400 });
    }

    const testMessage =
      `🧪 *PRUEBA DE CONEXIÓN VIGILMOTION*\n\n` +
      `✅ El sistema de telemonitoreo 24/7 está correctamente vinculado con tu WhatsApp.\n` +
      `En caso de caída o activación de pánico, recibirás avisos prioritarios en este chat.\n` +
      `⏰ Hora: ${new Date().toLocaleTimeString()} · Fecha: ${new Date().toLocaleDateString()}`;

    let result = { provider: settings.provider, phone: targetPhone };

    if (settings.provider === 'callmebot') {
      const apiKey = body.apiKey ? sanitizeText(body.apiKey) : (contacts[0] ? contacts[0].callMeBotKey : '') || settings.callMeBotApiKey;
      if (!apiKey) {
        return NextResponse.json({
          ok: false,
          error: 'Falta la API Key de CallMeBot. Ingresa tu API key para probar el envío automático.',
          directLink: generateDirectWhatsAppLink(targetPhone, testMessage),
        });
      }
      const sendRes = await sendViaCallMeBot(targetPhone, testMessage, apiKey);
      result = { ...result, ...sendRes };
    } else if (settings.provider === 'greenapi') {
      const instance = settings.greenApiInstanceId;
      const token = settings.greenApiToken;
      if (!instance || !token) {
        return NextResponse.json({
          ok: false,
          error: 'Falta Instance ID o Token de Green-API.',
          directLink: generateDirectWhatsAppLink(targetPhone, testMessage),
        });
      }
      const sendRes = await sendViaGreenApi(targetPhone, testMessage, instance, token);
      result = { ...result, ...sendRes };
    } else {
      result.directLink = generateDirectWhatsAppLink(targetPhone, testMessage);
      result.ok = true;
    }

    return NextResponse.json({
      ok: Boolean(result.ok),
      result,
      message: result.ok ? 'Mensaje entregado a WhatsApp con éxito' : (result.error || 'No se pudo entregar vía CallMeBot automáticamente. Utiliza el enlace directo.'),
      directLink: generateDirectWhatsAppLink(targetPhone, testMessage),
    });
  } catch (err) {
    return NextResponse.json({ error: 'Fallo procesando el envío de prueba: ' + err.message }, { status: 500 });
  }
}
