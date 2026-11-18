// Reglas compartidas por el alta y la edición de usuarios del panel admin.
// El backend aplica las mismas reglas en users.schemas.js para evitar bypass
// de la API.

const NAME_PATTERN = /^[\p{L}][\p{L}\p{M} '\u2019-]*$/u;

const EMAIL_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

// TLDs reales habituales. Rechaza dominios inventados como ejemplo@correo.correo.
const ALLOWED_TLDS = new Set([
  'ai', 'app', 'ar', 'at', 'au', 'be', 'biz', 'blog', 'br', 'ca', 'ch',
  'cl', 'cloud', 'cn', 'co', 'com', 'dev', 'de', 'dk', 'edu', 'es', 'eu',
  'fi', 'fr', 'gov', 'info', 'int', 'io', 'it', 'jp', 'kr', 'me', 'mil',
  'mx', 'net', 'nl', 'no', 'online', 'org', 'pe', 'pl', 'pt', 'se', 'site',
  'store', 'tech', 'tv', 'uk', 'us', 'xyz', 'za',
]);

export const NAME_ERROR =
  'Usa solo letras, espacios, apóstrofos o guiones (entre 2 y 80 caracteres).';
export const EMAIL_ERROR =
  'Introduce un correo válido con un dominio real (por ejemplo, nombre@empresa.com).';
export const PASSWORD_ERROR =
  'La contraseña debe cumplir todos los requisitos indicados.';

export function utf8ByteLength(value) {
  return new TextEncoder().encode(value).length;
}

export function getDomain(email) {
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
}

export function validateName(name) {
  const value = typeof name === 'string' ? name.trim() : '';

  if (value.length < 2 || value.length > 80 || !NAME_PATTERN.test(value)) {
    return NAME_ERROR;
  }

  return '';
}

export function validateEmail(email) {
  const value = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (value.length > 120 || !EMAIL_PATTERN.test(value)) {
    return EMAIL_ERROR;
  }

  const domain = getDomain(value);
  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  if (!ALLOWED_TLDS.has(tld)) {
    return EMAIL_ERROR;
  }

  return '';
}

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: 'Entre 10 y 72 caracteres',
    test: (value) => [...value].length >= 10 && utf8ByteLength(value) <= 72,
  },
  {
    id: 'uppercase',
    label: 'Al menos una letra mayúscula',
    test: (value) => /\p{Lu}/u.test(value),
  },
  {
    id: 'lowercase',
    label: 'Al menos una letra minúscula',
    test: (value) => /\p{Ll}/u.test(value),
  },
  {
    id: 'number',
    label: 'Al menos un número',
    test: (value) => /\d/.test(value),
  },
  {
    id: 'symbol',
    label: 'Al menos un símbolo (por ejemplo, ! ? . -)',
    test: (value) => /[^\p{L}\p{N}\s]/u.test(value),
  },
];

export function validatePassword(password) {
  const value = typeof password === 'string' ? password : '';

  if (!PASSWORD_RULES.every((rule) => rule.test(value))) {
    return PASSWORD_ERROR;
  }

  return '';
}

// `password` es opcional: la edición administrativa no permite cambiarla.
export function validateUserFields({ name, email, password } = {}) {
  const errors = {};

  const nameError = validateName(name);
  if (nameError) errors.name = nameError;

  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  if (password !== undefined) {
    const passwordError = validatePassword(password);
    if (passwordError) errors.password = passwordError;
  }

  return errors;
}
