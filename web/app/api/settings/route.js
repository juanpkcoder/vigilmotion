import { NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/storage';

export async function GET() {
  const settings = getSettings();
  return NextResponse.json(settings);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const updated = updateSettings(body);
    return NextResponse.json({ ok: true, settings: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
