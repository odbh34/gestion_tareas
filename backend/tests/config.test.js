const { parseTrustProxy } = require('../src/config/trustProxy');

describe('Parseo de TRUST_PROXY', () => {
  it('interpreta números de saltos y mantiene true/false por compatibilidad', () => {
    expect(parseTrustProxy('0')).toBe(0);
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy(3)).toBe(3);
    expect(parseTrustProxy('true')).toBe(1);
    expect(parseTrustProxy('false')).toBe(0);
    expect(parseTrustProxy(true)).toBe(1);
    expect(parseTrustProxy(false)).toBe(0);
    expect(parseTrustProxy(undefined, 0)).toBe(0);
    expect(parseTrustProxy('', 1)).toBe(1);
  });

  it('rechaza valores que no son un número de saltos', () => {
    expect(() => parseTrustProxy('dos')).toThrow();
    expect(() => parseTrustProxy('1.5')).toThrow();
    expect(() => parseTrustProxy('-1')).toThrow();
  });
});
