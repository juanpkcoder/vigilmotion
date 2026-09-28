"""
main.py — VigilMotion: Detector de caidas de alta precision (ESP32 + MPU6050).

ARQUITECTURA ASINCRONA NO BLOQUEANTE:
  - sensor_loop()      Muestrea a 100 Hz y ejecuta la maquina de estados de 5 etapas.
  - alert_sink()       Consume la cola de alertas y envia Webhook HTTP y/o MQTT.
  - telemetry_task()   Envia latidos de estado (RSSI, uptime) para la app movil.
  - wifi_keepalive()   Supervisa y recupera la conexion WiFi sin interrupciones.
"""

import time
import json
import math
import socket
from machine import Pin

import config
from mpu6050 import MPU6050

try:
    import asyncio
except ImportError:
    import uasyncio as asyncio

try:
    import machine
except ImportError:
    machine = None

# ============================================================
# ESTADOS DE LA MAQUINA DE DETECCION
# ============================================================
IDLE          = 0   # En espera / monitoreo continuo
FREE_FALL     = 1   # Fase 1: Gravedad < FREE_FALL_G (ingravidez)
AWAIT_IMPACT  = 2   # Fase 2a: Esperando pico de desaceleracion
IMPACT_SETTLE = 3   # Fase 2b: Asentamiento del impacto
IMMOBILE      = 4   # Fase 3: Postura horizontal + inmovilidad

STATE_NAMES = {
    IDLE: "IDLE (ARMADO)",
    FREE_FALL: "CAIDA LIBRE",
    AWAIT_IMPACT: "ESPERANDO IMPACTO",
    IMPACT_SETTLE: "ASENTAMIENTO IMPACTO",
    IMMOBILE: "EVALUANDO INMOVILIDAD",
}

# ============================================================
# HARDWARE
# ============================================================
mpu = None
buzzer = Pin(config.BUZZER_PIN, Pin.OUT) if config.BUZZER_PIN >= 0 else None
led = Pin(config.LED_PIN, Pin.OUT) if config.LED_PIN >= 0 else None
panic_btn = (
    Pin(config.PANIC_PIN, Pin.IN, Pin.PULL_UP) if config.PANIC_PIN >= 0 else None
)
led_blink_time = 0
led_state = False

# ============================================================
# VARIABLES DEL DETECTOR
# ============================================================
state = IDLE
ref = (0.0, 0.0, 1.0)           # Vector de gravedad erguido de referencia
armed = True                    # False durante el cooldown tras una alerta
last_alert_ms = 0
fall_start_ms = 0
await_impact_start_ms = 0
impact_start_ms = 0
immobile_start_ms = 0
max_impact_g = 0.0
tilt_deg = 0.0
immobile_samples = []
upper_start_ms = 0
last_debug_heartbeat_ms = 0
mqtt_client_instance = None

# ============================================================
# MATEMATICAS Y PROCESAMIENTO VECTORIAL
# ============================================================
def accel_magnitude(a):
    """Magnitud vectorial total A = sqrt(ax^2 + ay^2 + az^2) en unidades de g."""
    ax, ay, az = a
    return math.sqrt(ax * ax + ay * ay + az * az)

def gyro_magnitude(g):
    """Magnitud angular |w| = sqrt(wx^2 + wy^2 + wz^2) en grados/segundo."""
    gx, gy, gz = g
    return math.sqrt(gx * gx + gy * gy + gz * gz)

def angle_between(a, b):
    """
    Calcula el angulo tridimensional exacto (en grados) entre la gravedad
    actual 'a' y el vector erguido de referencia 'b'.
    """
    ax, ay, az = a
    bx, by, bz = b
    dot = ax * bx + ay * by + az * bz
    mag_a = math.sqrt(ax * ax + ay * ay + az * az)
    mag_b = math.sqrt(bx * bx + by * by + bz * bz)
    if mag_a < 0.05 or mag_b < 0.05:
        return 0.0
    cos_t = dot / (mag_a * mag_b)
    cos_t = max(-1.0, min(1.0, cos_t))
    return math.degrees(math.acos(cos_t))

def variance(samples):
    """Varianza poblacional: var = E[x^2] - (E[x])^2."""
    if not samples:
        return 0.0
    n = float(len(samples))
    mean = sum(samples) / n
    sq = sum(s * s for s in samples) / n
    return max(0.0, sq - mean * mean)

def elapsed_ms(t0):
    """Calcula tiempo transcurrido en ms gestionando desbordamiento de ticks."""
    return time.ticks_diff(time.ticks_ms(), t0)

# ============================================================
# CALIBRACION DEL VECTOR DE REFERENCIA (POSTURA ERGUIDA)
# ============================================================
async def calibrate_reference(timeout_ms=10000):
    """
    Captura y promedia la direccion de la gravedad mientras el dispositivo
    esta puesto sobre la persona en reposo erguido.
    """
    global ref
    print("\n--- Calibrando postura erguida de referencia ---")
    print("Coloca el dispositivo en el cuerpo y permanece quieto de pie...")
    acc = [0.0, 0.0, 0.0]
    n = 0
    start = time.ticks_ms()
    while elapsed_ms(start) < timeout_ms:
        a = mpu.accel()
        m = accel_magnitude(a)
        w = gyro_magnitude(mpu.gyro())
        # Criterio estricto de reposo erguido: aceleracion ~1g y sin rotacion
        if 0.85 < m < 1.15 and w < config.GYRO_ACTIVE_DPS:
            for i in range(3):
                acc[i] += a[i]
            n += 1
            if n >= 50:  # 50 muestras estables = 500 ms de reposo verificado
                ref = tuple(acc[i] / n for i in range(3))
                print(">> Calibracion exitosa. Vector referencia: ax=%.2f, ay=%.2f, az=%.2f" % ref)
                return ref
        await asyncio.sleep_ms(10)

    if n > 10:
        ref = tuple(acc[i] / n for i in range(3))
        print(">> Calibracion parcial completada: ax=%.2f, ay=%.2f, az=%.2f" % ref)
    else:
        ref = (0.0, 0.0, 1.0)
        print(">> AVISO: No se detecto reposo. Se asume orientacion vertical estandar.")
    return ref

# ============================================================
# AUTO-TEST DE INTEGRIDAD DEL SENSOR
# ============================================================
async def sensor_selftest(n=10):
    print("Verificando diagnostico del sensor MPU6050...")
    acc = [0.0, 0.0, 0.0]
    gyr = [0.0, 0.0, 0.0]
    for _ in range(n):
        a = mpu.accel()
        g = mpu.gyro()
        for i in range(3):
            acc[i] += a[i]
            gyr[i] += g[i]
        await asyncio.sleep_ms(15)

    ax, ay, az = (v / n for v in acc)
    gx, gy, gz = (v / n for v in gyr)
    A = accel_magnitude((ax, ay, az))
    w = gyro_magnitude((gx, gy, gz))

    acc_ok = 0.75 < A < 1.25
    gyro_ok = w < 40.0

    print("================== SELF-TEST MPU6050 ==================")
    print("  Aceleracion estatica: |a|=%.2fg  (Esperado: ~1.0g)" % A)
    print("  Giroscopio estatico : |w|=%.1f dps (Esperado: < 40 dps)" % w)
    print("  Estado: %s" % ("OPERATIVO Y CALIBRADO" if (acc_ok and gyro_ok) else "REVISAR CONEXION"))
    print("=======================================================")

# ============================================================
# GESTION WIFI ROBUSTA
# ============================================================
def connect_wifi():
    import network
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print("Conectando a red WiFi: '%s'..." % config.WIFI_SSID)
        wlan.connect(config.WIFI_SSID, config.WIFI_PASS)
        for _ in range(25):  # 12.5 s maximo
            if wlan.isconnected():
                break
            time.sleep_ms(500)
    if wlan.isconnected():
        print("WiFi Conectado con IP:", wlan.ifconfig()[0])
    else:
        print("AVISO: No se pudo conectar a WiFi. Se operara en modo local.")
    return wlan

async def wifi_keepalive(wlan):
    offline_count = 0
    while True:
        await asyncio.sleep_ms(10000)
        if wlan.isconnected():
            offline_count = 0
            continue

        offline_count += 1
        print("WiFi desconectado. Reintentando conexion (%d)..." % offline_count)
        try:
            wlan.disconnect()
            wlan.connect(config.WIFI_SSID, config.WIFI_PASS)
        except Exception as e:
            print("Error en reconexion WiFi:", e)

        # Si tras 6 intentos (1 minuto) no conecta y se dispone de machine, reset de rescate
        if offline_count >= 6 and machine is not None:
            print("Fallo critico de red prolongado. Reiniciando ESP32...")
            machine.reset()

# ============================================================
# ALARMA SONORA ASINCRONA (NO BLOQUEA MUESTREO)
# ============================================================
async def sound_alarm(cycles=8):
    if buzzer is None:
        return
    for _ in range(cycles):
        buzzer.value(1)
        await asyncio.sleep_ms(80)
        buzzer.value(0)
        await asyncio.sleep_ms(100)

# ============================================================
# ENVIO DE ALERTAS (HTTP POST Y/O MQTT)
# ============================================================
def http_post_alert(url, body_json, token=""):
    """Peticion HTTP POST por socket crudo optimizado."""
    try:
        scheme, _, rest = url.partition("://")
        if not rest:
            scheme, rest = "http", url
        host_port, _, path = rest.partition("/")
        path = "/" + path if path else "/"

        if ":" in host_port:
            host, port_s = host_port.split(":", 1)
            port = int(port_s)
        else:
            host = host_port
            port = 443 if scheme == "https" else 80

        s = socket.socket()
        s.settimeout(4.0)
        s.connect((host, port))

        if scheme == "https":
            try:
                import ssl
            except ImportError:
                import ussl as ssl
            try:
                s = ssl.wrap_socket(s, server_hostname=host)
            except (TypeError, ValueError, AttributeError):
                try:
                    s = ssl.wrap_socket(s)
                except Exception as ssl_err:
                    print("Error SSL:", ssl_err)

        data = body_json.encode('utf-8')
        headers = (
            "POST %s HTTP/1.1\r\n"
            "Host: %s\r\n"
            "User-Agent: VigilMotion-ESP32/2.0\r\n"
            "Content-Type: application/json\r\n"
            "Content-Length: %d\r\n"
            "Connection: close\r\n"
        ) % (path, host, len(data))
        if token:
            headers += "Authorization: Bearer %s\r\n" % token

        s.sendall(headers.encode('utf-8') + b"\r\n" + data)

        res = s.recv(256)
        s.close()
        parts = res.split(b" ", 2)
        if len(parts) >= 2:
            return int(parts[1])
        return 200
    except Exception as e:
        print("Fallo HTTP:", e)
        return None

def get_mqtt_client():
    global mqtt_client_instance
    if not config.MQTT_ENABLED:
        return None
    if mqtt_client_instance is not None:
        return mqtt_client_instance
    try:
        from umqtt.simple import MQTTClient
        c = MQTTClient(
            config.DEVICE_ID,
            config.MQTT_HOST,
            config.MQTT_PORT,
            config.MQTT_USER,
            config.MQTT_PASS,
            keepalive=60,
        )
        c.connect()
        mqtt_client_instance = c
        print("MQTT conectado a", config.MQTT_HOST)
        return c
    except Exception as e:
        print("Error inicializando MQTT:", e)
        mqtt_client_instance = None
        return None

def mqtt_send_fall(payload):
    c = get_mqtt_client()
    if c is None:
        return False
    try:
        topic = config.MQTT_TOPIC_FALL % config.DEVICE_ID
        c.publish(topic, json.dumps(payload))
        print("MQTT -> Publicado en", topic)
        return True
    except Exception as e:
        print("Error publicando en MQTT:", e)
        try:
            c.disconnect()
        except:
            pass
        return False

def build_payload(evento, fuerza_g, angulo):
    """
    Construye payload con compatibilidad dual (ingles y espanol)
    para integracion exacta con el backend y la app.
    """
    is_panic = (evento in ("panico_manual", "panic"))
    now_ts = int(time.time())
    return {
        "type": "panic" if is_panic else "fall",
        "evento": evento,
        "device": config.DEVICE_ID,
        "dispositivo": config.DEVICE_ID,
        "ts": now_ts,
        "impactG": round(float(fuerza_g), 2),
        "fuerza_g": round(float(fuerza_g), 2),
        "tiltDeg": round(float(angulo), 1),
        "angulo": round(float(angulo), 1),
    }

def http_send_callmebot(text):
    """Envia alerta directa a WhatsApp via CallMeBot desde el propio ESP32."""
    api_key = getattr(config, 'CALLMEBOT_API_KEY', '').strip()
    phone = getattr(config, 'CALLMEBOT_PHONE', '').strip()
    if not api_key or not phone:
        return False
    try:
        clean_phone = phone.replace(' ', '').replace('-', '')
        encoded_text = text.replace(' ', '%20').replace('\n', '%0A')
        path = "/whatsapp.php?phone=%s&text=%s&apikey=%s" % (clean_phone, encoded_text, api_key)

        s = socket.socket()
        s.settimeout(5.0)
        s.connect(("api.callmebot.com", 443))
        try:
            import ssl
        except ImportError:
            import ussl as ssl
        try:
            s = ssl.wrap_socket(s, server_hostname="api.callmebot.com")
        except:
            s = ssl.wrap_socket(s)

        req = "GET %s HTTP/1.1\r\nHost: api.callmebot.com\r\nUser-Agent: VigilMotion-ESP32\r\nConnection: close\r\n\r\n" % path
        s.sendall(req.encode('utf-8'))
        resp = s.recv(128)
        s.close()
        print(">> [WhatsApp ESP32] CallMeBot respuesta:", resp.split(b"\r\n")[0].decode('utf-8', 'ignore'))
        return True
    except Exception as e:
        print("Fallo enviando WhatsApp directo desde ESP32:", e)
        return False

async def alert_sink(q):
    """
    Consumidor asincrono de alertas. Realiza las llamadas de red y sonido
    sin interferir en el muestreo de 100 Hz.
    """
    while True:
        alert_data = await q.get()
        payload = build_payload(**alert_data)
        json_str = json.dumps(payload)

        print("\n=======================================================")
        print(">>> DISPARANDO ALERTA AL SISTEMA <<<")
        print(json_str)
        print("=======================================================\n")

        # Alarma sonora inmediata (no bloqueante)
        asyncio.create_task(sound_alarm(8))

        if config.SIMULATE_ONLY:
            print("[Modo Simulacion Activo] No se envia a la red.")
            continue

        # 1. Envio por HTTP Webhook si esta configurado (Vercel)
        if config.WEBHOOK_URL:
            ok = False
            for attempt in range(3):
                code = http_post_alert(config.WEBHOOK_URL, json_str, config.WEBHOOK_TOKEN)
                if code is not None and 200 <= code < 300:
                    print("Webhook entregado con exito a Vercel (Codigo: %d)" % code)
                    ok = True
                    break
                print("Reintentando Webhook (intento %d/3)..." % (attempt + 1))
                await asyncio.sleep_ms(600 * (attempt + 1))
            if not ok:
                print("Aviso: No se pudo entregar la alerta por Webhook HTTP.")

        # 2. Envio por MQTT si esta habilitado
        if config.MQTT_ENABLED:
            mqtt_send_fall(payload)

        # 3. Envio directo a WhatsApp via CallMeBot desde el ESP32
        if getattr(config, 'CALLMEBOT_API_KEY', '') and getattr(config, 'CALLMEBOT_PHONE', ''):
            is_panic = (payload.get("type") == "panic")
            msg = (
                "ALERTA VIGILMOTION: " +
                ("BOTON DE PANICO" if is_panic else "CAIDA DETECTADA") +
                " en dispositivo " + config.DEVICE_ID +
                " (Impacto: " + str(payload.get("impactG", 0)) + "g, " +
                "Inclinacion: " + str(payload.get("tiltDeg", 0)) + " deg). Verifique de inmediato!"
            )
            http_send_callmebot(msg)

# ============================================================
# TELEMETRIA PERIODICA DE ESTADO (HEARTBEAT)
# ============================================================
async def telemetry_task(wlan):
    """Envia periodicamente telemetria para que la app conozca el estado del equipo."""
    import network
    while True:
        await asyncio.sleep_ms(config.HEARTBEAT_S * 1000)
        if not config.MQTT_ENABLED or not wlan.isconnected():
            continue

        c = get_mqtt_client()
        if c is None:
            continue

        try:
            status_payload = {
                "device": config.DEVICE_ID,
                "dispositivo": config.DEVICE_ID,
                "ts": int(time.time()),
                "rssi": wlan.status('rssi') if hasattr(wlan, 'status') else -65,
                "state": state,
                "armed": armed,
                "ref": [round(v, 2) for v in ref],
            }
            topic = config.MQTT_TOPIC_STATUS % config.DEVICE_ID
            c.publish(topic, json.dumps(status_payload))
        except Exception as e:
            print("Error enviando telemetria:", e)

# ============================================================
# BUCLE PRINCIPAL DE MUESTREO (100 HZ / MAQUINA DE ESTADOS)
# ============================================================
async def sensor_loop(q):
    global state, ref, armed, last_alert_ms
    global fall_start_ms, await_impact_start_ms, impact_start_ms, immobile_start_ms
    global max_impact_g, tilt_deg, immobile_samples, upper_start_ms
    global led_state, led_blink_time, last_debug_heartbeat_ms

    panic_prev = 1

    while True:
        await asyncio.sleep_ms(config.SAMPLE_PERIOD_MS)  # 10 ms = 100 Hz
        now = time.ticks_ms()

        # Lectura inercial
        a = mpu.accel()
        g = mpu.gyro()
        A = accel_magnitude(a)          # Aceleracion total en g
        w = gyro_magnitude(g)           # Velocidad angular en deg/s
        tilt = angle_between(a, ref)    # Desviacion angular de la vertical

        # Telemetria en consola cada 5 segundos
        if config.DEBUG and elapsed_ms(last_debug_heartbeat_ms) >= 5000:
            last_debug_heartbeat_ms = now
            print("[100Hz LIVE] |a|=%.2fg |w|=%.1f dps | tilt=%.1f° | Estado=%s | %s"
                  % (A, w, tilt, STATE_NAMES.get(state, str(state)), "ARMADO" if armed else "COOLDOWN"))

        # Deteccion de Boton de Panico
        if panic_btn is not None:
            p = panic_btn.value()
            if p == 0 and panic_prev == 1:
                print("🚨 ¡¡BOTON DE PANICO ACCIONADO MANUALMENTE!!")
                q.put_nowait({"evento": "panico_manual", "fuerza_g": 0.0, "angulo": 0.0})
            panic_prev = p

        # Gestion de Rearmado post-alerta
        if state == IDLE and not armed:
            if tilt < config.UPRIGHT_RECOVER_DEG and w < config.GYRO_ACTIVE_DPS:
                if upper_start_ms == 0:
                    upper_start_ms = now
                if elapsed_ms(upper_start_ms) >= config.REARM_MS and elapsed_ms(last_alert_ms) >= config.ALERT_COOLDOWN_S * 1000:
                    armed = True
                    upper_start_ms = 0
                    print(">> Sistema rearmado y listo para nueva deteccion.")
            else:
                upper_start_ms = 0

        # Filtro de adaptacion lenta de gravedad erguida (solo en reposo erguido)
        if state == IDLE and armed and (0.90 < A < 1.10) and (w < 15.0) and (tilt < 20.0):
            ref = tuple(0.99 * r + 0.01 * c for r, c in zip(ref, a))

        # ========================================================
        # MAQUINA DE ESTADOS DE 5 ETAPAS (PRECISION MAXIMA)
        # ========================================================
        if state == IDLE:
            # FASE 1: Deteccion de inicio de Caida Libre (ingravidez)
            if armed and A < config.FREE_FALL_G:
                fall_start_ms = now
                state = FREE_FALL
                max_impact_g = 0.0
                if config.DEBUG:
                    print("--> FASE 1: Caida libre detectada (A=%.2fg < %.2fg)" % (A, config.FREE_FALL_G))

        elif state == FREE_FALL:
            since = elapsed_ms(fall_start_ms)
            if A < config.FREE_FALL_G:
                # Sigue en el aire
                if since > 1500:  # Mas de 1.5s en gravedad cero es anomalo
                    state = IDLE
            else:
                # Concluyo el periodo de gravedad baja: verificar duracion minima
                if since >= config.FREE_FALL_MIN_MS:
                    state = AWAIT_IMPACT
                    await_impact_start_ms = now
                    max_impact_g = A
                    if config.DEBUG:
                        print("--> FASE 2: Fin de caida libre (%d ms). Esperando pico de impacto..." % since)
                else:
                    # Perturbacion o salto demasiado breve
                    state = IDLE

        elif state == AWAIT_IMPACT:
            if A > max_impact_g:
                max_impact_g = A

            since_await = elapsed_ms(await_impact_start_ms)
            if A >= config.IMPACT_G:
                # Pico de impacto validado!
                state = IMPACT_SETTLE
                impact_start_ms = now
                if config.DEBUG:
                    print("--> FASE 2 CONFIRMADA: Pico de impacto registrado: %.2fg (en %d ms)" % (max_impact_g, since_await))
            elif since_await > config.IMPACT_WINDOW_S * 1000:
                # Se vencio la ventana de 1 segundo sin impacto suficiente
                if config.DEBUG:
                    print("--> Ventana de impacto agotada (pico max fue %.2fg < %.2fg). Caida descartada." % (max_impact_g, config.IMPACT_G))
                state = IDLE

        elif state == IMPACT_SETTLE:
            if A > max_impact_g:
                max_impact_g = A

            # Espera asentamiento de vibraciones mecanicas
            if elapsed_ms(impact_start_ms) >= config.SETTLE_S * 1000:
                tilt_deg = tilt
                if config.DEBUG:
                    print("--> FASE 3: Asentamiento finalizado. Inclinacion resultante: %.1f°" % tilt_deg)

                if tilt_deg >= config.TILT_DELTA_DEG:
                    # Persona tendida (cambio de angulo >= 50 grados)
                    state = IMMOBILE
                    immobile_start_ms = now
                    immobile_samples = []
                    if config.DEBUG:
                        print("--> Cambio de postura verificado (>%.0f°). Monitoreando ventana de inmovilidad..." % config.TILT_DELTA_DEG)
                else:
                    if config.DEBUG:
                        print("--> Persona continuo erguida tras el impacto (tilt=%.1f°). Descartado." % tilt_deg)
                    state = IDLE

        elif state == IMMOBILE:
            # Si la persona se reincorpora voluntariamente durante la ventana
            if tilt < config.UPRIGHT_RECOVER_DEG:
                if config.DEBUG:
                    print("--> Persona se levanto por si misma (tilt=%.1f°). Alerta cancelada." % tilt)
                state = IDLE
            else:
                immobile_samples.append(w)
                if elapsed_ms(immobile_start_ms) >= config.IMMOBILE_WINDOW_S * 1000:
                    var = variance(immobile_samples)
                    mean_w = sum(immobile_samples) / len(immobile_samples) if immobile_samples else 0.0

                    if config.DEBUG:
                        print("--> FASE 4: Evaluacion de inmovilidad: varianza=%.1f, media=%.1f dps" % (var, mean_w))

                    if var <= config.GYRO_VAR_MAX and mean_w < config.GYRO_ACTIVE_DPS:
                        # CAIDA CONFIRMADA
                        print("\n🚨 ¡¡CAIDA CONFIRMADA CON MAXIMA CERTEZA!! 🚨")
                        q.put_nowait({
                            "evento": "caida_detectada",
                            "fuerza_g": max_impact_g,
                            "angulo": tilt_deg,
                        })
                        last_alert_ms = now
                        armed = False
                    else:
                        if config.DEBUG:
                            print("--> Movimiento vigoroso tras el suelo (var=%.1f, w=%.1f). Descartado." % (var, mean_w))
                    state = IDLE

        # Indicador LED
        if led is not None:
            if armed:
                if state == IDLE and elapsed_ms(led_blink_time) >= 600:
                    led_state = not led_state
                    led_blink_time = now
                elif state != IDLE:
                    led_state = True
            else:
                led_state = True
            led.value(led_state)

# ============================================================
# ESCUCHADOR DE COMANDOS SERIALES PARA PRUEBAS DE LABORATORIO
# ============================================================
async def serial_test_listener(q):
    """Permite enviar comandos de prueba ('t' o 'p') por consola serial/Thonny."""
    if not getattr(config, 'ENABLE_SERIAL_TEST', False):
        return
    import sys
    try:
        import uselect as select
    except ImportError:
        import select

    poll = select.poll()
    poll.register(sys.stdin, select.POLLIN)

    print(">> MODO DE PRUEBAS ACTIVO: Escribe 't' para simular caida o 'p' para panico.")

    while True:
        await asyncio.sleep_ms(200)
        try:
            events = poll.poll(0)
            if events:
                char = sys.stdin.read(1)
                if char in ('t', 'T', 'c', 'C'):
                    print("\n[TEST SERIAL] >> Disparando caida de prueba calibrada (3.2g, 76°)...")
                    q.put_nowait({"evento": "caida_detectada", "fuerza_g": 3.2, "angulo": 76.0})
                elif char in ('p', 'P'):
                    print("\n[TEST SERIAL] >> Disparando boton de panico de prueba...")
                    q.put_nowait({"evento": "panico_manual", "fuerza_g": 0.0, "angulo": 0.0})
        except Exception as e:
            pass

# ============================================================
# PUNTO DE ENTRADA PRINCIPAL
# ============================================================
async def main():
    global mpu
    print("=======================================================")
    print("      VIGILMOTION — SISTEMA DE DETECCION DE CAIDAS     ")
    print("                   ESP32 + MPU6050                    ")
    print("=======================================================")

    try:
        mpu = MPU6050(
            config.I2C_SCL_PIN,
            config.I2C_SDA_PIN,
            config.I2C_FREQ,
            config.MPU6050_ADDRESS,
        )
    except Exception as e:
        print("ERROR INICIALIZANDO MPU6050:", e)
        if led is not None:
            while True:
                led.value(not led.value())
                await asyncio.sleep_ms(150)
        return

    print("MPU6050 conectado (WHO_AM_I=0x%02x)" % mpu.who_am_i())
    await sensor_selftest()

    wlan = connect_wifi()
    await calibrate_reference()

    q = asyncio.Queue()

    asyncio.create_task(sensor_loop(q))
    asyncio.create_task(alert_sink(q))
    asyncio.create_task(wifi_keepalive(wlan))
    asyncio.create_task(telemetry_task(wlan))
    if getattr(config, 'ENABLE_SERIAL_TEST', False):
        asyncio.create_task(serial_test_listener(q))

    print("\n>> Sistema armado y vigilando activamente a 100 Hz.\n")

    while True:
        await asyncio.sleep_ms(60000)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except AttributeError:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(main())
    except KeyboardInterrupt:
        print("\nDetenido por usuario.")
    except Exception as e:
        print("Excepcion no controlada:", e)