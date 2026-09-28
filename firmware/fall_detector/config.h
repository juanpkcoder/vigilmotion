#pragma once

// ============================================================
// CONFIGURACIÓN DEL DISPOSITIVO VIGILMOTION (C++ / ESP32)
// ============================================================

// ---- Conectividad WiFi (2.4 GHz) ----
const char* WIFI_SSID = "TU_RED_WIFI";
const char* WIFI_PASS = "TU_PASSWORD";

// ---- Webhook HTTP/HTTPS a la nube (Vercel o Local) ----
// Reemplaza por la URL de tu proyecto en Vercel
const char* WEBHOOK_URL = "https://vigilmotion.vercel.app/api/alerts";

// ---- MQTT (Broker público de respaldo) ----
const char* MQTT_HOST = "broker.hivemq.com";
const int   MQTT_PORT = 1883;
const char* MQTT_USER = "";
const char* MQTT_PASS = "";

// Identificador único de este dispositivo
const char* DEVICE_ID = "adulto-01";

// ---- Tópicos MQTT ----
const char* TOPIC_FALL   = "vigilmotion/adulto-01/fall";
const char* TOPIC_STATUS = "vigilmotion/adulto-01/status";
const char* TOPIC_PANIC  = "vigilmotion/adulto-01/panic";

// ============================================================
// PARÁMETROS CALIBRADOS PARA PRUEBAS Y CAÍDAS REALES
// (Optimizados para laboratorio biomecánico y caídas sobre colchón)
// ============================================================

// Umbral de ingravidez en g (normal = 1.0g, caída libre < 0.48g)
#define FREE_FALL_G       0.48f

// Milisegundos mínimos en caída libre para confirmar (caídas desde 40-70cm)
#define FREE_FALL_MIN_MS  60

// Ventana máxima en ms para esperar el impacto tras la caída libre
#define IMPACT_WINDOW_MS  1200

// Pico mínimo de impacto en g (desaceleración brusca contra el piso/colchón)
#define IMPACT_G          2.20f

// Ángulo mínimo (en grados) respecto al reposo erguido para confirmar persona tendida
#define TILT_DEG          45.0f

// Tiempo de reposo tras el impacto antes de medir la postura (ms)
#define SETTLE_MS         400

// Ventana de inmovilidad post-impacto antes del despacho (2 segundos para pruebas fluidas)
#define CANCEL_WINDOW_MS  2000

// Ángulo para considerar recuperación erguida si la persona se levanta
#define UPRIGHT_RECOVER_DEG 30.0f

// Tiempo de enfriamiento entre alertas consecutivas (ms)
#define ALERT_COOLDOWN_MS 5000

// ---- Pines Hardware (ESP32 DevKit V1) ----
#define BUZZER_PIN 27
#define PANIC_PIN  33
#define LED_PIN    2

// Frecuencia de envío de telemetría de estado (ms)
#define HEARTBEAT_MS 20000