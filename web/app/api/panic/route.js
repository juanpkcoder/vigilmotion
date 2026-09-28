import { NextResponse } from 'next/server';
import { processAlert, initMqttClient } from '@/lib/mqtt-service';
import { checkRateLimit, sanitizeText } from '@/lib/security';

export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    // Máximo 6 activaciones de pánico por minuto por cliente para prevenir flooding intencional
    const rate = checkRateLimit(ip + ':panic', 6, 60000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Límite de activaciones alcanzado. Espera unos segundos antes de reintentar.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const deviceId = sanitizeText(body.device || 'adulto-01');

    const client = initMqttClient();
    if (client && client.connected) {
      const topic = `vigilmotion/${deviceId}/panic`;
      client.publish(topic, JSON.stringify({ action: 'panic', ts: Date.now() }));
      console.log(`[Pánico Remoto Seguro] Publicado en ${topic}`);
    }

    const alert = await processAlert(
      {
        type: 'panic',
        evento: 'panico_manual',
        device: deviceId,
        impactG: 0,
        tiltDeg: 0,
        ts: Math.floor(Date.now() / 1000),
      },
      deviceId
    );

    return NextResponse.json({ ok: true, alert });
  } catch (err) {
    return NextResponse.json({ error: 'Error procesando pánico de emergencia' }, { status: 500 });
  }
}
