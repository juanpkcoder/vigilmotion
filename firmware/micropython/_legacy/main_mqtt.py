"""
VigilMotion - detector de caídas para adulto mayor  (MicroPython / ESP32)

Ejecutar desde Thonny. Al guardar como main.py se autoejecuta al encender la placa.

Instalacion previa en Thonny:
  1) Tools -> Options -> Interpreter -> "MicroPython (ESP32)" y graba el firmware.
  2) Instala el paquete MQTT: Tools -> Manage packages -> "micropython-umqtt.simple"
     (si no aparece, ejecuta en la REPL:  import mip; mip.install("umqtt.simple"))
  3) Sube este archivo y mpu6050.py a la placa.

Conexion (ESP32 -> MPU6050):
  VCC -> 3V3   |   GND -> GND   |   SCL -> GPIO 22   |   SDA -> GPIO 21
  AD0 -> GND (direccion I2C 0x68 en el bus)
"""

import math
import json
import time
import network
import machine

from mpu6050 import MPU6050, G

try:
    from umqtt.simple import MQTTClient
except ImportError:
    print("Falta umqtt.simple. Instalalo (ver cabecera del archivo).")
    raise

# ============================================================
# CONFIGURACION  (personaliza estos valores)
# ============================================================
WIFI_SSID = "TU_RED_WIFI"
WIFI_PASS = "TU_CONTRASENA"

MQTT_HOST = "broker.hivemq.com"
MQTT_PORT = 1883
DEVICE_ID = "adulto-01"

SDA_PIN = 21
SCL_PIN = 22
# 100 kHz es mas estable con cables largos o breadboard que 400 kHz
I2C_FREQ = 100000

# ---- umbrales de la deteccion ----
FREE_FALL_G = 0.45        # gravedad en g por debajo de esto = "caida libre"
FREE_FALL_MS = 250        # tiempo en caida libre para confirmar
IMPACT_G = 2.8            # pico en g que se considera golpe contra el suelo
TILT_DEG = 45             # angulo para confirmar que quedo tendido
SETTLE_MS = 300           # espera tras el impacto antes de medir postura
CANCEL_WINDOW_MS = 10000  # si se levanta en ese tiempo, se cancela
ALERT_COOLDOWN_MS = 30000 # minimo entre alertas
HEARTBEAT_MS = 30000      # cada cuanto publicar estado

# ---- pines opcionales ----
BUZZER_PIN = 27
PANIC_PIN = 33
LED_PIN = 2

# ============================================================
# ESTADOS DE LA MAQUINA
# ============================================================
IDLE, FREE_FALL, IMPACT, SETTLE, CONFIRMED = 0, 1, 2, 3, 4

# ============================================================
# HARDWARE
# ============================================================
i2c = machine.SoftI2C(scl=machine.Pin(SCL_PIN), sda=machine.Pin(SDA_PIN), freq=I2C_FREQ)
mpu = MPU6050(i2c, addr=0x68)

buzzer = machine.Pin(BUZZER_PIN, machine.Pin.OUT)
led = machine.Pin(LED_PIN, machine.Pin.OUT)
panic_btn = machine.Pin(PANIC_PIN, machine.Pin.IN, machine.Pin.PULL_UP)

# ============================================================
# VARIABLES DE ESTADO
# ============================================================
state = IDLE
now_ms = time.ticks_ms
elapsed = lambda start: time.ticks_diff(now_ms(), start)

free_fall_start = now_ms()
free_fall_armed = False
impact_time = now_ms()
settle_start = now_ms()
last_alert_at = 0
last_heartbeat = 0
last_sample = 0
max_impact_g = 0.0
tilt_angle = 0.0
panic_prev = 1

client = None


# ============================================================
# UTILIDADES
# ============================================================
def mag_g(ax, ay, az):
    return math.sqrt(ax * ax + ay * ay + az * az) / G


def angle_from_vertical(ax, ay, az):
    """Angulo en grados respecto a la vertical, usando el vector de gravedad."""
    m = math.sqrt(ax * ax + ay * ay + az * az)
    if m < 0.1:
        return 0.0
    c = az / m
    if c > 1:
        c = 1
    elif c < -1:
        c = -1
    return math.degrees(math.acos(c))


def person_upright(ax, ay, az):
    return (angle_from_vertical(ax, ay, az) < TILT_DEG and mag_g(ax, ay, az) > 0.7)


# ============================================================
# RED + MQTT
# ============================================================
def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print("Conectando a", WIFI_SSID)
        wlan.connect(WIFI_SSID, WIFI_PASS)
        for _ in range(40):
            if wlan.isconnected():
                break
            time.sleep(0.5)
    if not wlan.isconnected():
        raise RuntimeError("No se pudo conectar al WiFi")
    print("WiFi OK:", wlan.ifconfig())
    return wlan


def mqtt_connect():
    global client
    c = MQTTClient(client_id=DEVICE_ID, server=MQTT_HOST, port=MQTT_PORT)
    c.set_callback(mqtt_cb)
    c.connect()
    c.subscribe("vigilmotion/%s/panic" % DEVICE_ID)
    print("MQTT OK en", MQTT_HOST)
    return c


def mqtt_cb(topic, msg):
    print("Mensaje recibido:", topic, msg)
    if topic.endswith(b"/panic"):
        print("Pánico solicitado desde la app")
        send_fall_alert(0.0, 0.0, is_panic=True)


def publish(topic, payload, retain=False):
    try:
        client.publish(topic, payload, retain=retain)
        print("MQTT ->", topic, payload)
    except Exception as e:
        print("Error publicando:", e)


def send_fall_alert(impact_g, tilt_deg, is_panic=False):
    global last_alert_at
    if not is_panic and elapsed(last_alert_at) < ALERT_COOLDOWN_MS:
        print("Alerta omitida (cooldown)")
        return
    last_alert_at = now_ms()
    payload = json.dumps({
        "type": "panic" if is_panic else "fall",
        "device": DEVICE_ID,
        "ts": int(time.time()),
        "impactG": round(impact_g, 1),
        "tiltDeg": round(tilt_deg, 1),
    })
    publish("vigilmotion/%s/fall" % DEVICE_ID, payload)
    for _ in range(8):
        buzzer.value(1)
        time.sleep_ms(100)
        buzzer.value(0)
        time.sleep_ms(150)


# ============================================================
# MAIN
# ============================================================
def read_accel():
    """Lee la aceleración con reintentos: si el contacto falla un instante,
    reinicia el bus I2C en vez de tumbar todo el programa."""
    global i2c, mpu
    for _ in range(3):
        try:
            return mpu.accel_ms2()
        except OSError as e:
            print("Error I2C (%s), reiniciando bus..." % e)
            time.sleep_ms(10)
            try:
                i2c.deinit()
            except Exception:
                pass
            i2c = machine.SoftI2C(scl=machine.Pin(SCL_PIN), sda=machine.Pin(SDA_PIN), freq=I2C_FREQ)
            mpu = MPU6050(i2c, addr=0x68)
    return mpu.accel_ms2()  # si falla de verdad, aquí explota
def main():
    global state, free_fall_start, free_fall_armed, impact_time, settle_start
    global last_heartbeat, last_sample, last_alert_at
    global max_impact_g, tilt_angle, panic_prev, client

    print("WHO_AM_I:", hex(mpu.who_am_i()), "(esperado 0x68)")
    print("I2C scan:", i2c.scan())

    wlan = connect_wifi()
    client = mqtt_connect()

    while True:
        try:
            client.check_msg()
        except Exception as e:
            print("MQTT error:", e)
            try:
                client.disconnect()
            except Exception:
                pass
            time.sleep(2)
            client = mqtt_connect()

        t = now_ms()

        # Heartbeat de estado cada HEARTBEAT_MS
        if elapsed(last_heartbeat) >= HEARTBEAT_MS:
            last_heartbeat = t
            try:
                rssi = wlan.status("rssi")
            except Exception:
                rssi = 0
            publish("vigilmotion/%s/status" % DEVICE_ID, json.dumps({
                "device": DEVICE_ID,
                "ts": int(time.time()),
                "rssi": rssi,
                "state": state,
            }), retain=True)

        # Boton de panico manual
        p = panic_btn.value()
        if p == 0 and panic_prev == 1:
            print("Boton de panico pulsado")
            send_fall_alert(0.0, 0.0, is_panic=True)
        panic_prev = p

        # Muestreo a ~100 Hz (10 ms)
        if elapsed(last_sample) < 10:
            continue
        last_sample = t

        ax, ay, az = read_accel()
        m = mag_g(ax, ay, az)

        if state == IDLE:
            if m < FREE_FALL_G:
                if not free_fall_armed:
                    free_fall_armed = True
                    free_fall_start = t
                if elapsed(free_fall_start) >= FREE_FALL_MS:
                    print("FASE 1: caida libre detectada")
                    state = FREE_FALL
            else:
                free_fall_armed = False

        elif state == FREE_FALL:
            if m > IMPACT_G:
                print("FASE 2: impacto %.2fg" % m)
                max_impact_g = m
                impact_time = t
                state = IMPACT
            elif m > FREE_FALL_G and elapsed(free_fall_start) > FREE_FALL_MS + 1500:
                print("Caida libre sin impacto, descartada")
                state = IDLE
                free_fall_armed = False

        elif state == IMPACT:
            if m > max_impact_g:
                max_impact_g = m
            if elapsed(impact_time) >= SETTLE_MS:
                settle_start = t
                state = SETTLE

        elif state == SETTLE:
            if elapsed(settle_start) < 250:
                continue
            tilt_angle = angle_from_vertical(ax, ay, az)
            print("FASE 3: angulo %.1f grados" % tilt_angle)
            if tilt_angle > TILT_DEG:
                print("FASE 4: persona tendida -> alerta armada")
                state = CONFIRMED
            else:
                print("Sin cambio de postura, descartada")
                state = IDLE
                free_fall_armed = False

        elif state == CONFIRMED:
            if person_upright(ax, ay, az):
                print("Persona se levanto -> alerta cancelada")
                state = IDLE
                free_fall_armed = False
            elif elapsed(impact_time) >= CANCEL_WINDOW_MS:
                print("! CAIDA CONFIRMADA -> ENVIANDO ALERTA !")
                send_fall_alert(max_impact_g, tilt_angle, is_panic=False)
                state = IDLE
                free_fall_armed = False

        # Parpadeo del LED de estado
        led.value(1 if elapsed(t) < 50 else 0)


main()