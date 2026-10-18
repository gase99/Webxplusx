import { describe, it, expect } from 'vitest';
import {
  calculateDoorWidth,
  calculateDoorCount,
  calculateBaseCabinet,
  calculateWallCabinet,
  calculateDrawer,
} from '../src/engine/cabinet';

describe('Door Width Calculation', () => {
  it('calculates single door width for narrow cabinets (10-50cm)', () => {
    expect(calculateDoorWidth(40)).toBe(39.8); // 40 - 0.2
    expect(calculateDoorWidth(10)).toBe(9.8);
    expect(calculateDoorWidth(50)).toBe(49.8);
  });

  it('calculates double door width for medium cabinets (51-100cm)', () => {
    expect(calculateDoorWidth(80)).toBe(39.8); // 80/2 - 0.2
    expect(calculateDoorWidth(100)).toBe(49.8);
  });

  it('calculates triple door width for wide cabinets (101-150cm)', () => {
    expect(calculateDoorWidth(120)).toBeCloseTo(39.8, 1); // 120/3 - 0.2
    expect(calculateDoorWidth(150)).toBeCloseTo(49.8, 1);
  });

  it('returns null for invalid widths', () => {
    expect(calculateDoorWidth(5)).toBeNull();
    expect(calculateDoorWidth(160)).toBeNull();
  });
});

describe('Door Count Calculation', () => {
  it('returns 1 door for narrow cabinets (10-50cm)', () => {
    expect(calculateDoorCount(40)).toBe(1);
    expect(calculateDoorCount(10)).toBe(1);
    expect(calculateDoorCount(50)).toBe(1);
  });

  it('returns 2 doors for medium cabinets (51-100cm)', () => {
    expect(calculateDoorCount(80)).toBe(2);
    expect(calculateDoorCount(51)).toBe(2);
    expect(calculateDoorCount(100)).toBe(2);
  });

  it('returns 3 doors for wide cabinets (101-150cm)', () => {
    expect(calculateDoorCount(120)).toBe(3);
    expect(calculateDoorCount(150)).toBe(3);
  });

  it('returns null for invalid widths', () => {
    expect(calculateDoorCount(5)).toBeNull();
    expect(calculateDoorCount(160)).toBeNull();
  });
});

describe('Base Cabinet Calculation', () => {
  it('calculates components for 80cm wide cabinet (Excel example)', () => {
    const cabinet = calculateBaseCabinet('test-1', 'Test Cabinet', 80, 58, 73.4);
    
    expect(cabinet.type).toBe('base');
    expect(cabinet.width).toBe(80);
    expect(cabinet.depth).toBe(58);
    expect(cabinet.height).toBe(73.4);
    
    // Floor
    expect(cabinet.components.floor.width).toBe(80);
    expect(cabinet.components.floor.height).toBe(58);
    expect(cabinet.components.floor.quantity).toBe(1);
    
    // Back panel
    expect(cabinet.components.back.width).toBe(76.8); // 80 - 3.2
    expect(cabinet.components.back.height).toBe(73.4);
    expect(cabinet.components.back.quantity).toBe(1);
    
    // Body (sides)
    expect(cabinet.components.body).toHaveLength(2);
    expect(cabinet.components.body[0].width).toBe(58);
    expect(cabinet.components.body[0].height).toBe(73.4);
    
    // Shelf
    expect(cabinet.components.shelf.width).toBe(76.8); // 80 - 3.2
    expect(cabinet.components.shelf.height).toBe(55); // 58 - 3
    
    // 3mm strips
    expect(cabinet.components.strip3mm).toHaveLength(2);
    expect(cabinet.components.strip3mm[0].width).toBe(78.4); // 80 - 1.6
    expect(cabinet.components.strip3mm[0].height).toBe(74.2); // 73.4 + 1.6 - 0.8
    
    // Doors (80cm = 2 doors)
    expect(cabinet.components.door).toHaveLength(2);
    expect(cabinet.components.door[0].width).toBe(39.8); // 80/2 - 0.2
    expect(cabinet.components.door[0].height).toBe(73.4);
  });

  it('calculates components for 100cm wide cabinet (Excel example)', () => {
    const cabinet = calculateBaseCabinet('test-2', 'Test Cabinet', 100, 58, 73.4);
    
    expect(cabinet.components.door).toHaveLength(2); // 51-100 = 2 doors
    expect(cabinet.components.door[0].width).toBe(49.8); // 100/2 - 0.2
  });
});

describe('Wall Cabinet Calculation', () => {
  it('calculates components for 60cm wide cabinet (Excel example)', () => {
    const cabinet = calculateWallCabinet('test-3', 'Test Wall', 60, 35, 90);
    
    expect(cabinet.type).toBe('wall');
    expect(cabinet.width).toBe(60);
    expect(cabinet.depth).toBe(35);
    expect(cabinet.height).toBe(90);
    
    // Body (sides)
    expect(cabinet.components.body).toHaveLength(2);
    expect(cabinet.components.body[0].width).toBe(35);
    expect(cabinet.components.body[0].height).toBe(90);
    
    // Floor
    expect(cabinet.components.floor.width).toBe(56.8); // 60 - 3.2
    expect(cabinet.components.floor.height).toBe(35);
    
    // Top
    expect(cabinet.components.top.width).toBe(33); // 35 - 2
    expect(cabinet.components.top.height).toBe(56.8); // 60 - 3.2
    
    // Shelf
    expect(cabinet.components.shelf.width).toBe(56.8); // 60 - 3.2
    expect(cabinet.components.shelf.height).toBe(32); // 35 - 3
    
    // 3mm strips
    expect(cabinet.components.strip3mm).toHaveLength(2);
    expect(cabinet.components.strip3mm[0].width).toBe(58.4); // 56.8 + 1.6
    expect(cabinet.components.strip3mm[0].height).toBe(89.2); // 90 - 0.8
    
    // Doors (60cm = 2 doors)
    expect(cabinet.components.door).toHaveLength(2);
    expect(cabinet.components.door[0].width).toBe(29.8); // 60/2 - 0.2
    expect(cabinet.components.door[0].height).toBe(92); // Fixed for wall cabinets
  });
});

describe('Drawer Calculation', () => {
  it('calculates drawer components (Excel example)', () => {
    const drawer = calculateDrawer('test-4', 'Test Drawer', 50, 90, 50, 1);
    
    expect(drawer.type).toBe('drawer');
    expect(drawer.depth).toBe(50);
    expect(drawer.width).toBe(90);
    expect(drawer.height).toBe(50);
    expect(drawer.quantity).toBe(1);
    
    // Sides: length = 50 - 5 = 45, height = 50/3 - 4 ≈ 12.67
    expect(drawer.components.side).toHaveLength(2); // 1 * 2
    expect(drawer.components.side[0].width).toBe(45);
    expect(drawer.components.side[0].height).toBeCloseTo(12.67, 1);
    
    // Front: length = 90 - 9.1 = 80.9, height = 50/3 - 4 ≈ 12.67
    expect(drawer.components.front).toHaveLength(1);
    expect(drawer.components.front[0].width).toBe(80.9);
    expect(drawer.components.front[0].height).toBeCloseTo(12.67, 1);
    
    // Back: length = 90 - 9.1 = 80.9, height = 50/3 - 4 - 2 ≈ 10.67
    expect(drawer.components.back).toHaveLength(1);
    expect(drawer.components.back[0].width).toBe(80.9);
    expect(drawer.components.back[0].height).toBeCloseTo(10.67, 1);
  });
});
