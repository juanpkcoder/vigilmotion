'use client';

import { Users, BookOpen, MapPin, Heart, Cpu, ShieldAlert, CheckCircle2, Award, ArrowUpRight } from 'lucide-react';

export default function AboutUs() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Banner Principal de Presentación */}
      <div className="glass-panel" style={{
        padding: '36px 32px',
        background: 'linear-gradient(135deg, rgba(14, 21, 38, 0.95) 0%, rgba(6, 182, 212, 0.08) 50%, rgba(14, 21, 38, 0.95) 100%)',
        border: '1px solid rgba(6, 182, 212, 0.3)',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          <MapPin size={16} /> Proyecto de Investigación & Teleasistencia — Engativá, Bogotá
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.25, marginBottom: 16 }}>
          Sistema de Telemetría IoT y Detección Autónoma de Caídas en Adultos Mayores
        </h1>
        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 860 }}>
          VigilMotion nació de una investigación orientada a resolver un problema crítico de salud pública urbana en la ciudad de Bogotá: el aislamiento y la vulnerabilidad de las personas mayores ante caídas caseras accidentales.
        </p>

        {/* Ficha de Autores y Docente */}
        <div style={{
          marginTop: 24,
          paddingTop: 20,
          borderTop: '1px solid var(--border-subtle)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Equipo de Investigación
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginTop: 4 }}>
              Mariana Baracaldo Ríos<br />
              Matías Ñañez Realpe<br />
              Julián Andrés Rodríguez Guerrero
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Dirección Académica & Docente
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38bdf8', marginTop: 4 }}>
              Prof. Wilson Hernán Pérez Correa
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Especialidad en IoT y Sistemas Embebidos
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Comunidad Objetivo
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#10b981', marginTop: 4 }}>
              Engativá, Bosa y Suba
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Bogotá D.C., Colombia
            </div>
          </div>
        </div>
      </div>

      {/* La Problemática y Justificación Social */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ef4444', marginBottom: 14 }}>
            <ShieldAlert size={22} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
              El Problema: La Soledad y el Riesgo
            </h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
            En Bogotá, los reportes distritales indican que el <strong>34% de las personas afectadas por accidentes caseros son adultos mayores de 64 años</strong>, y el 11% de estos eventos se asocia directamente a caídas por pisos húmedos, escaleras o tapetes sin fijar.
          </p>
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 10,
            padding: 14,
            fontSize: '0.85rem',
            color: '#fecaca',
            lineHeight: 1.5,
          }}>
            <strong>El peligro invisible:</strong> Entre el <strong>11% y el 16% de los adultos mayores de Bogotá vive en completa soledad</strong> (hogares unipersonales según estudios SABE, SDIS y DANE). Al caerse sin auxilio, pueden pasar horas o días inmovilizados, sufriendo <em>hipotermia, deshidratación, rabdomiólisis o la muerte</em>.
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#10b981', marginBottom: 14 }}>
            <Heart size={22} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
              Los 3 Objetivos del Proyecto
            </h3>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <li style={{ display: 'flex', gap: 10, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ color: '#f8fafc' }}>1. Atención Médica Oportuna:</strong> Reducción drástica del intervalo temporal entre el accidente y la llegada de la asistencia prehospitalaria o de familiares.
              </div>
            </li>
            <li style={{ display: 'flex', gap: 10, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ color: '#f8fafc' }}>2. Inclusión Tecnológica Radical:</strong> Eliminación de pantallas o menús complejos. El dispositivo opera de manera 100% autónoma y no intrusiva en la ropa del paciente.
              </div>
            </li>
            <li style={{ display: 'flex', gap: 10, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ color: '#f8fafc' }}>3. Tranquilidad Familiar Permanente:</strong> Monitoreo continuo para hogares donde los hijos o parientes deben salir a trabajar durante el día.
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Fundamento Biomecánico y Solución Técnica */}
      <div className="glass-panel" style={{ padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#06b6d4', marginBottom: 16 }}>
          <Cpu size={22} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
            Innovación Técnica: Edge Computing & Sensores MPU
          </h3>
        </div>

        <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 18 }}>
          En lugar de enviar terabytes de datos brutos a la nube, el nodo embebido (ESP32) procesa localmente en el borde (<strong>Edge Computing</strong>) las señales inerciales del sensor triaxial MPU6050 mediante una regla de validación de doble filtro:
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>
              Fase 1: Vector de Impacto
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Detección de aceleración vectorial total A_T superior a 2.5g tras una fase de ingravidez (menor a 0.45g) y aceleración angular en el giroscopio.
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>
              Fase 2: Filtro de Postura (15s)
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Verificación ininterrumpida de orientación horizontal (inclinación mayor a 60°). Si la persona se pone de pie antes de 15 segundos, el zumbador cesa y la alerta se cancela evitando falsos positivos.
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ color: '#25D366', fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>
              Fase 3: Despacho a WhatsApp
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Si persiste la inmovilidad, el sistema despacha autónomamente el mensaje de emergencia con los datos biomecánicos y hora a los cuidadores vía WhatsApp y web.
            </div>
          </div>
        </div>

        {/* Pilotos en Engativá */}
        <div style={{
          marginTop: 22,
          paddingTop: 18,
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Award size={18} color="#f59e0b" />
          <span>
            <strong>Validación Comunitaria:</strong> Diseñado para su despliegue piloto en colaboración con las Juntas de Acción Comunal (JAC) y Centros Día de la localidad de Engativá.
          </span>
        </div>
      </div>
    </div>
  );
}
