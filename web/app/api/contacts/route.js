import { NextResponse } from 'next/server';
import { getContacts, addContact, deleteContact, saveContacts, setDesignatedContact } from '@/lib/storage';
import { sanitizeText, validatePhone, checkRateLimit } from '@/lib/security';

export async function GET() {
  const contacts = getContacts();
  return NextResponse.json(contacts);
}

export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rate = checkRateLimit(ip, 20, 60000);
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Espera un momento.' }, { status: 429 });
    }

    const body = await req.json();

    if (Array.isArray(body)) {
      const sanitizedList = body.map((c) => ({
        ...c,
        name: sanitizeText(c.name),
        phone: sanitizeText(c.phone),
        role: sanitizeText(c.role),
      }));
      const updated = saveContacts(sanitizedList);
      return NextResponse.json({ ok: true, contacts: updated });
    }

    // Sanitización y validación estricta
    const cleanName = sanitizeText(body.name);
    const cleanPhone = sanitizeText(body.phone);
    const cleanRole = sanitizeText(body.role || 'Cuidador');

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: 'El nombre debe contener al menos 2 caracteres válidos.' }, { status: 400 });
    }

    if (!validatePhone(cleanPhone)) {
      return NextResponse.json({ error: 'Formato de teléfono inválido. Usa formato internacional (ej: +521234567890).' }, { status: 400 });
    }

    const newContact = addContact({
      name: cleanName,
      phone: cleanPhone,
      role: cleanRole,
      callMeBotKey: sanitizeText(body.callMeBotKey),
      notifyOnFall: body.notifyOnFall !== false,
      notifyOnPanic: body.notifyOnPanic !== false,
    });

    return NextResponse.json({ ok: true, contact: newContact }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Solicitud malformada' }, { status: 400 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = sanitizeText(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'ID faltante' }, { status: 400 });
    const remaining = deleteContact(id);
    return NextResponse.json({ ok: true, contacts: remaining });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    if (body.action === 'set_designated' && body.id) {
      const updated = setDesignatedContact(sanitizeText(body.id));
      return NextResponse.json({ ok: true, contacts: updated });
    }
    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
