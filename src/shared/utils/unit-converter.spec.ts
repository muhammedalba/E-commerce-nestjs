import { UnitConverter } from './unit-converter.util';

describe('UnitConverter', () => {
  describe('Weight Conversion to Grams', () => {
    it('should convert 1kg to 1000g', () => {
      expect(UnitConverter.toGrams(1, 'kg')).toBe(1000);
    });

    it('should convert 20kg to 20000g', () => {
      expect(UnitConverter.toGrams(20, 'kg')).toBe(20000);
    });

    it('should convert 500g to 500g', () => {
      expect(UnitConverter.toGrams(500, 'g')).toBe(500);
    });

    it('should convert 2.5lb to grams correctly', () => {
      expect(UnitConverter.toGrams(2.5, 'lb')).toBeCloseTo(1133.98, 1);
    });

    it('should convert 10oz to grams correctly', () => {
      expect(UnitConverter.toGrams(10, 'oz')).toBeCloseTo(283.495, 1);
    });

    it('should throw for unsupported weight unit', () => {
      expect(() => UnitConverter.toGrams(10, 'ton')).toThrow(
        'Unsupported weight unit: "ton"',
      );
    });
  });

  describe('Grams to Kilograms', () => {
    it('should convert 11000g to 11kg', () => {
      expect(UnitConverter.gramsToKg(11000)).toBe(11);
    });

    it('should convert 3500g to 3.5kg', () => {
      expect(UnitConverter.gramsToKg(3500)).toBe(3.5);
    });

    it('should handle 0 grams', () => {
      expect(UnitConverter.gramsToKg(0)).toBe(0);
    });
  });

  describe('Dimension Conversion to Millimeters', () => {
    it('should convert 10mm to 10mm', () => {
      expect(UnitConverter.toMillimeters(10, 'mm')).toBe(10);
    });

    it('should convert 50cm to 500mm', () => {
      expect(UnitConverter.toMillimeters(50, 'cm')).toBe(500);
    });

    it('should convert 1.2m to 1200mm', () => {
      expect(UnitConverter.toMillimeters(1.2, 'm')).toBe(1200);
    });

    it('should convert 5in to 127mm', () => {
      expect(UnitConverter.toMillimeters(5, 'in')).toBe(127);
    });

    it('should throw for unsupported dimension unit', () => {
      expect(() => UnitConverter.toMillimeters(10, 'yard')).toThrow(
        'Unsupported dimension unit: "yard"',
      );
    });
  });
});
