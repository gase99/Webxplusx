import { describe, it, expect } from 'vitest';
import { optimizeCutList, validateOptimization } from '../src/engine/optimization';
import type { CutListItem } from '../src/types';

describe('Cutting Optimization', () => {
  const config = {
    sheetWidth: 244,
    sheetHeight: 183,
    sawKerf: 0.4,
    sheetMargin: 0,
    allowRotation: true,
  };

  it('optimizes a simple cut list', () => {
    const items: CutListItem[] = [
      {
        id: 'item-1',
        cabinetId: 'cab-1',
        cabinetName: 'Cabinet 1',
        componentName: 'Floor',
        width: 80,
        height: 58,
        quantity: 1,
        material: 'mdf-16mm',
        edgeBanding: {
          enabled: false,
          thickness: 0,
          edges: { top: false, bottom: false, left: false, right: false },
        },
      },
      {
        id: 'item-2',
        cabinetId: 'cab-1',
        cabinetName: 'Cabinet 1',
        componentName: 'Back',
        width: 76.8,
        height: 73.4,
        quantity: 1,
        material: 'mdf-16mm',
        edgeBanding: {
          enabled: true,
          thickness: 1,
          edges: { top: true, bottom: true, left: true, right: true },
        },
      },
    ];

    const result = optimizeCutList(items, config);
    
    expect(result).toHaveLength(1); // All parts fit on one sheet
    expect(result[0].parts).toHaveLength(2);
    expect(result[0].utilization).toBeGreaterThan(0);
    expect(result[0].utilization).toBeLessThanOrEqual(100);
  });

  it('uses multiple sheets when parts do not fit', () => {
    const items: CutListItem[] = [];
    
    // Create 10 large parts that won't all fit on one sheet
    for (let i = 0; i < 10; i++) {
      items.push({
        id: `item-${i}`,
        cabinetId: 'cab-1',
        cabinetName: 'Cabinet 1',
        componentName: `Part ${i}`,
        width: 100,
        height: 100,
        quantity: 1,
        material: 'mdf-16mm',
        edgeBanding: {
          enabled: false,
          thickness: 0,
          edges: { top: false, bottom: false, left: false, right: false },
        },
      });
    }

    const result = optimizeCutList(items, config);
    
    // Sheet is 244 x 183, so ~4 parts per sheet
    expect(result.length).toBeGreaterThan(1);
    expect(result.reduce((sum, s) => sum + s.parts.length, 0)).toBe(10);
  });

  it('respects quantity', () => {
    const items: CutListItem[] = [
      {
        id: 'item-1',
        cabinetId: 'cab-1',
        cabinetName: 'Cabinet 1',
        componentName: 'Door',
        width: 40,
        height: 70,
        quantity: 5,
        material: 'mdf-16mm',
        edgeBanding: {
          enabled: true,
          thickness: 1,
          edges: { top: true, bottom: true, left: true, right: true },
        },
      },
    ];

    const result = optimizeCutList(items, config);
    const totalParts = result.reduce((sum, s) => sum + s.parts.length, 0);
    
    expect(totalParts).toBe(5);
  });

  it('validates optimization results', () => {
    const items: CutListItem[] = [
      {
        id: 'item-1',
        cabinetId: 'cab-1',
        cabinetName: 'Cabinet 1',
        componentName: 'Test',
        width: 50,
        height: 50,
        quantity: 1,
        material: 'mdf-16mm',
        edgeBanding: {
          enabled: false,
          thickness: 0,
          edges: { top: false, bottom: false, left: false, right: false },
        },
      },
    ];

    const layouts = optimizeCutList(items, config);
    const validation = validateOptimization(layouts, items, config);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});
