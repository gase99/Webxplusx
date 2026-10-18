# Cutting Optimization Documentation

## Overview

The cutting optimization engine uses the **MaxRects Best Area Fit** algorithm to efficiently pack rectangular parts onto MDF sheets, minimizing waste and maximizing material utilization.

## Algorithm

### MaxRects Best Area Fit

The MaxRects algorithm is a well-established 2D bin packing heuristic that provides good space utilization for rectangular cutting applications.

**Key Features:**
- Best Area Fit: Selects the free rectangle with the smallest area that can fit the part
- Rotation Support: Parts can be rotated 90° when rotation is enabled
- Guillotine Cuts: Results are compatible with panel saw cutting patterns
- Fast Performance: O(n²) complexity suitable for real-time optimization

### Implementation Details

```typescript
class MaxRectsBinPack {
  // Maintains list of free rectangles
  private freeRectangles: Rect[] = [];
  
  // Insert a part into the best available position
  insert(width: number, height: number, canRotate: boolean): Rect | null;
  
  // Compute best fit score (short side fit, then long side fit)
  computeScore(free: Rect, width: number, height: number): Score;
  
  // Place rectangle and split free rectangles
  placeRectangle(rect: Rect): void;
  
  // Split free rectangle around used rectangle
  splitFreeNode(free: Rect, used: Rect, result: Rect[]): boolean;
  
  // Remove rectangles contained within other rectangles
  pruneRectangles(rectangles: Rect[]): Rect[];
}
```

## Configuration

### OptimizationConfig

```typescript
interface OptimizationConfig {
  sheetWidth: number;      // Sheet width in cm (default: 244)
  sheetHeight: number;     // Sheet height in cm (default: 183)
  sawKerf: number;         // Saw blade thickness in cm (default: 0.4)
  sheetMargin: number;     // Edge trim margin in cm (default: 0)
  allowRotation: boolean;  // Allow part rotation (default: true)
}
```

### Standard MDF Sheet Sizes

- **244 × 183 cm** (8' × 6') - Most common
- **280 × 207 cm** (Standard European)
- **305 × 183 cm** (10' × 6')
- **366 × 183 cm** (12' × 6')

## Input

### CutListItem

```typescript
interface CutListItem {
  id: string;
  cabinetId: string;
  cabinetName: string;
  componentName: string;
  width: number;           // Part width in cm
  height: number;          // Part height in cm
  quantity: number;        // Number of identical parts
  material: string;        // Material identifier
  edgeBanding: EdgeBanding;
}
```

The optimizer expands items by quantity, so a part with quantity 5 becomes 5 separate parts to be placed.

## Output

### SheetLayout

```typescript
interface SheetLayout {
  id: string;
  sheetIndex: number;      // 0-based sheet number
  sheetWidth: number;      // Total sheet width
  sheetHeight: number;     // Total sheet height
  parts: SheetPart[];      // Placed parts
  wasteArea: number;       // Unused area in cm²
  utilization: number;     // Percentage of sheet used (0-100)
}

interface SheetPart {
  id: string;
  cutListItemId: string;
  x: number;               // X position from top-left
  y: number;               // Y position from top-left
  width: number;           // Part width (original, without kerf)
  height: number;          // Part height (original, without kerf)
  rotated: boolean;        // Whether part was rotated
  label: string;           // Display label
}
```

## Optimization Process

1. **Expand Items**: Convert cut list items with quantity > 1 into individual parts
2. **Sort Parts**: Sort by area (largest first) for better packing
3. **Pack Sheets**: For each sheet:
   - Create MaxRects bin packer with usable dimensions
   - Try to place each remaining part
   - Track placed and unplaced parts
   - Calculate utilization and waste
4. **Repeat**: Continue until all parts are placed

## Saw Kerf Handling

The saw kerf (blade thickness) is added to each part's dimensions during optimization:

```typescript
effectiveWidth = partWidth + sawKerf * 2;
effectiveHeight = partHeight + sawKerf * 2;
```

This ensures adequate space between parts for the saw blade.

## Validation

The `validateOptimization()` function checks:

1. **Part Count**: All required parts are placed
2. **Bounds**: No parts extend beyond sheet boundaries
3. **Overlaps**: No parts overlap each other
4. **Kerf**: Parts are spaced correctly for saw kerf

```typescript
function validateOptimization(
  layouts: SheetLayout[],
  items: CutListItem[],
  config: OptimizationConfig
): { valid: boolean; errors: string[] }
```

## Usage Example

```typescript
import { optimizeCutList, validateOptimization } from './engine/optimization';

const items: CutListItem[] = [
  {
    id: 'floor-1',
    cabinetId: 'cab-1',
    cabinetName: 'Base Cabinet',
    componentName: 'Floor',
    width: 80,
    height: 58,
    quantity: 1,
    material: 'mdf-16mm',
    edgeBanding: { /* ... */ }
  }
];

const config = {
  sheetWidth: 244,
  sheetHeight: 183,
  sawKerf: 0.4,
  sheetMargin: 0,
  allowRotation: true
};

const result = optimizeCutList(items, config);
const validation = validateOptimization(result, items, config);

if (validation.valid) {
  console.log(`Optimized ${result.length} sheets`);
  console.log(`Average utilization: ${result.reduce((sum, s) => sum + s.utilization, 0) / result.length}%`);
}
```

## Performance

- **Time Complexity**: O(n² × m) where n = number of parts, m = number of sheets
- **Typical Performance**: 100 parts optimized in < 100ms
- **Memory**: O(n + m) for storing parts and sheets

## Limitations

1. **No Grain Direction**: Current implementation doesn't consider wood grain direction
2. **No Grouping**: Parts from the same cabinet aren't grouped together
3. **No Offcuts**: Reusable offcuts aren't tracked
4. **No Kerf Compensation**: Kerf is added but not subtracted from final dimensions

## Future Enhancements

- Grain direction constraints
- Part grouping by cabinet
- Offcut tracking and reuse
- Multiple material types
- Cutting sequence optimization
- Visual layout with SVG rendering
- Export to CNC format
