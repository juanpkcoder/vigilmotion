import { addSseListener, initMqttClient } from '@/lib/mqtt-service';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  initMqttClient();

  let cleanup;
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Enviar saludo inicial
      controller.enqueue(encoder.encode(`event: ping\ndata: {"time":${Date.now()}}\n\n`));

      const sendEvent = (event, data) => {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (e) {
          // Cliente desconectado
        }
      };

      cleanup = addSseListener(sendEvent);

      // Ping periódico para mantener el socket vivo
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {"time":${Date.now()}}\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        if (cleanup) cleanup();
      });
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
