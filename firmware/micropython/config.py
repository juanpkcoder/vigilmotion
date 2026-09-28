"""
config.py — Configuracion central de VigilMotion (ESP32 + MPU6050).

Edita este archivo para configurar tu red WiFi, tu URL publica de Vercel y parametros de deteccion.
"""

# ============================================================
# 1. CONECTIVIDAD WIFI
# ============================================================
# Cambia por el nombre y clave de tu red WiFi (2.4 GHz requerida por ESP32)
WIFI_SSID = "TU_RED_WIFI"
WIFI_PASS = "TU_PASSWORD"

# ============================================================
# 2. IDENTIDAD DEL DISPOSITIVO
# ============================================================
DEVICE_ID = "adulto-01"         # Identificador unico sin espacios ni tildes

# ============================================================
# 3. ENVIO DE ALERTAS VIA HTTP / HTTPS WEBHOOK (VERCEL O LOCAL)
# ============================================================
# Reemplaza por la URL de tu proyecto desplegado en Vercel (o tu IP local de pruebas)
# Ejemplos:
#   Vercel: "https://tu-proyecto.vercel.app/api/alerts"
#   Local:  "http://192.168.1.50:3000/api/alerts"
WEBHOOK_URL   = "https://vigilmotion.vercel.app/api/alerts"
WEBHOOK_TOKEN = ""              # Opcional (Bearer token de autorizacion si se requiere)
SIMULATE_ONLY = False           # False = envia alertas a la nube. True = solo prueba en consola

# ============================================================
# 4. ENVIO DE ALERTAS Y TELEMETRIA VIA MQTT (BROKER PUBLICO)
# ============================================================
# Canal secundario paralelo para telemetria de baja latencia
MQTT_ENABLED    = True
MQTT_HOST       = "broker.hivemq.com"
MQTT_PORT       = 1883
MQTT_USER       = ""
MQTT_PASS       = ""
MQTT_TOPIC_FALL   = "vigilmotion/%s/fall"     # %s -> DEVICE_ID
MQTT_TOPIC_STATUS = "vigilmotion/%s/status"   # %s -> DEVICE_ID

# ============================================================
# 5. PINES DE HARDWARE (ESP32 DevKit V1)
# ============================================================
I2C_SCL_PIN     = 22            # GPIO 22 -> SCL del MPU6050
I2C_SDA_PIN     = 21            # GPIO 21 -> SDA del MPU6050
I2C_FREQ        = 400_000       # 400 kHz (Fast Mode I2C)
MPU6050_ADDRESS = 0x68          # 0x68 si AD0 a GND, 0x69 si AD0 a 3V3

BUZZER_PIN      = 27            # GPIO 27 -> Alarma sonora local (-1 para desactivar)
PANIC_PIN       = 33            # GPIO 33 -> Boton de panico con pull-up a GND (-1 para desactivar)
LED_PIN         = 2             # GPIO 2  -> LED integrado de estado (-1 para desactivar)

# ============================================================
# 6. PARAMETROS DE ALTA PRECISION PARA PRUEBAS Y CAIDAS REALES
#    (Optimizados para laboratorio biomecanico en Bogota y caidas sobre colchon/piso)
# ============================================================

# --- Fase 1: Caida libre (perdida de sustentacion) ---
# Aceleracion total por debajo de este valor (en g) indica caida libre
FREE_FALL_G      = 0.48
# Duracion minima en caida libre para confirmar (ms). Calibrado para caidas desde 40-70 cm
FREE_FALL_MIN_MS = 60
# Ventana maxima (s) para que ocurra el impacto tras iniciar la caida libre
IMPACT_WINDOW_S  = 1.2

# --- Fase 2: Impacto contra el suelo ---
# Pico minimo de impacto en g (desaceleracion brusca).
# En caidas reales sobre colchon o alfombra varia entre 2.2g y 3.5g; actividades cotidianas < 1.4g
IMPACT_G         = 2.20

# --- Fase 3: Postura e Inclinacion ---
# Tiempo de reposo (s) tras el impacto antes de medir la postura final
SETTLE_S         = 0.4
# Cambio minimo de inclinacion respecto al reposo erguido (en grados).
# Persona erguida de pie/sentada: 0°-25°; persona tendida en el piso: >= 45°
TILT_DELTA_DEG   = 45.0

# --- Fase 4: Ventana de inmovilidad y recuperacion ---
# Tiempo (s) de observacion post-impacto para evaluar si la persona no se levanta
IMMOBILE_WINDOW_S = 2.0
# Umbral de movimiento activo en giroscopio (grados/s)
GYRO_ACTIVE_DPS  = 35.0
# Varianza maxima del giroscopio durante la inmovilidad
GYRO_VAR_MAX     = 60.0
# Angulo maximo considerado "erguido" si la persona se pone de pie por si misma
UPRIGHT_RECOVER_DEG = 30.0

# --- Rearmado y Debounce ---
# Tiempo de postura erguida y quieta para rearmar tras una alerta (ms)
REARM_MS         = 1500
# Cooldown minimo entre alertas sucesivas para pruebas fluidas de laboratorio (segundos)
ALERT_COOLDOWN_S = 5

# Telemetria periodica de estado enviada a la nube (segundos)
HEARTBEAT_S      = 20

# ============================================================
# 7. MUESTREO Y MODO PRUEBAS
# ============================================================
SAMPLE_PERIOD_MS = 10           # 10 ms = 100 Hz exactos
DEBUG            = True         # Muestra telemetria detallada en consola serial
ENABLE_SERIAL_TEST = True       # Permite enviar 't' (test caida) o 'p' (panico) por consola serial