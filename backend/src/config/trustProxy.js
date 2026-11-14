// TRUST_PROXY acepta un número de saltos (0 = ninguno) para que Express sepa
// cuántos proxies de confianza hay delante. true/false se mantienen por
// compatibilidad con configuraciones anteriores (true equivale a 1).
function parseTrustProxy(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  const normalized = String(value).trim().toLowerCase();

  if (['true', 'yes', 'on'].includes(normalized)) return 1;
  if (['false', 'no', 'off'].includes(normalized)) return 0;

  if (!/^\d+$/.test(normalized)) {
    throw new Error('TRUST_PROXY debe ser un número de saltos o true/false');
  }

  return Number(normalized);
}

module.exports = { parseTrustProxy };
