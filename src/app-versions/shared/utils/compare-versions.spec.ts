import { compareVersions, isValidAppVersion } from './compare-versions';

describe('compareVersions', () => {
  it.each([
    ['1.2.0', '1.10.0', -1],
    ['1.10.0', '1.9.9', 1],
    ['2.0.0', '1.99.99', 1],
    ['1.0', '1.0.0', 0],
    ['1', '1.0.0', 0],
    ['1.4.2+37', '1.4.2+12', 0],
    ['1.4.2+37', '1.4.3', -1],
  ])('compares %s with %s', (a, b, expected) => {
    expect(Math.sign(compareVersions(a, b))).toBe(expected);
  });

  it('throws on an invalid version', () => {
    expect(() => compareVersions('1.0.0-beta', '1.0.0')).toThrow();
    expect(() => compareVersions('', '1.0.0')).toThrow();
  });
});

describe('isValidAppVersion', () => {
  it.each(['1', '1.2', '1.2.3', '10.0.1+204'])('accepts %s', (v) => {
    expect(isValidAppVersion(v)).toBe(true);
  });

  it.each(['', 'v1.2.3', '1.2.3.4', '1..2', '1.2.3-beta', 'abc', 12])(
    'rejects %s',
    (v) => {
      expect(isValidAppVersion(v)).toBe(false);
    },
  );
});
