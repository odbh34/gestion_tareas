// Reglas compartidas por el formulario de registro. El backend aplica las
// mismas comprobaciones con Zod; esto solo da feedback inmediato al usuario.

const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '\u2019.-][\p{L}\p{M}]+)*$/u;
const EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  'qwerty123',
  'admin1234',
  'letmein123',
  'welcome123',
]);
const SEQUENCES = [
  '1234567890',
  'abcdefghij',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

export function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

export function validateName(value) {
  const name = normalizeName(value);

  if (name.length < 2 || name.length > 80) {
    return 'El nombre debe tener entre 2 y 80 caracteres';
  }
  if (!NAME_PATTERN.test(name)) {
    return 'Usa solo letras, espacios, guiones, apóstrofos y puntos';
  }
  if ([...name].filter((char) => /\p{L}/u.test(char)).length < 2) {
    return 'El nombre debe incluir al menos dos letras';
  }
  return '';
}

export function validateEmail(value) {
  const email = normalizeEmail(value);

  if (!email) return 'Escribe tu correo electrónico';
  if (email.length > 120) return 'El correo no puede superar los 120 caracteres';
  if (!EMAIL_PATTERN.test(email) || email.includes('..')) {
    return 'Escribe un correo con formato válido, por ejemplo ana@ejemplo.com';
  }

  const [local, domain] = email.split('@');
  if (!local || local.startsWith('.') || local.endsWith('.')) {
    return 'El correo tiene un formato inválido antes de la @';
  }
  if (!/^[a-z]{2,}$/.test(domain.split('.').pop())) {
    return 'El dominio del correo no es válido';
  }
  return '';
}

function containsPersonalData(password, name, email) {
  const tokens = [];
  const local = normalizeEmail(email).split('@')[0] || '';

  if (local.length >= 4) tokens.push(local);
  normalizeName(name)
    .split(/[ '\u2019.-]+/)
    .forEach((part) => {
      if (part.length >= 4) tokens.push(part);
    });

  const lower = password.toLowerCase();
  return tokens.some((token) => lower.includes(token.toLowerCase()));
}

export function validatePassword(value, { name = '', email = '' } = {}) {
  const password = String(value ?? '');

  if ([...password].length < 10) {
    return 'La contraseña debe tener al menos 10 caracteres';
  }
  if (byteLength(password) > 72) {
    return 'La contraseña es demasiado larga';
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return 'Incluye mayúsculas y minúsculas';
  }
  if (!/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'Incluye un número y un símbolo';
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'Elige una contraseña menos común';
  }
  if (containsPersonalData(password, name, email)) {
    return 'No incluyas tu nombre ni tu correo en la contraseña';
  }
  if (SEQUENCES.some((sequence) => password.toLowerCase() === sequence)) {
    return 'Evita secuencias simples como 1234567890';
  }
  return '';
}

export function passwordChecks(value, { name = '', email = '' } = {}) {
  const password = String(value ?? '');

  return [
    {
      label: 'Entre 10 y 72 caracteres',
      ok: [...password].length >= 10 && byteLength(password) <= 72,
    },
    {
      label: 'Mayúscula y minúscula',
      ok: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    {
      label: 'Número y símbolo',
      ok: /\d/.test(password) && /[^A-Za-z0-9]/.test(password),
    },
    {
      label: 'No es una contraseña común',
      ok: !COMMON_PASSWORDS.has(password.toLowerCase()),
    },
    {
      label: 'No incluye tu nombre ni tu correo',
      ok: !containsPersonalData(password, name, email),
    },
  ];
}
