# Calculation Rules

## Overview

This document describes the calculation rules implemented in CabinetPro Web, verified against the original Excel workbook `analiz pro.2.xlsx`.

## Measurement Units

- **Primary Unit**: Centimeters (cm)
- **Internal Representation**: Floating point numbers
- **Display Format**: 1-2 decimal places

## Clearance Values

The following clearance values are used throughout calculations:

- **3.2 cm**: Standard panel clearance (likely accounts for 16mm panel + assembly tolerance)
- **1.6 cm**: Half of 3.2cm clearance
- **3.0 cm**: Shelf depth clearance
- **2.0 cm**: Top panel depth clearance
- **5.0 cm**: Drawer side depth clearance
- **9.1 cm**: Drawer front/back width clearance

## Base Cabinet (کابینت زمینی)

### Input Parameters
- **Width (W)**: Cabinet width in cm (10-150 cm)
- **Depth (D)**: Cabinet depth in cm (typically 58 cm)
- **Height (H)**: Cabinet height in cm (typically 73.4 cm)

### Component Calculations

#### Floor (کف)
```
Width = W
Height = D
Quantity = 1
Edge Banding: None
```

#### Back Panel (بدنه)
```
Width = W - 3.2
Height = H
Quantity = 1
Edge Banding: All 4 edges
```

#### Body Sides (بدنه چپ/راست)
```
Width = D
Height = H
Quantity = 2
Edge Banding: 3 edges (outer top, outer bottom, outer side)
```

#### Shelf (طبقه)
```
Width = W - 3.2
Height = D - 3
Quantity = 1
Edge Banding: None
```

#### Tie (قید)
```
Width = D
Height = 7
Quantity = 1
Edge Banding: None
```

#### 3mm Strips (نوار 3 میل)
```
Width = W - 1.6
Height = H + 1.6 - 0.8 = H + 0.8
Quantity = 2
Edge Banding: 2 long edges
```

#### Doors (درب)
```
Width = Piecewise function (see below)
Height = H
Quantity = Piecewise function (see below)
Edge Banding: All 4 edges
```

**Door Width Formula:**
```
IF W >= 10 AND W <= 50:
  doorWidth = W - 0.2
  doorCount = 1
ELSE IF W > 50 AND W <= 100:
  doorWidth = W/2 - 0.2
  doorCount = 2
ELSE IF W > 100 AND W <= 150:
  doorWidth = W/3 - 0.2
  doorCount = 3
ELSE:
  Invalid (return null)
```

### Example: 80cm Base Cabinet
```
Input: W=80, D=58, H=73.4

Floor: 80 × 58 cm (1 piece)
Back: 76.8 × 73.4 cm (1 piece)
Sides: 58 × 73.4 cm (2 pieces)
Shelf: 76.8 × 55 cm (1 piece)
Tie: 58 × 7 cm (1 piece)
3mm Strips: 78.4 × 74.2 cm (2 pieces)
Doors: 39.8 × 73.4 cm (2 pieces)
```

## Wall Cabinet (کابینت هوایی)

### Input Parameters
- **Width (W)**: Cabinet width in cm (10-150 cm)
- **Depth (D)**: Cabinet depth in cm (typically 35 cm)
- **Height (H)**: Cabinet height in cm (typically 90 cm)

### Component Calculations

#### Body Sides (بدنه چپ/راست)
```
Width = D
Height = H
Quantity = 2
Edge Banding: 3 edges
```

#### Floor (کف)
```
Width = W - 3.2
Height = D
Quantity = 1
Edge Banding: None
```

#### Top (تاق)
```
Width = D - 2
Height = W - 3.2
Quantity = 1
Edge Banding: None
```

#### Shelf (طبقه)
```
Width = W - 3.2
Height = D - 3
Quantity = 1
Edge Banding: None
```

#### Tie (قید)
```
Width = W - 3.2
Height = D
Quantity = 1
Edge Banding: None
```

#### 3mm Strips (نوار 3 میل)
```
Width = W - 3.2 + 1.6 = W - 1.6
Height = H - 0.8
Quantity = 2
Edge Banding: 2 long edges
```

#### Doors (درب)
```
Width = Piecewise function (same as base cabinet)
Height = 92 cm (fixed)
Quantity = Piecewise function (same as base cabinet)
Edge Banding: All 4 edges
```

### Example: 60cm Wall Cabinet
```
Input: W=60, D=35, H=90

Sides: 35 × 90 cm (2 pieces)
Floor: 56.8 × 35 cm (1 piece)
Top: 33 × 56.8 cm (1 piece)
Shelf: 56.8 × 32 cm (1 piece)
Tie: 56.8 × 35 cm (1 piece)
3mm Strips: 58.4 × 89.2 cm (2 pieces)
Doors: 29.8 × 92 cm (2 pieces)
```

## Drawer (کشو)

### Input Parameters
- **Depth (D)**: Drawer depth in cm
- **Width (W)**: Drawer width in cm
- **Height (H)**: Drawer height in cm
- **Quantity (Q)**: Number of drawers

### Component Calculations

#### Sides (بدنه کشو)
```
Width = D - 5
Height = H/3 - 4
Quantity = Q × 2
Edge Banding: None
```

#### Front (جلو کشو)
```
Width = W - 9.1
Height = H/3 - 4
Quantity = Q
Edge Banding: None
```

#### Back (پشت کشو)
```
Width = W - 9.1
Height = H/3 - 4 - 2 = H/3 - 6
Quantity = Q
Edge Banding: None
```

### Example: Standard Drawer
```
Input: D=50, W=90, H=50, Q=1

Sides: 45 × 12.67 cm (2 pieces)
Front: 80.9 × 12.67 cm (1 piece)
Back: 80.9 × 10.67 cm (1 piece)
```

## Rounding and Precision

### Floating Point Handling
- Internal calculations use full floating point precision
- Display values rounded to 1-2 decimal places
- No intermediate rounding during calculations

### Tolerance
- Calculated values should match Excel within 0.01 cm
- Minor differences may occur due to floating point representation
- Critical dimensions should be verified with physical prototypes

## Edge Banding Rules

### Base Cabinet
- **Back Panel**: All 4 edges
- **Sides**: 3 edges (excluding inner edge)
- **Doors**: All 4 edges
- **3mm Strips**: 2 long edges

### Wall Cabinet
- **Sides**: 3 edges (excluding inner edge)
- **Doors**: All 4 edges
- **3mm Strips**: 2 long edges

### Drawer
- No edge banding (covered by drawer front)

## Validation Rules

### Dimension Constraints
- **Base/Wall Cabinet Width**: 10-150 cm
- **Base Cabinet Depth**: Typically 58 cm (range: 40-70 cm)
- **Base Cabinet Height**: Typically 73.4 cm (range: 60-90 cm)
- **Wall Cabinet Depth**: Typically 35 cm (range: 25-45 cm)
- **Wall Cabinet Height**: Typically 90 cm (range: 60-120 cm)

### Error Conditions
- Width < 10 cm or > 150 cm: Invalid door configuration
- Negative dimensions: Not allowed
- Zero quantity: Not allowed

## Unresolved Questions

1. **Tie Height**: Is 7 cm universal or adjustable?
2. **Shelf Quantity**: Should support multiple shelves?
3. **Back Panel Thickness**: Confirmed as 3mm or different?
4. **Grain Direction**: Need specification for optimization
5. **Edge Banding Thickness**: Is 1 mm standard or variable?
6. **Drawer Runner Clearance**: Need verification of 9.1 cm value
7. **Custom Dimensions**: Should all values be user-configurable?

## Testing

All calculation rules are tested in `tests/cabinet.test.ts` with:
- Excel example verification
- Boundary condition testing
- Invalid input handling
- Quantity calculations

Run tests: `npm test`
