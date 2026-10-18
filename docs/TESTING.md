# Testing Documentation

## Test Framework

The application uses **Vitest** for automated testing.

## Running Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test tests/cabinet.test.ts

# Run with coverage
npm test -- --coverage
```

## Test Categories

### 1. Calculation Tests (`tests/cabinet.test.ts`)

Tests for cabinet component calculations verified against Excel formulas.

#### Coverage
- Door width calculation for all width ranges
- Door count calculation
- Base cabinet components (80cm and 100cm examples)
- Wall cabinet components (60cm example)
- Drawer components

#### Key Test Cases
```typescript
// Door width for narrow cabinets
calculateDoorWidth(40) === 39.8  // 40 - 0.2

// Door width for medium cabinets
calculateDoorWidth(80) === 39.8  // 80/2 - 0.2

// Door width for wide cabinets
calculateDoorWidth(120) === 39.8 // 120/3 - 0.2

// Base cabinet back panel width
cabinet.components.back.width === 76.8  // 80 - 3.2

// Wall cabinet floor width
cabinet.components.floor.width === 56.8  // 60 - 3.2

// Drawer side length
drawer.components.side[0].width === 45  // 50 - 5
```

### 2. Optimization Tests (`tests/optimization.test.ts`)

Tests for the 2D cutting optimization engine.

#### Coverage
- Single sheet optimization
- Multi-sheet optimization when parts exceed sheet size
- Quantity handling
- Result validation (no overlaps, within bounds)

#### Key Test Cases
```typescript
// All parts fit on one sheet
result.length === 1

// Parts distributed across multiple sheets
result.length > 1

// Quantity respected
totalParts === 5  // for quantity: 5

// Validation passes
validation.valid === true
validation.errors.length === 0
```

### 3. Localization Tests (Planned)

Future tests for bilingual support:
- Persian RTL layout
- English LTR layout
- Language switching without data loss
- Persistent language preference
- Persian character handling in exports

### 4. Integration Tests (Planned)

Future tests for:
- Project creation and persistence
- Cabinet editing and recalculation
- Import/export validation
- Error handling

## Test Data

### Excel Verification Data

The following test cases are derived from the Excel workbook:

**Base Cabinet 1 (Row 2)**
- Width: 80cm, Depth: 58cm, Height: 73.4cm
- Expected door count: 2
- Expected door width: 39.8cm
- Expected back width: 76.8cm

**Base Cabinet 2 (Row 12)**
- Width: 100cm, Depth: 58cm, Height: 73.4cm
- Expected door count: 2
- Expected door width: 49.8cm

**Wall Cabinet 1 (Row 3)**
- Width: 60cm, Depth: 35cm, Height: 90cm
- Expected door count: 2
- Expected door width: 29.8cm
- Expected door height: 92cm

**Drawer (Row 4)**
- Depth: 50cm, Width: 90cm, Height: 50cm, Quantity: 1
- Expected side length: 45cm
- Expected front length: 80.9cm

## Continuous Integration

Tests are configured to run in GitHub Actions on:
- Push to main branch
- Pull requests

### CI Workflow
```yaml
- Install dependencies
- Type check
- Lint
- Run tests
- Build
```

## Test Coverage Goals

- **Calculation Engine**: 100% (all formulas tested)
- **Optimization Engine**: 90%+ (core algorithms and validation)
- **UI Components**: 70%+ (key interactions and state management)
- **Overall**: 80%+

## Known Limitations

1. **Visual Regression Tests**: Not yet implemented
2. **Browser Tests**: Not yet implemented (only unit tests)
3. **Performance Tests**: Not yet implemented for optimization engine

## Future Testing Enhancements

1. Add browser-based testing with Playwright or Cypress
2. Add visual regression tests for SVG drawings
3. Add performance benchmarks for optimization engine
4. Add accessibility testing
5. Add localization testing with actual Persian text rendering
