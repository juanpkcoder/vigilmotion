import { NextResponse } from 'next/server';
import { getDevices } from '@/lib/storage';
import { initMqttClient } from '@/lib/mqtt-service';

initMqttClient();

export async function GET() {
  const devices = getDevices();
  return NextResponse.json(devices);
}
