import { NextResponse } from 'next/server';
import { getAlerts } from '@/lib/storage';
import { processAlert, initMqttClient } from '@/lib/mqtt-service';

// Asegura que el servicio MQTT esté escuchando al invocar la API
initMqttClient();

export async function GET() {
  const alerts = getAlerts();
  return NextResponse.json(alerts);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const saved = await processAlert(body, body.device || body.dispositivo || 'web-simulado');
    return NextResponse.json({ ok: true, alert: saved }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
