"""
mpu6050.py — Driver de produccion del MPU6050 para MicroPython (ESP32).

Lee acelerometro (en g) y giroscopio (en grados/s) por I2C a 400 kHz.

Uso rapido:
    from mpu6050 import MPU6050
    mpu = MPU6050(scl=22, sda=21, freq=400_000)
    ax, ay, az = mpu.accel()   # aceleracion en g
    gx, gy, gz = mpu.gyro()    # velocidad angular en grados/s

Sin magnetometro. No necesita librerias externas.
"""

from machine import Pin, I2C

# ---- direcciones y registros del MPU6050 -------------------------
MPU6050_ADDR   = 0x68
MPU6050_ADDR_ALT = 0x69

REG_PWR_MGMT_1   = 0x6B   # control de voltaje / sleep / reset
REG_SMPLRT_DIV   = 0x19   # divisor de la tasa de muestreo
REG_CONFIG       = 0x1A   # filtro pasa bajos (DLPF) del sensor
REG_GYRO_CONFIG  = 0x1B   # rango del giroscopio
REG_ACCEL_CONFIG = 0x1C   # rango del acelerometro
REG_ACCEL_XOUT_H = 0x3B   # primer registro de datos del acelerometro
REG_TEMP_OUT_H   = 0x41   # temperatura
REG_GYRO_XOUT_H  = 0x43   # primer registro de datos del giroscopio
REG_WHO_AM_I     = 0x75   # identificador del chip (debe leer 0x68)

# registro (rango_g) -> (bits para el registro, LSB por g)
ACCEL_RANGES = {
    2:  (0x00, 16384.0),
    4:  (0x08,  8192.0),
    8:  (0x10,  4096.0),
    16: (0x18,  2048.0),
}

# registro (rango_dps) -> (bits para el registro, LSB por (grados/s))
GYRO_RANGES = {
    250:  (0x00, 131.0),
    500:  (0x08,  65.5),
    1000: (0x10,  32.8),
    2000: (0x18,  16.4),
}

# DLPF: frecuencia de corte aprox (Hz) -> valor del registro 0x1A
DLPF_HZ = {
    260: 0, 184: 1, 94: 2,
    44: 3, 21: 4, 10: 5, 5: 6,
}


def _twos16(u):
    """Convierte un entero sin signo de 16 bits a complemento a 2 (con signo)."""
    return u - 65536 if u & 0x8000 else u


class MPU6050:
    def __init__(self, scl, sda, freq=400_000, addr=MPU6050_ADDR):
        self.addr = addr
        # Bus I2C hardware del ESP32 (0) a la frecuencia configurada.
        self._i2c = I2C(0, scl=Pin(scl), sda=Pin(sda), freq=freq)

        # Sensibilidad usada para escalar los valores crudos.
        # Se actualiza con set_accel_range() / set_gyro_range().
        self.accel_sens = 2048.0   # +/-16g por defecto
        self.gyro_sens  = 65.5     # +/-500 dps por defecto

        if not self._detect():
            raise OSError("MPU6050 no detectado: revisa SDA/SCL y alimentacion")

        # Poner el chip en un estado conocido y configurarlo.
        self.reset()
        self.wake()
        self.set_sample_rate_div(0)   # tasa = 1 kHz interna / (1 + 0)
        self.set_dlpf(44)             # filtro pasa bajos ~44 Hz (optimo para impacto)
        self.set_accel_range(16)      # +/- 16 g
        self.set_gyro_range(1000)     # +/- 1000 grados/s para capturar giros rapidos

    # ------------------------------------------------------------
    # Bajo nivel
    # ------------------------------------------------------------
    def _reg8(self, reg, addr=None):
        return self._i2c.readfrom_mem(addr or self.addr, reg, 1)[0]

    def _write(self, reg, val, addr=None):
        self._i2c.writeto_mem(addr or self.addr, reg, bytes([val & 0xFF]))

    def _read_3x16(self, start_reg):
        """Lee 6 bytes desde `start_reg` y devuelve (x, y, z) con signo."""
        data = self._i2c.readfrom_mem(self.addr, start_reg, 6)
        return (
            _twos16((data[0] << 8) | data[1]),
            _twos16((data[2] << 8) | data[3]),
            _twos16((data[4] << 8) | data[5]),
        )

    def _detect(self):
        """Busca el chip probando las dos direcciones típicas (0x68 / 0x69)."""
        for a in (MPU6050_ADDR, MPU6050_ADDR_ALT):
            try:
                who = self._reg8(REG_WHO_AM_I, addr=a)
            except OSError:
                continue
            if (who >> 1) == 0x34:      # upper 7 bits = 0x34
                self.addr = a
                return True
        return False

    # ------------------------------------------------------------
    # Control del sensor
    # ------------------------------------------------------------
    def who_am_i(self):
        """Identificador del chip (0x68 si la direccion es correcta)."""
        return self._reg8(REG_WHO_AM_I)

    def reset(self):
        """Reset por registro: detiene la configuracion y apaga el sensor."""
        self._write(REG_PWR_MGMT_1, 0x80)
        self.wake()

    def sleep(self):
        self._write(REG_PWR_MGMT_1, 0x40)   # bit SLEEP

    def wake(self):
        self._write(REG_PWR_MGMT_1, 0x00)   # clear SLEEP, reloj interno

    def set_sample_rate_div(self, div):
        self._write(REG_SMPLRT_DIV, div & 0x7F)

    def set_dlpf(self, hz):
        """Filtro pasa bajos. Corte aproximado en Hz (ver DLPF_HZ)."""
        if hz not in DLPF_HZ:
            hz = 10
        self._write(REG_CONFIG, DLPF_HZ[hz])
        self._dlpf_hz = hz

    def set_accel_range(self, g):
        bits, sens = ACCEL_RANGES[g]
        self._write(REG_ACCEL_CONFIG, bits)
        self.accel_sens = sens

    def set_gyro_range(self, dps):
        bits, sens = GYRO_RANGES[dps]
        self._write(REG_GYRO_CONFIG, bits)
        self.gyro_sens = sens

    # ------------------------------------------------------------
    # Lecturas de alto nivel
    # ------------------------------------------------------------
    def accel_raw(self):
        """Aceleracion cruda (enteros LSB) en (x, y, z)."""
        return self._read_3x16(REG_ACCEL_XOUT_H)

    def gyro_raw(self):
        """Giro crudo (enteros LSB) en (x, y, z)."""
        return self._read_3x16(REG_GYRO_XOUT_H)

    def accel(self):
        """Aceleracion en unidades de g: (ax, ay, az). 1g = 9.8 m/s^2."""
        x, y, z = self.accel_raw()
        return x / self.accel_sens, y / self.accel_sens, z / self.accel_sens

    def gyro(self):
        """Velocidad angular en grados/s: (gx, gy, gz)."""
        x, y, z = self.gyro_raw()
        return x / self.gyro_sens, y / self.gyro_sens, z / self.gyro_sens

    def temp(self):
        """Temperatura en grados Celsius."""
        raw = self._read_3x16(REG_TEMP_OUT_H)[0]
        return raw / 340.0 + 36.53