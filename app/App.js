import { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert as RNAlert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import EventSource from 'react-native-sse';
import { API_URL } from './config';

// Notificaciones en primer plano siempre audibles y visibles
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const fmtTime = (ts) => {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    ' (' + new Date(ts * 1000).toLocaleDateString() + ')';
};

const fmtSeen = (ms) => {
  if (!ms) return '—';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  return `hace ${m}m`;
};

const typeLabel = (t) => {
  if (t === 'panic' || t === 'panico_manual') return '🚨 PÁNICO';
  if (t === 'test') return '🧪 PRUEBA';
  return '⚠️ CAÍDA DETECTADA';
};

const typeColor = (t) => {
  if (t === 'test') return '#3b82f6';
  if (t === 'panic' || t === 'panico_manual') return '#dc2626';
  return '#ef4444';
};

export default function App() {
  const [expoToken, setExpoToken] = useState(null);
  const [devices, setDevices] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const es = useRef(null);

  // ---- Configurar canal de notificaciones (Android) y registrar Push Token ----
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('fall-alerts', {
            name: 'Alertas de Caídas VigilMotion',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#ef4444',
            sound: 'fall_alert.wav',
          });
        } catch (e) {
          console.log('Error configurando canal Android:', e.message);
        }
      }

      const { status } = await Notifications.getPermissionsAsync();
      let final = status;
      if (status !== 'granted') {
        const r = await Notifications.requestPermissionsAsync();
        final = r.status;
      }
      if (final !== 'granted') {
        console.warn('Permisos de notificación no otorgados');
        return;
      }

      try {
        const tokenResp = await Notifications.getExpoPushTokenAsync().catch(() => null);
        if (tokenResp && tokenResp.data) {
          setExpoToken(tokenResp.data);
          await fetch(`${API_URL}/api/push-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenResp.data }),
          });
        }
      } catch (err) {
        console.log('Push token local disponible sin EAS:', err.message);
      }
    })();

    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const data = res.notification.request.content.data;
      if (data && data.alertId) {
        setShowDetail(data);
      }
    });
    return () => sub.remove();
  }, []);

  // ---- Carga de datos + Polling + SSE ----
  const loadAll = async () => {
    try {
      const [d, a] = await Promise.all([
        fetch(`${API_URL}/api/devices`).then((r) => r.json()),
        fetch(`${API_URL}/api/alerts`).then((r) => r.json()),
      ]);
      setDevices(d);
      setAlerts(a);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  };

  useEffect(() => {
    loadAll();
    const poll = setInterval(loadAll, 6000);

    try {
      es.current = new EventSource(`${API_URL}/api/events`);
      es.current.addEventListener('fall', (e) => {
        const alert = JSON.parse(e.data);
        setAlerts((prev) => [alert, ...prev.filter((x) => x.id !== alert.id)].slice(0, 200));
        RNAlert.alert(
          typeLabel(alert.type),
          `Dispositivo: ${alert.device}\nImpacto: ${alert.impactG}g | Inclinación: ${alert.tiltDeg}°`
        );
      });
      es.current.addEventListener('status', (e) => {
        const s = JSON.parse(e.data);
        setDevices((prev) => ({ ...prev, [s.device]: { ...prev[s.device], ...s } }));
      });
      es.current.addEventListener('open', () => setConnected(true));
      es.current.addEventListener('error', () => setConnected(false));
    } catch (e) {
      console.warn('SSE no disponible:', e.message);
    }

    return () => {
      clearInterval(poll);
      if (es.current) es.current.close();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const sendTestAlert = async () => {
    try {
      await fetch(`${API_URL}/api/test-alert`, { method: 'POST' });
      RNAlert.alert('Prueba enviada', 'Alerta de prueba despachada correctamente.');
      loadAll();
    } catch {
      RNAlert.alert('Error', `No se pudo conectar con el backend (${API_URL}).`);
    }
  };

  const triggerPanic = async (deviceId = 'adulto-01') => {
    try {
      await fetch(`${API_URL}/api/panic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: deviceId }),
      });
      RNAlert.alert('🚨 PÁNICO ACTIVADO', `Se ha emitido la orden de pánico de emergencia para ${deviceId}.`);
      loadAll();
    } catch {
      RNAlert.alert('Error', 'No se pudo contactar con el backend.');
    }
  };

  const backendColor = connected ? '#22c55e' : '#ef4444';
  const backendText = connected
    ? `Servidor Activo (${Object.keys(devices).length} disp.)`
    : 'Servidor Desconectado';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>VigilMotion</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.dot, { backgroundColor: backendColor }]} />
            <Text style={styles.statusText}>{backendText}</Text>
          </View>
        </View>
        <Text style={styles.tokenHint} numberOfLines={1}>
          API: {API_URL} {expoToken ? '· Push OK' : '· Push local'}
        </Text>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#94a3b8" />
        }
        style={styles.body}>

        {/* Botones de acción rápida */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.panicBtn} onPress={() => triggerPanic('adulto-01')}>
            <Text style={styles.panicBtnText}>🚨 PÁNICO REMOTO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.testBtn} onPress={sendTestAlert}>
            <Text style={styles.testBtnText}>🧪 PROBAR ALERTA</Text>
          </TouchableOpacity>
        </View>

        {/* Sección Dispositivos */}
        <Text style={styles.section}>Dispositivos Vigilados</Text>
        {Object.entries(devices).length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.empty}>
              No hay dispositivos transmitiendo actualmente.
            </Text>
            <Text style={styles.emptySub}>
              Enciende el ESP32 con el sensor MPU6050 configurado en la misma red o broker MQTT.
            </Text>
          </View>
        ) : (
          Object.entries(devices).map(([id, d]) => (
            <View key={id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{id}</Text>
                <View
                  style={[
                    styles.pill,
                    { backgroundColor: (d.rssi || -99) > -80 ? '#166534' : '#854d0e' },
                  ]}>
                  <Text style={styles.pillText}>
                    WiFi: {d.rssi ? `${d.rssi} dBm` : 'Online'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSub}>
                Última señal: {fmtSeen(d.lastSeen)} · Estado: {d.armed ? 'ARMADO' : 'COOLDOWN'}
              </Text>
            </View>
          ))
        )}

        {/* Sección Alertas */}
        <View style={styles.rowBetween}>
          <Text style={styles.section}>Registro de Caídas y Alertas</Text>
          <Text style={styles.countBadge}>{alerts.length} eventos</Text>
        </View>

        {alerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.empty}>Sin caídas detectadas recientemente.</Text>
            <Text style={styles.emptySub}>El sistema está operando en tiempo real.</Text>
          </View>
        ) : (
          alerts.map((a) => (
            <TouchableOpacity key={a.id || String(a.ts) + Math.random()} onPress={() => setShowDetail(a)}>
              <View style={[styles.card, { borderLeftColor: typeColor(a.type), borderLeftWidth: 4 }]}>
                <View style={styles.cardRow}>
                  <View style={[styles.pill, { backgroundColor: typeColor(a.type) }]}>
                    <Text style={styles.pillText}>{typeLabel(a.type)}</Text>
                  </View>
                  <Text style={styles.cardSub}>{fmtTime(a.ts)}</Text>
                </View>
                <Text style={styles.cardTitle}>Dispositivo: {a.device}</Text>
                <View style={styles.metricRow}>
                  <Text style={styles.metricBadge}>
                    Impacto: <Text style={styles.boldWhite}>{a.impactG > 0 ? `${a.impactG}g` : 'N/A'}</Text>
                  </Text>
                  <Text style={styles.metricBadge}>
                    Inclinación: <Text style={styles.boldWhite}>{a.tiltDeg > 0 ? `${a.tiltDeg}°` : 'N/A'}</Text>
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Modal de Detalle */}
        {showDetail && (
          <View style={styles.detail}>
            <Text style={styles.detailTitle}>Detalle del Evento de Emergencia</Text>
            <Text style={styles.detailItem}>ID: {showDetail.id || 'N/A'}</Text>
            <Text style={styles.detailItem}>Dispositivo: {showDetail.device || 'N/A'}</Text>
            <Text style={styles.detailItem}>Evento: {typeLabel(showDetail.type)}</Text>
            <Text style={styles.detailItem}>Impacto: {showDetail.impactG}g</Text>
            <Text style={styles.detailItem}>Inclinación final: {showDetail.tiltDeg}°</Text>
            <Text style={styles.detailItem}>Marca temporal: {fmtTime(showDetail.ts)}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDetail(null)}>
              <Text style={styles.closeBtnText}>Cerrar Detalle</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '800', letterSpacing: 0.5 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  tokenHint: { color: '#64748b', fontSize: 11, marginTop: 4 },
  body: { flex: 1, padding: 16 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  panicBtn: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panicBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  testBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  section: { color: '#f1f5f9', fontSize: 17, fontWeight: '700', marginTop: 8, marginBottom: 10 },
  countBadge: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  emptyCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  empty: { color: '#94a3b8', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  emptySub: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 4 },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  cardSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { color: '#f8fafc', fontSize: 11, fontWeight: '700' },
  metricRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  metricBadge: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
  },
  boldWhite: { color: '#fff', fontWeight: '700' },
  detail: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  detailTitle: { color: '#f8fafc', fontWeight: '800', fontSize: 16, marginBottom: 10 },
  detailItem: { color: '#cbd5e1', fontSize: 13, marginBottom: 5 },
  closeBtn: {
    backgroundColor: '#475569',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});