/*
 * VigilMotion — Detector de caídas de alta precisión para adulto mayor
 * Placa: ESP32 DevKit V1
 * Sensor: MPU6050 (I2C)
 *
 * Librerías necesarias (Arduino IDE):
 *   - Adafruit MPU6050
 *   - Adafruit Unified Sensor
 *   - PubSubClient
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <PubSubClient.h>

#include "config.h"

Adafruit_MPU6050 mpu;
WiFiClient espClient;
PubSubClient mqtt(espClient);

// ---------------- Estado de la detección ----------------
enum FallState {
  STATE_IDLE,
  STATE_FREE_FALL,
  STATE_AWAIT_IMPACT,
  STATE_IMPACT_SETTLE,
  STATE_IMMOBILE
};

FallState state = STATE_IDLE;

unsigned long freeFallStart     = 0;
unsigned long awaitImpactStart  = 0;
unsigned long impactTime        = 0;
unsigned long settleStart       = 0;
unsigned long immobileStart     = 0;
unsigned long lastSample        = 0;
unsigned long lastHeartbeat     = 0;
unsigned long lastAlertAt       = 0;

float maxImpactG    = 0.0f;
float tiltAngle     = 0.0f;
bool  panicPressed  = false;

// Vector de referencia calibrado al inicio (postura erguida)
float refX = 0.0f, refY = 0.0f, refZ = 9.80665f;

const float G = 9.80665f; // 1 g en m/s²

// ---------------- Buzzer no bloqueante ----------------
bool buzzerActive = false;
int buzzerBeepsLeft = 0;
unsigned long nextBuzzerToggle = 0;
bool buzzerPinState = false;

void triggerBuzzerAlarm(int beeps = 8) {
  buzzerActive = true;
  buzzerBeepsLeft = beeps * 2;
  buzzerPinState = true;
  digitalWrite(BUZZER_PIN, HIGH);
  nextBuzzerToggle = millis() + 80;
}

void updateBuzzer() {
  if (!buzzerActive) return;
  if (millis() >= nextBuzzerToggle) {
    buzzerPinState = !buzzerPinState;
    digitalWrite(BUZZER_PIN, buzzerPinState ? HIGH : LOW);
    buzzerBeepsLeft--;
    if (buzzerBeepsLeft <= 0) {
      buzzerActive = false;
      digitalWrite(BUZZER_PIN, LOW);
    } else {
      nextBuzzerToggle = millis() + (buzzerPinState ? 80 : 100);
    }
  }
}

// ---------------- Matemáticas Vectoriales ----------------
static inline float magnitudeG(float x, float y, float z) {
  return sqrt(x * x + y * y + z * z) / G;
}

// Ángulo 3D exacto entre el vector de aceleración actual y la referencia erguida
static float angleFromReference(float ax, float ay, float az) {
  float magA = sqrt(ax * ax + ay * ay + az * az);
  float magR = sqrt(refX * refX + refY * refY + refZ * refZ);
  if (magA < 0.5f || magR < 0.5f) return 0.0f;
  float dot = ax * refX + ay * refY + az * refZ;
  float cosTheta = dot / (magA * magR);
  cosTheta = constrain(cosTheta, -1.0f, 1.0f);
  return degrees(acos(cosTheta));
}

// ---------------- Calibración Dinámica de Postura Erguida ----------------
void calibrateReference() {
  Serial.println("\n[Calibración] Coloca el dispositivo en el cuerpo y permanece erguido...");
  float sumX = 0, sumY = 0, sumZ = 0;
  int count = 0;
  unsigned long start = millis();

  while (millis() - start < 6000 && count < 40) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    float mag = magnitudeG(a.acceleration.x, a.acceleration.y, a.acceleration.z);
    float gyroMag = sqrt(g.gyro.x * g.gyro.x + g.gyro.y * g.gyro.y + g.gyro.z * g.gyro.z);

    if (fabs(mag - 1.0f) < 0.15f && gyroMag < 0.5f) {
      sumX += a.acceleration.x;
      sumY += a.acceleration.y;
      sumZ += a.acceleration.z;
      count++;
    }
    delay(25);
  }

  if (count >= 20) {
    refX = sumX / count;
    refY = sumY / count;
    refZ = sumZ / count;
    Serial.printf("[Calibración OK] Vector referencia: (%.2f, %.2f, %.2f) m/s²\n", refX, refY, refZ);
  } else {
    refX = 0.0f; refY = 0.0f; refZ = G;
    Serial.println("[Aviso] Reposo no detectado. Se asume orientación Z vertical estándar.");
  }
}

// ---------------- MQTT y Red ----------------
static void ensureMqttConnected() {
  if (mqtt.connected()) return;
  if (WiFi.status() != WL_CONNECTED) return;

  Serial.print("Conectando MQTT...");
  if (mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASS)) {
    Serial.println(" CONECTADO");
    mqtt.subscribe(TOPIC_PANIC);
  } else {
    Serial.printf(" Falló (rc=%d)\n", mqtt.state());
  }
}

static void publishJson(const char* topic, const char* payload) {
  if (mqtt.connected()) {
    mqtt.publish(topic, payload);
    Serial.printf("MQTT -> %s: %s\n", topic, payload);
  } else {
    Serial.printf("MQTT no conectado. Payload omitido: %s\n", payload);
  }
}

static void sendWebhookAlert(const char* payload) {
  if (WiFi.status() != WL_CONNECTED || strlen(WEBHOOK_URL) == 0) return;

  Serial.printf("Enviando alerta a Webhook: %s\n", WEBHOOK_URL);
  HTTPClient http;
  if (strncmp(WEBHOOK_URL, "https://", 8) == 0) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure(); // Permite conectar a HTTPS (Vercel) sin cert estático
    if (http.begin(secureClient, WEBHOOK_URL)) {
      http.addHeader("Content-Type", "application/json");
      int code = http.POST(payload);
      Serial.printf("Webhook HTTPS -> Código de respuesta: %d\n", code);
      http.end();
    }
  } else {
    WiFiClient plainClient;
    if (http.begin(plainClient, WEBHOOK_URL)) {
      http.addHeader("Content-Type", "application/json");
      int code = http.POST(payload);
      Serial.printf("Webhook HTTP -> Código de respuesta: %d\n", code);
      http.end();
    }
  }
}

static void sendFallAlert(float impactG, float tiltDeg, bool isPanic) {
  unsigned long now = millis();
  if (!isPanic && (now - lastAlertAt) < ALERT_COOLDOWN_MS) {
    Serial.println("Alerta suprimida por período de cooldown.");
    return;
  }
  lastAlertAt = now;

  char buf[300];
  snprintf(buf, sizeof(buf),
           "{\"type\":\"%s\",\"evento\":\"%s\",\"device\":\"%s\",\"dispositivo\":\"%s\",\"ts\":%lu,\"impactG\":%.2f,\"fuerza_g\":%.2f,\"tiltDeg\":%.1f,\"angulo\":%.1f}",
           isPanic ? "panic" : "fall",
           isPanic ? "panico_manual" : "caida_detectada",
           DEVICE_ID, DEVICE_ID,
           (unsigned long)(now / 1000),
           impactG, impactG, tiltDeg, tiltDeg);

  // 1. Envío por MQTT
  publishJson(TOPIC_FALL, buf);

  // 2. Envío directo por Webhook a Vercel / Cloud
  sendWebhookAlert(buf);

  // 3. Alarma acústica local
  triggerBuzzerAlarm(8);
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String topicStr(topic);
  if (topicStr.endsWith("/panic")) {
    Serial.println("Pánico solicitado remotamente vía MQTT");
    sendFallAlert(0.0f, 0.0f, true);
  }
}

// ---------------- Setup ----------------
void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(PANIC_PIN, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, LOW);

  Wire.begin();
  if (!mpu.begin()) {
    Serial.println("ERROR: No se encontró el MPU6050. Revisa cableado I2C.");
    while (1) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      delay(200);
    }
  }

  mpu.setAccelerometerRange(MPU6050_RANGE_16_G);
  mpu.setGyroRange(MPU6050_RANGE_1000_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_44_HZ); // Filtro óptimo para impacto

  Serial.println("MPU6050 inicializado con éxito.");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Conectando WiFi");
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 10000) {
    delay(400);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(" IP: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println(" Sin conexión WiFi (operación offline).");
  }

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);

  calibrateReference();
  Serial.println("Sistema VigilMotion armado y muestreando a 100 Hz.");
}

// ---------------- Loop Principal ----------------
void loop() {
  updateBuzzer();

  if (WiFi.status() == WL_CONNECTED) {
    ensureMqttConnected();
    mqtt.loop();
  }

  unsigned long now = millis();

  // Telemetría periódica de estado
  if (now - lastHeartbeat >= HEARTBEAT_MS) {
    lastHeartbeat = now;
    char buf[180];
    snprintf(buf, sizeof(buf),
             "{\"device\":\"%s\",\"dispositivo\":\"%s\",\"ts\":%lu,\"rssi\":%d,\"state\":%d}",
             DEVICE_ID, DEVICE_ID, (unsigned long)(now / 1000),
             (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : -99,
             (int)state);
    publishJson(TOPIC_STATUS, buf);
  }

  // Botón de pánico físico
  if (digitalRead(PANIC_PIN) == LOW && !panicPressed) {
    panicPressed = true;
    Serial.println("🚨 ¡BOTÓN DE PÁNICO PULSADO!");
    sendFallAlert(0.0f, 0.0f, true);
  }
  if (digitalRead(PANIC_PIN) == HIGH) panicPressed = false;

  // Comandos Seriales interactivos para pruebas de laboratorio ('t' para caída, 'p' para pánico)
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 't' || c == 'T' || c == 'c' || c == 'C') {
      Serial.println("\n[TEST SERIAL] >> Disparando caída de prueba calibrada (3.2g, 76°)...");
      sendFallAlert(3.20f, 76.0f, false);
    } else if (c == 'p' || c == 'P') {
      Serial.println("\n[TEST SERIAL] >> Disparando botón de pánico de prueba...");
      sendFallAlert(0.0f, 0.0f, true);
    }
  }

  // Muestreo a 100 Hz (10 ms)
  if (now - lastSample < 10) return;
  lastSample = now;

  sensors_event_t a, g, t;
  mpu.getEvent(&a, &g, &t);

  float ax = a.acceleration.x, ay = a.acceleration.y, az = a.acceleration.z;
  float magG = magnitudeG(ax, ay, az);
  float tilt = angleFromReference(ax, ay, az);

  // Máquina de estados de alta precisión
  switch (state) {
    case STATE_IDLE:
      if (magG < FREE_FALL_G) {
        freeFallStart = now;
        state = STATE_FREE_FALL;
        maxImpactG = 0.0f;
        Serial.printf("FASE 1: Caída libre detectada (%.2fg)\n", magG);
      }
      break;

    case STATE_FREE_FALL: {
      unsigned long since = now - freeFallStart;
      if (magG < FREE_FALL_G) {
        if (since > 1500) state = STATE_IDLE; // Descarte por anomalía
      } else {
        if (since >= FREE_FALL_MIN_MS) {
          state = STATE_AWAIT_IMPACT;
          awaitImpactStart = now;
          maxImpactG = magG;
          Serial.printf("FASE 2: Fin de ingravidez (%lums). Esperando impacto...\n", since);
        } else {
          state = STATE_IDLE; // Perturbación breve
        }
      }
      break;
    }

    case STATE_AWAIT_IMPACT:
      if (magG > maxImpactG) maxImpactG = magG;
      if (magG >= IMPACT_G) {
        state = STATE_IMPACT_SETTLE;
        impactTime = now;
        Serial.printf("FASE 2 CONFIRMADA: Impacto %.2fg\n", maxImpactG);
      } else if (now - awaitImpactStart > IMPACT_WINDOW_MS) {
        Serial.println("Ventana agotada sin impacto fuerte -> Descartado.");
        state = STATE_IDLE;
      }
      break;

    case STATE_IMPACT_SETTLE:
      if (magG > maxImpactG) maxImpactG = magG;
      if (now - impactTime >= SETTLE_MS) {
        tiltAngle = tilt;
        Serial.printf("FASE 3: Asentamiento completo. Inclinación: %.1f°\n", tiltAngle);
        if (tiltAngle >= TILT_DEG) {
          state = STATE_IMMOBILE;
          immobileStart = now;
          Serial.println("Postura horizontal verificada. Monitoreando ventana de inmovilidad...");
        } else {
          Serial.println("Persona no quedó horizontal -> Descartado.");
          state = STATE_IDLE;
        }
      }
      break;

    case STATE_IMMOBILE:
      if (tilt < UPRIGHT_RECOVER_DEG) {
        Serial.println("Persona se reincorporó por sí misma -> Alerta cancelada.");
        state = STATE_IDLE;
      } else if (now - immobileStart >= CANCEL_WINDOW_MS) {
        Serial.println("🚨 ¡CAÍDA CONFIRMADA CON ALTA PRECISIÓN! ENVIANDO ALERTA...");
        sendFallAlert(maxImpactG, tiltAngle, false);
        state = STATE_IDLE;
      }
      break;
  }

  // LED de estado: parpadeo suave cuando está armado
  if (state == STATE_IDLE) {
    digitalWrite(LED_PIN, (now % 1000 < 50) ? HIGH : LOW);
  } else {
    digitalWrite(LED_PIN, HIGH);
  }
}