# Excel Formula Map

## Overview

This document maps the formulas from `analiz pro.2.xlsx` to the TypeScript implementation in the application.

## Source Workbook Structure

The Excel workbook contains 5 worksheets:
1. **کابینت زمینی** (Base Cabinet)
2. **آنالیز زمینی** (Base Cabinet Analysis)
3. **کابینت هوایی** (Wall Cabinet)
4. **آنالیز هوایی** (Wall Cabinet Analysis)
5. **کشو** (Drawer)

## Base Cabinet (کابینت زمینی)

### Input Cells
- **B**: Cabinet width (cm)
- **C**: Cabinet depth (cm)
- **F**: Cabinet height (cm)

### Calculated Components

#### Floor (کف)
- **Cell D2**: `=B2` (width = cabinet width)
- **Cell C2**: 58 (depth = cabinet depth)
- **Quantity**: 1

#### Back Panel (بدنه)
- **Cell H2**: `=B2-3.2` (width = cabinet width - 3.2)
- **Cell F2**: 73.4 (height = cabinet height)
- **Quantity**: 1
- **Edge banding**: All 4 edges

#### Body Sides
- **Width**: Cabinet depth
- **Height**: Cabinet height
- **Quantity**: 2 (left and right)
- **Edge banding**: 3 edges (excluding inner edge)

#### Shelf (طبقه)
- **Cell G2**: 55 (width = cabinet depth - 3)
- **Formula**: `=B2-3.2` (depth = cabinet width - 3.2)
- **Quantity**: 1

#### Tie (قید)
- **Cell I2**: 7 (width)
- **Cell J2**: `=B2-3.2` (height = cabinet width - 3.2)
- **Quantity**: 1

#### 3mm Strips (نوار 3 میل)
- **Cell K2**: `=D2-1.6` (width = floor width - 1.6)
- **Cell L2**: `=F2+1.6-0.8` (length = height + 1.6 - 0.8)
- **Quantity**: 2
- **Edge banding**: 2 long edges

#### Doors (درب)
- **Cell M2**: `=IF(AND(B2>=10,B2<=50), B2-0.2, IF(AND(B2>50,B2<=100),B2/2-0.2, IF(AND(B2>100,B2<=150),B2/3-0.2, "")))`
- **Cell N2**: 73.4 (height = cabinet height)
- **Cell N5**: `=IF(AND(B2>=10,B2<=50),1,IF(AND(B2>50,B2<=100),2,IF(AND(B2>100,B2<=150),3,"")))`
- **Quantity**: 1, 2, or 3 based on width

## Wall Cabinet (کابینت هوایی)

### Input Cells
- **B**: Cabinet width (cm)
- **C**: Cabinet depth (cm)
- **D**: Cabinet height (cm)

### Calculated Components

#### Body Sides
- **Cell C3**: 35 (width = cabinet depth)
- **Cell D3**: 90 (height = cabinet height)
- **Quantity**: 2

#### Floor (کف)
- **Cell E3**: 35 (width = cabinet depth)
- **Cell F3**: `=B3-3.2` (height = cabinet width - 3.2)
- **Quantity**: 1

#### Top (تاق)
- **Cell G3**: `=C3-2` (width = cabinet depth - 2)
- **Cell H3**: `=B3-3.2` (height = cabinet width - 3.2)
- **Quantity**: 1

#### Shelf (طبقه)
- **Cell I3**: `=E3-3` (width = floor width - 3)
- **Cell J3**: `=F3` (height = floor height)
- **Quantity**: 1

#### Tie (قید)
- **Cell K3**: 7 (width)
- **Cell L3**: `=B3-3.2` (height = cabinet width - 3.2)
- **Quantity**: 1

#### 3mm Strips
- **Cell M3**: `=F3+1.6` (width = floor height + 1.6)
- **Cell N3**: `=D3-0.8` (length = cabinet height - 0.8)
- **Quantity**: 2

#### Doors
- **Cell O3**: Same piecewise formula as base cabinet
- **Cell P3**: 92 (fixed height for wall cabinets)
- **Cell P6**: Same door count formula as base cabinet

## Drawer (کشو)

### Input Cells
- **B**: Quantity
- **C**: Drawer depth (cm)
- **D**: Drawer width (cm)
- **E**: Drawer height (cm)

### Calculated Components

#### Sides (بدنه کشو)
- **Cell H4**: `=C4-5` (length = depth - 5)
- **Cell H5**: `=E4/3-4` (height = height/3 - 4)
- **Cell H6**: `=B4*2` (quantity = drawer quantity × 2)

#### Front (جلو کشو)
- **Cell J4**: `=D4-9.1` (length = width - 9.1)
- **Cell J5**: `=H5` (height = side height)
- **Cell J6**: `=B4` (quantity = drawer quantity)

#### Back (پشت کشو)
- **Cell L4**: `=J4` (length = front length)
- **Cell L5**: `=J5-2` (height = front height - 2)
- **Cell L6**: `=J6` (quantity = front quantity)

## Implementation Status

### Verified Formulas
✅ Base cabinet all components
✅ Wall cabinet all components
✅ Drawer all components
✅ Door width piecewise formula
✅ Door count formula

### Notes and Observations

1. **Clearance Values**: The 3.2cm clearance appears consistently in width calculations, likely accounting for panel thickness and assembly tolerances.

2. **Piecewise Door Formula**: The door width formula divides the cabinet into sections:
   - Narrow (10-50cm): Single door
   - Medium (51-100cm): Two doors
   - Wide (101-150cm): Three doors

3. **Drawer Height Division**: Drawer height is divided by 3, suggesting a specific design for drawer box proportions.

4. **Edge Banding**: Most components have edge banding on specific edges, but the exact pattern may need workshop verification.

## Unresolved Questions

1. **Tie Height**: Fixed at 7cm in base cabinets, needs confirmation if this is universal or adjustable.

2. **Shelf Quantity**: Currently 1 shelf per cabinet, may need to support multiple shelves.

3. **Back Panel Thickness**: Assumed to be 3mm based on strip calculations, needs verification.

4. **Grain Direction**: Not specified in formulas, may need to be added for optimization.

5. **Edge Banding Patterns**: Exact edge banding requirements for each component need workshop confirmation.

## Testing

All formulas have been implemented in `src/engine/cabinet.ts` and tested against the Excel examples:
- 80cm base cabinet
- 100cm base cabinet
- 60cm wall cabinet
- Standard drawer

Test results match Excel calculations within acceptable tolerances.
