import { describe, expect, it } from 'vitest';
import {
  byteLength,
  normalizeName,
  validateEmail,
  validateName,
  validatePassword,
} from './validation';

describe('validación del registro', () => {
  it('normaliza y acepta nombres con acentos y apóstrofos', () => {
    expect(normalizeName('  Ana   Pérez  ')).toBe('Ana Pérez');
    expect(validateName('Ana Pérez')).toBe('');
    expect(validateName("Jean-Luc O'Brien")).toBe('');
  });

  it('rechaza nombres con etiquetas o dígitos', () => {
    expect(validateName('<script>alert(1)</script>')).not.toBe('');
    expect(validateName('Ana123')).not.toBe('');
    expect(validateName('---')).not.toBe('');
  });

  it('acepta texto@texto.text como formato, pero no dominios mal formados', () => {
    expect(validateEmail('texto@texto.text')).toBe('');
    expect(validateEmail('ana@ejemplo..com')).not.toBe('');
    expect(validateEmail('ana@-ejemplo.com')).not.toBe('');
  });

  it('acepta la contraseña usada por los usuarios demo y de pruebas', () => {
    expect(validatePassword('Demo12345!')).toBe('');
    expect(validatePassword('Password123!')).toBe('');
    expect(validatePassword('NuevaClave123!')).toBe('');
  });

  it('rechaza contraseñas comunes, personales y secuencias', () => {
    expect(validatePassword('password')).not.toBe('');
    expect(validatePassword('1234567890')).not.toBe('');
    expect(
      validatePassword('AnaPérez123!', { name: 'Ana Pérez', email: 'ana@ejemplo.com' }),
    ).not.toBe('');
    expect(validatePassword('ejemplo123A!', { email: 'ejemplo@correo.com' })).not.toBe('');
  });

  it('mide los bytes UTF-8, no los caracteres UTF-16', () => {
    expect(byteLength('😀'.repeat(20))).toBe(80);
    expect(validatePassword('😀'.repeat(20))).not.toBe('');
  });
});
