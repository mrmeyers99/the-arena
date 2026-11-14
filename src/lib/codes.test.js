import { describe, expect, it } from 'vitest';
import { generateAccessCode, generateCode, secureRandom } from './codes';

describe('generateCode', () => {
  it('defaults to 6 characters', () => {
    expect(generateCode()).toHaveLength(6);
  });

  it('honours a custom length', () => {
    expect(generateCode(8)).toHaveLength(8);
    expect(generateCode(0)).toBe('');
  });

  it('only uses uppercase letters and digits', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCode(12)).toMatch(/^[A-Z0-9]{12}$/);
    }
  });

  it('maps the random source onto the character set', () => {
    expect(generateCode(3, () => 0)).toBe('AAA');
    expect(generateCode(3, () => 0.9999)).toBe('999');
    const values = [0, 25 / 36, 26 / 36];
    let i = 0;
    expect(generateCode(3, () => values[i++])).toBe('AZ0');
  });

  it('produces different codes across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateCode(10)));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('generateAccessCode', () => {
  it('produces 8-character codes from the secure random source', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateAccessCode()).toMatch(/^[A-Z0-9]{8}$/);
    }
  });
});

describe('secureRandom', () => {
  it('returns floats in [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const n = secureRandom();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});
