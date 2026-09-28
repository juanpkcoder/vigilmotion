# VigilMotion — Sistema de detección de caídas para adulto mayor

Sistema completo de 3 partes:

```
┌──────────────┐   MQTT    ┌──────────────┐   HTTPS   ┌──────────────┐
│  ESP32 +     │ ────────▶ │ Backend Node │ ────────▶ │  App móvil   │
│  MPU6050     │  (caída)  │  (alertas +  │   push    │  (Expo / RN) │
│  firmware    │           │  notificaciones)          │              │
└──────────────┘           └──────────────┘            └──────────────┘
      sensor                 broker MQTT                 notificaciones
                             + API REST
```

- El **ESP32** lee el MPU6050 a ~100 Hz, detecta la caída con una máquina de estados (caída libre → impacto → persona tendida) y publica la alerta por **MQTT**.
- El **backend** escucha MQTT, guarda las alertas y manda **push notifications** al móvil (servicio de Expo, funciona en iOS y Android sin Firebase).
- La **app móvil** recibe notificaciones, muestra el estado de los dispositivos y el historial de alertas en tiempo real (SSE).

---

## 1. Lo que necesitas físicamente

| Componente | Notas |
|---|---|
| **ESP32 DevKit V1** (recomendado) | Cualquier placa ESP32 sirve. WiFi + Bluetooth. |
| **MPU6050** (módulo GY-521) | Acelerómetro + giroscopio de 6 ejes. |
| Breadboard + jumpers | Para el prototipo. |
| **Buzzer activo** (opcional) | Alarma sonora local junto al paciente. |
| Botón pulsador (opcional) | Botón de pánico manual. |
| Batería 3.7V LiPo + módulo de carga, o power bank | Alimentación portátil. |
| Cinta / funda / cinturón elástico | Para fijar el dispositivo al torso del paciente. |

> **IMPORTANTE:** el MPU6050 y sus pines SDA/SCL van a **3.3V**, nunca a 5V. No conectes VCC a 5V.

### Pines (ESP32 DevKit V1 → MPU6050)

| Conector MPU6050 | Pin ESP32 | Notas |
|---|---|---|
| **VCC** | **3V3** | Nunca 5V |
| **GND** | **GND** | |
| **SCL** | **GPIO 22** | Reloj I2C |
| **SDA** | **GPIO 21** | Datos I2C |
| **AD0** | **GND** | Fuerza la dirección 0x68 |
| **INT** | GPIO 23 *(opcional)* | Interrupción del sensor |
| **XDA** | — | Sin conectar (solo magnetómetro externo) |
| **XCL** | — | Sin conectar |

**Opcionales:**
- **GPIO 27** → patilla (+) del buzzer (el otro extremo a GND).
- **GPIO 33** → patilla del botón de pánico; el otro extremo a GND (el firmware usa pull-up interno).
- **GPIO 2** → LED de estado integrado (ya viene en la placa).

> Si usas un **ESP8266 (NodeMCU/D1 Mini)** en vez de ESP32: SCL = **D1 (GPIO5)**, SDA = **D2 (GPIO4)**, VCC = 3.3V, GND. El firmware incluye `WiFi.h` de ESP32; para ESP8266 cambia `#include <WiFi.h>` por `#include <ESP8266WiFi.h>`.

### Cómo fijarlo al cuerpo

- El lugar con mejor rendimiento para detectar caídas es la **zona lumbar / cintura posterior** (cinturón elástico o funda con clip). Un segundo buen punto es el **pecho** (arnés).
- El PDF/común e importante: el MPU6050 debe quedar **fijo** al cuerpo (sin que el módulo oscile), orientado con el chip hacia fuera. Un módulo suelto genera falsas alertas.
- Buzzer y botón deben quedar accesibles.

---

## 2. Firmware (ESP32)

Tienes dos opciones: **Arduino/C++** o **MicroPython con Thonny** (la que prefieres). Elige una.

### Opción A — MicroPython con Thonny (recomendada)

Archivos en `firmware/micropython/`: `main.py` (maquina de estados a ~100 Hz + envio asíncrono), `mpu6050.py` (driver del sensor) y `config.py` (toda la configuración).

1. En Thonny: `Tools → Options → Interpreter` → selecciona **MicroPython (ESP32)**.
   - Si la placa no tiene MicroPython, pulsa **"Install or update firmware"** y descarga el binario desde
   https://micropython.org/download/ESP32_GENERIC/ (botón "ESP32_GENERIC" → `.bin`).
2. (Solo si quieres MQTT) Instala el cliente MQTT: `Tools → Manage packages...` → busca e instala **micropython-umqtt.simple**.
   Si no lo encuentras, en la REPL ejecuta: `import mip; mip.install("umqtt.simple")`.
3. Edita en `config.py` (atención: sin tildes, edita con el editor de Thonny):
   - `WIFI_SSID` / `WIFI_PASS`.
   - `DEVICE_ID` (ej: `adulto-01`).
   - `WEBHOOK_URL` con el endpoint que reciba el JSON de la alerta (deja `SIMULATE_ONLY = True`
     para probar sin enviar nada; verás el payload solo por consola).
4. Sube los 3 archivos con **"Guardar en dispositivo"** (Save As → MicroPython device).
   El ESP32 ejecutará `main.py` automáticamente al encender.
5. En la REPL verás primero el **self-test** (confirma que el sensor mide bien) y después las fases de detección:
   ```
   === VigilMotion (MPU6050) ===
   MPU6050 OK (WHO_AM_I=0x68)
   Self-test: leyendo 8 muestras del sensor...
   ---- SELF-TEST SENSOR ----
     Acelerometro: ax=0.01 ay=0.02 az=0.99  |a|=0.99g  (reposo debe ser ~1g)
     Giroscopio  : gx=0.2 gy=-0.1 gz=0.3   |w|=0.4 dps (reposo debe ser ~0)
     Veredicto   : acelerometro OK | giroscopio OK
     >> SENSOR OK: responde y mide como debe. Listo para detectar caidas.
   WiFi OK: 192.168.1.50
   Calibrando: coloca el dispositivo en su posicion de uso y no lo muevas...
   Referencia (g): ax=0.01 ay=0.02 az=0.99
   Sistema armado. Muestreo a 100 Hz...
   LIVE -> |acel|=0.99g |giro|=0.4 dps inclinacion=0.2 grados estado=0 ARMADO
   FASE 1: caída libre
   FASE 2: impacto
   FASE 3: inclinación
   Varianza del giroscopio
   !! CAÍDA CONFIRMADA -> ALERTA !!
   ```
   > Cada 5 s verás una línea `LIVE` con lo que lee el sensor: si esos números se quedan
   > congelados o son absurdos, el sensor va mal (revisa el cableado).

> La detección es asíncrona (módulo `asyncio`): el muestreo nunca se bloquea mientras
> se envía la alerta por HTTP. El envío salta si `SIMULATE_ONLY = True`.

### Opción B — Arduino IDE (C++)
1. `Tools → Board Manager` → instalar **esp32** (expressif).
2. `Tools → Manage Libraries...` e instalar:
   - **Adafruit MPU6050**
   - **Adafruit Unified Sensor**
   - **PubSubClient** (Nick O'Leary)
3. Abre `firmware/fall_detector/fall_detector.ino`, edita `config.h` y súbelo.
4. Monitor Serie (115200 baud) con las mismas fases de detección.

> Ambas opciones detectan con el mismo algoritmo de 3 fases (caída libre →
> impacto → orientación + inmovilidad). La alerta viaja por **HTTP POST (webhook)**
> y, opcionalmente, por MQTT (activa `MQTT_ENABLED` en `config.py` y el backend
> funciona igual con cualquiera de las dos).

### Algoritmo de detección (máquina de estados)
```
IDLE ──(A < 0.40g durante ≥ 120 ms)──▶ FREE_FALL ──(pico > 2.5g en ≤ 1 s)──▶ IMPACT
IMPACT ──(0.4 s de asentamiento)──▶ se mide inclinación:
   Δángulo > 60° ──▶ IMMOBILE ──(2.5 s inmovilidad, varianza giroscopio baja)──▶ CONFIRMED
   Δángulo ≤ 60° ──▶ IDLE (descartado)
CONFIRMED ──▶ envía alerta (webhook/MQTT) ──▶ 5 s de debounce
   la persona debe volver a estar erguida y quieta 2 s para rearmar el sistema
```
Umbrales ajustables en `config.h` (C++) o `config.py` (MicroPython): `FREE_FALL_G`,
`IMPACT_G`, `TILT_DELTA_DEG`, `IMMOBILE_WINDOW_S`, `ALERT_COOLDOWN_S`, entre otros.

---

## 3. Backend (Node.js)

Necesitas **Node.js ≥ 18**.

```bash
cd backend
npm install
copy .env.example .env        # ajusta si usas tu propio broker MQTT
npm start
```

- Uso por defecto el broker público **broker.hivemq.com** (sin configurar nada). Para producción monta **Mosquitto** en un VPS y apunta `MQTT_URL`.
- Endpoints:
  - `POST /api/alerts` (o `/api/alertas`) — Webhook HTTP para que el ESP32 envíe alertas directamente.
  - `POST /api/push-token` — la app registra su token Expo.
  - `GET /api/alerts` — historial persistente de caídas (`alerts.json`).
  - `GET /api/devices` — estado y telemetría de los dispositivos en tiempo real.
  - `GET /api/events` — **SSE** en tiempo real.
  - `POST /api/panic` — emite orden de pánico de emergencia hacia el ESP32 vía MQTT.
  - `POST /api/test-alert` — manda una alerta de prueba para validar la notificación.
- Para que el móvil reciba **notificaciones desde internet** necesitas exponer el backend: `ngrok http 3000` y usar esa URL pública en `PUBLIC_BASE_URL` (y en la app, `app/config.js`).

---

## 4. App móvil (Expo / React Native)

```bash
cd app
npm install
npx expo install expo-notifications   # alinea versiones
npx expo start
```

1. Escanea el QR con la app **Expo Go** (Android) o abre en un simulador iOS.
2. Edita `app/config.js` → `API_URL` con la IP de tu PC (misma WiFi): `http://192.168.1.50:3000`. Si usas ngrok, pon la URL pública.
3. La app pide permiso de notificaciones y registra su **ExpoPushToken** en el backend automáticamente.

### Flujo de la alerta
1. El ESP32 detecta la caída y publica `vigilmotion/adulto-01/fall` por MQTT.
2. El backend recibe el mensaje, lo guarda y manda un push: **“⚠️ Caída detectada”** con impacto e inclinación.
3. Al tocarla, la app abre el detalle de la alerta.

> Nota Android: notificaciones push de Expo requieren la app Expo Go o una build de desarrollo (`npx expo run:android`). La configuración ya incluye el permiso `POST_NOTIFICATIONS` y el plugin de expo-notifications.

---

## 5. Probar el sistema (sin el sensor)

Sin tener el ESP32 a mano puedes validar todo con el botón **“Enviar prueba”** de la app (llama a `POST /api/test-alert`): deberías recibir la notificación en el móvil.

---

## Estructura del proyecto

```
vigilmotion/
├── web/                        # Plataforma Web Next.js 14 (Desplegable en Vercel)
│   ├── app/                    # Rutas App Router (Dashboard, APIs REST, SSE)
│   ├── components/             # Monitoreo en vivo, WhatsApp, Alertas, Cookies, Sobre Nosotros
│   ├── lib/                    # Storage serverless, WhatsApp dispatch (CallMeBot), MQTT
│   ├── vercel.json             # Configuración de despliegue en Vercel
│   └── .env.example            # Variables de entorno recomendadas
├── firmware/
│   ├── fall_detector/          # Opción Arduino/C++ (ESP32 DevKit V1)
│   │   ├── fall_detector.ino   # Algoritmo de 5 fases + Webhook HTTPS + MQTT + Serial Test
│   │   └── config.h            # Configuración de WiFi, Webhook Vercel y umbrales
│   └── micropython/            # Opción MicroPython (Thonny)
│       ├── main.py             # Detección asíncrona a 100 Hz + Webhook + MQTT + Serial Test
│       ├── mpu6050.py          # Driver I2C calibrado a 44 Hz DLPF
│       └── config.py           # WiFi, URL de Vercel, parámetros de laboratorio y pines
├── backend/
│   ├── index.js                # Servidor Node.js independiente (MQTT + Webhook + Almacenamiento)
│   └── package.json
└── app/
    ├── App.js                  # App móvil alternativa en React Native / Expo
    └── package.json
```

---

## 6. Despliegue en Vercel (Paso a Paso)

1. Sube este repositorio a tu GitHub: `https://github.com/juanpkcoder/vigilmotion.git`
2. En [vercel.com](https://vercel.com), pulsa **"Add New Project"** e importa el repositorio `vigilmotion`.
3. En **Root Directory**, selecciona la carpeta `web` (o déjalo en raíz si usas monorepo).
4. En **Environment Variables**, añade:
   - `DESIGNATED_CONTACT_PHONE`: Número del cuidador principal con prefijo internacional (ej. `+573001234567`).
   - `DESIGNATED_CONTACT_NAME`: Nombre del cuidador (ej. `Mariana Baracaldo`).
   - `CALLMEBOT_API_KEY`: Tu API key gratuita de CallMeBot para despacho automático.
5. Pulsa **Deploy**.
6. Copia la URL pública generada (ej. `https://vigilmotion.vercel.app`) y pégala en `WEBHOOK_URL` dentro de `firmware/micropython/config.py` o `firmware/fall_detector/config.h`:
   ```python
   WEBHOOK_URL = "https://vigilmotion.vercel.app/api/alerts"
   ```
7. ¡Listo! Tu sensor físico enviará las alertas por HTTPS a la nube y el cuidador recibirá los mensajes en WhatsApp en tiempo real.