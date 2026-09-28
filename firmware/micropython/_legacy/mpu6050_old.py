"""
MPU6050 - driver mínimo para MicroPython.
Bus común: 80 MHz -> 400 kHz. Sin magnetómetro.

Registros:
  PWR_MGMT_1 (0x6B): si bit6 = 1 duerme; escribimos 0x00 para despertar.
  ACCEL_XOUT_H (0x3B): 6 bytes -> ax, ay, az (16 bits por eje, Big Endian).
  GYRO_XOUT_H (0x43):  6 bytes -> gx, gy, gz.
  ACCEL_CONFIG (0x1C): bits de rango. 0x18 -> +/- 16 g.
  GYRO_CONFIG (0x1B):  0x08 -> +/- 500 °/s.
  CONFIG (0x1A): filtro pasa bajos. 0x05 -> aproximadamente 10 Hz en DLPF.
"""

from machine import Pin, SoftI2C
import time

MPU6050_ADDR = 0x68

PWR_MGMT_1 = 0x6B
ACCEL_XOUT_H = 0x3B
GYRO_XOUT_H = 0x43
ACCEL_CONFIG = 0x1C
GYRO_CONFIG = 0x1B
DLPF_CONFIG = 0x1A

# 1 g en m/s²  (también se usa en main.py)
G = 9.80665


class MPU6050:
    def __init__(self, i2c, addr=MPU6050_ADDR):
        self.i2c = i2c
        self.addr = addr

        # Escala para +/- 16 g: raw 32768 -> 16 g
        self.accel_scale = 16.0 / 32768.0
        # Escala para +/- 500 °/s
        self.gyro_scale = 500.0 / 32768.0

        self._write(PWR_MGMT_1, 0x00)  # despierta el sensor
        time.sleep_ms(100)
        self._write(ACCEL_CONFIG, 0x18)  # rango accelerómetro +/- 16g
        self._write(GYRO_CONFIG, 0x08)   # rango giroscopio +/- 500°/s
        self._write(DLPF_CONFIG, 0x05)   # filtro pasa bajos ~10 Hz

    # ---------- bajo nivel ----------
    def _write(self, reg, val):
        self.i2c.writeto_mem(self.addr, reg, bytes([val]))

    def _read3(self, reg):
        """Lee 6 bytes (3 ejes x 2 bytes) desde `reg` y devuelve enteros."""
        data = self.i2c.readfrom_mem(self.addr, reg, 6)
        return (
            int.from_bytes(data[0:2], "big", True),
            int.from_bytes(data[2:4], "big", True),
            int.from_bytes(data[4:6], "big", True),
        )

    # ---------- alto nivel ----------
    def accel_g(self):
        """Aceleración en unidades de g, con signo. Ej: 0.0, 0.0, 1.0 en reposo."""
        x, y, z = self._read3(ACCEL_XOUT_H)
        return (
            x * self.accel_scale,
            y * self.accel_scale,
            z * self.accel_scale,
        )

    def accel_ms2(self):
        """Aceleración en m/s² (multiplica por g)."""
        x, y, z = self.accel_g()
        return x * G, y * G, z * G

    def gyro_dps(self):
        """Velocidad angular en °/s."""
        x, y, z = self._read3(GYRO_XOUT_H)
        return (
            x * self.gyro_scale,
            y * self.gyro_scale,
            z * self.gyro_scale,
        )

    def who_am_i(self):
        """Devuelve 0x68 si la dirección I2C es la correcta."""
        return self.i2c.readfrom_mem(self.addr, 0x75, 1)[0]