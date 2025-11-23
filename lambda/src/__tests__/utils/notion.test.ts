import { mapEnergyLevel, getTimeOfDay } from '../../utils/notion';

describe('Notion Utils', () => {
  describe('mapEnergyLevel', () => {
    it('should map 1-3 to Low', () => {
      expect(mapEnergyLevel(1)).toBe('Low');
      expect(mapEnergyLevel(2)).toBe('Low');
      expect(mapEnergyLevel(3)).toBe('Low');
    });

    it('should map 4-7 to Medium', () => {
      expect(mapEnergyLevel(4)).toBe('Medium');
      expect(mapEnergyLevel(5)).toBe('Medium');
      expect(mapEnergyLevel(6)).toBe('Medium');
      expect(mapEnergyLevel(7)).toBe('Medium');
    });

    it('should map 8-10 to High', () => {
      expect(mapEnergyLevel(8)).toBe('High');
      expect(mapEnergyLevel(9)).toBe('High');
      expect(mapEnergyLevel(10)).toBe('High');
    });
  });

  describe('getTimeOfDay', () => {
    it('should return Morning for hours 5-11', () => {
      const originalDate = Date;
      global.Date = jest.fn(() => ({
        getHours: () => 8,
      })) as any;

      expect(getTimeOfDay()).toBe('Morning');
      global.Date = originalDate;
    });

    it('should return Afternoon for hours 12-17', () => {
      const originalDate = Date;
      global.Date = jest.fn(() => ({
        getHours: () => 14,
      })) as any;

      expect(getTimeOfDay()).toBe('Afternoon');
      global.Date = originalDate;
    });

    it('should return Evening for hours 18-4', () => {
      const originalDate = Date;
      global.Date = jest.fn(() => ({
        getHours: () => 20,
      })) as any;

      expect(getTimeOfDay()).toBe('Evening');
      global.Date = originalDate;
    });
  });
});

