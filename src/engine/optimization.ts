import { SheetLayout, SheetPart, CutListItem } from '../types';

/**
 * MaxRects-based 2D bin packing algorithm for sheet cutting optimization
 * 
 * Based on the "MaxRects Best Area Fit" heuristic which provides good
 * space utilization for rectangular panel cutting optimization.
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PartToPack {
  id: string;
  label: string;
  width: number;
  height: number;
  canRotate: boolean;
}

class MaxRectsBinPack {
  private freeRectangles: Rect[] = [];

  constructor(width: number, height: number) {
    this.freeRectangles.push({ x: 0, y: 0, width, height });
  }

  insert(rectWidth: number, rectHeight: number, canRotate: boolean): Rect | null {
    let bestScore = { score1: Infinity, score2: Infinity };
    let bestRect: Rect | null = null;

    for (const free of this.freeRectangles) {
      // Try original orientation
      if (rectWidth <= free.width && rectHeight <= free.height) {
        const score1 = this.computeScore(free, rectWidth, rectHeight);
        if (score1.score1 < bestScore.score1 || 
            (score1.score1 === bestScore.score1 && score1.score2 < bestScore.score2)) {
          bestScore = score1;
          bestRect = { x: free.x, y: free.y, width: rectWidth, height: rectHeight };
        }
      }

      // Try rotated orientation
      if (canRotate && rectWidth <= free.height && rectHeight <= free.width) {
        const score1 = this.computeScore(free, rectHeight, rectWidth);
        if (score1.score1 < bestScore.score1 || 
            (score1.score1 === bestScore.score1 && score1.score2 < bestScore.score2)) {
          bestScore = score1;
          bestRect = { x: free.x, y: free.y, width: rectHeight, height: rectWidth };
        }
      }
    }

    if (!bestRect) return null;

    this.placeRectangle(bestRect);
    return bestRect;
  }

  private computeScore(free: Rect, width: number, height: number): { score1: number; score2: number } {
    const leftoverX = free.width - width;
    const leftoverY = free.height - height;
    const shortSideFit = Math.min(leftoverX, leftoverY);
    const longSideFit = Math.max(leftoverX, leftoverY);
    return { score1: shortSideFit, score2: longSideFit };
  }

  private placeRectangle(rect: Rect): void {
    const newFreeRectangles: Rect[] = [];
    
    for (const free of this.freeRectangles) {
      if (this.splitFreeNode(free, rect, newFreeRectangles)) {
        continue;
      }
      newFreeRectangles.push(free);
    }

    // Prune contained rectangles
    this.freeRectangles = this.pruneRectangles(newFreeRectangles);
  }

  private splitFreeNode(free: Rect, used: Rect, result: Rect[]): boolean {
    // Test if the free node is completely contained in the used rect
    if (free.x >= used.x + used.width || free.x + free.width <= used.x ||
        free.y >= used.y + used.height || free.y + free.height <= used.y) {
      return false;
    }

    if (free.x < used.x + used.width && free.x + free.width > used.x) {
      // New node at the top
      if (free.y < used.y && free.y + free.height > used.y) {
        result.push({ x: free.x, y: free.y, width: free.width, height: used.y - free.y });
      }
      // New node at the bottom
      if (free.y + free.height > used.y + used.height) {
        result.push({
          x: free.x,
          y: used.y + used.height,
          width: free.width,
          height: free.y + free.height - (used.y + used.height),
        });
      }
    }

    if (free.y < used.y + used.height && free.y + free.height > used.y) {
      // New node at the left
      if (free.x < used.x && free.x + free.width > used.x) {
        result.push({ x: free.x, y: free.y, width: used.x - free.x, height: free.height });
      }
      // New node at the right
      if (free.x + free.width > used.x + used.width) {
        result.push({
          x: used.x + used.width,
          y: free.y,
          width: free.x + free.width - (used.x + used.width),
          height: free.height,
        });
      }
    }

    return true;
  }

  private pruneRectangles(rectangles: Rect[]): Rect[] {
    const result: Rect[] = [];
    for (let i = 0; i < rectangles.length; i++) {
      let contained = false;
      for (let j = 0; j < rectangles.length; j++) {
        if (i === j) continue;
        if (this.isContained(rectangles[i], rectangles[j])) {
          contained = true;
          break;
        }
      }
      if (!contained) result.push(rectangles[i]);
    }
    return result;
  }

  private isContained(a: Rect, b: Rect): boolean {
    return a.x >= b.x && a.y >= b.y &&
           a.x + a.width <= b.x + b.width &&
           a.y + a.height <= b.y + b.height;
  }
}

export interface OptimizationConfig {
  sheetWidth: number;
  sheetHeight: number;
  sawKerf: number;
  sheetMargin: number;
  allowRotation: boolean;
}

/**
 * Run the cutting optimization on a list of parts
 */
export function optimizeCutList(
  items: CutListItem[],
  config: OptimizationConfig
): SheetLayout[] {
  // Expand items by quantity
  const parts: PartToPack[] = [];
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      parts.push({
        id: `${item.id}-${i}`,
        label: `${item.componentName}${item.quantity > 1 ? ` (${i + 1}/${item.quantity})` : ''}`,
        width: item.width + config.sawKerf * 2,
        height: item.height + config.sawKerf * 2,
        canRotate: config.allowRotation,
      });
    }
  }

  // Sort by area (largest first) for better packing
  parts.sort((a, b) => b.width * b.height - a.width * a.height);

  const layouts: SheetLayout[] = [];
  const usableWidth = config.sheetWidth - config.sheetMargin * 2;
  const usableHeight = config.sheetHeight - config.sheetMargin * 2;

  let remainingParts = [...parts];
  let sheetIndex = 0;

  while (remainingParts.length > 0) {
    const packer = new MaxRectsBinPack(usableWidth, usableHeight);
    const placedParts: SheetPart[] = [];
    const unplacedParts: PartToPack[] = [];

    for (const part of remainingParts) {
      const result = packer.insert(part.width, part.height, part.canRotate);
      if (result) {
        placedParts.push({
          id: part.id,
          cutListItemId: part.id.split('-')[0],
          x: result.x + config.sheetMargin,
          y: result.y + config.sheetMargin,
          width: part.width - config.sawKerf * 2,
          height: part.height - config.sawKerf * 2,
          rotated: result.width !== part.width || result.height !== part.height,
          label: part.label,
        });
      } else {
        unplacedParts.push(part);
      }
    }

    const partsArea = placedParts.reduce((sum, p) => sum + p.width * p.height, 0);
    const sheetArea = usableWidth * usableHeight;
    const wasteArea = sheetArea - partsArea;

    layouts.push({
      id: `sheet-${sheetIndex}`,
      sheetIndex,
      sheetWidth: config.sheetWidth,
      sheetHeight: config.sheetHeight,
      parts: placedParts,
      wasteArea,
      utilization: (partsArea / sheetArea) * 100,
    });

    remainingParts = unplacedParts;
    sheetIndex++;
  }

  return layouts;
}

/**
 * Validate an optimization result for correctness
 */
export function validateOptimization(
  layouts: SheetLayout[],
  items: CutListItem[],
  _config: OptimizationConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check total part count
  const expectedParts = items.reduce((sum, item) => sum + item.quantity, 0);
  const actualParts = layouts.reduce((sum, layout) => sum + layout.parts.length, 0);
  if (actualParts !== expectedParts) {
    errors.push(`Part count mismatch: expected ${expectedParts}, got ${actualParts}`);
  }

  for (const layout of layouts) {
    for (let i = 0; i < layout.parts.length; i++) {
      const part = layout.parts[i];

      // Check bounds
      if (part.x < 0 || part.y < 0 ||
          part.x + part.width > layout.sheetWidth ||
          part.y + part.height > layout.sheetHeight) {
        errors.push(`Part ${part.id} (${part.label}) is out of sheet bounds on sheet ${layout.sheetIndex}`);
      }

      // Check overlap with other parts
      for (let j = i + 1; j < layout.parts.length; j++) {
        const other = layout.parts[j];
        if (part.x < other.x + other.width &&
            part.x + part.width > other.x &&
            part.y < other.y + other.height &&
            part.y + part.height > other.y) {
          errors.push(`Parts ${part.id} and ${other.id} overlap on sheet ${layout.sheetIndex}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
