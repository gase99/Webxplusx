# CabinetPro Web

**Professional Bilingual Cabinet Design, Manufacturing & Cut Optimization Platform**

A web application for designing MDF cabinets, generating cutting lists, optimizing sheet cuts, and preparing manufacturing documentation. Fully bilingual with Persian (فارسی) and English support.

## Features

### Core Functionality
- **Cabinet Design**: Create base cabinets, wall cabinets, tall cabinets, and drawer units
- **Cutting List Generation**: Automatically generate production-ready cutting lists from cabinet designs
- **Sheet Cut Optimization**: 2D bin packing algorithm for optimizing MDF sheet usage
- **Technical Drawings**: SVG-based cabinet visualization with dimensions
- **Bilingual Support**: Full Persian (RTL) and English (LTR) interface with persistent language preference
- **Local Storage**: IndexedDB-based project storage for offline access

### Excel Formula Compatibility
All calculations are verified against the original `analiz pro.2.xlsx` workbook:
- Base cabinet component calculations
- Wall cabinet component calculations  
- Drawer component calculations
- Door width and count formulas based on cabinet width ranges

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **i18next** - Internationalization
- **IndexedDB (idb)** - Local storage
- **Vitest** - Testing
- **jsPDF** - PDF export
- **XLSX** - Spreadsheet export

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run type-check
```

### Development Server

The development server runs at `http://localhost:5173`

## Project Structure

```
src/
├── components/          # React components
├── pages/              # Page components
├── engine/             # Calculation engines
│   ├── cabinet.ts      # Cabinet calculation formulas
│   └── optimization.ts # 2D cutting optimization
├── i18n/              # Internationalization
│   ├── config.ts      # i18next configuration
│   └── locales/       # Translation files
├── storage/           # Data persistence
├── hooks/             # React hooks
├── types/             # TypeScript type definitions
├── App.tsx            # Main application component
├── main.tsx           # Application entry point
└── index.css          # Global styles

tests/                 # Test files
docs/                  # Documentation
```

## Calculation Rules

### Base Cabinet (کابینت زمینی)
- **Width (B)**: Cabinet width in cm
- **Depth (C)**: Cabinet depth in cm
- **Height (F)**: Cabinet height in cm
- **Floor**: B × C
- **Back Panel**: (B - 3.2) × F
- **Sides**: C × F (quantity: 2)
- **Shelf**: (B - 3.2) × (C - 3)
- **Tie**: C × 7
- **3mm Strips**: (B - 1.6) × (F + 1.6 - 0.8) (quantity: 2)
- **Door Width**: 
  - 10-50cm: B - 0.2 (1 door)
  - 51-100cm: B/2 - 0.2 (2 doors)
  - 101-150cm: B/3 - 0.2 (3 doors)

### Wall Cabinet (کابینت هوایی)
- **Width (B)**: Cabinet width in cm
- **Depth (C)**: Cabinet depth in cm
- **Height (D)**: Cabinet height in cm
- **Sides**: C × D (quantity: 2)
- **Floor**: (B - 3.2) × C
- **Top**: (C - 2) × (B - 3.2)
- **Shelf**: (B - 3.2) × (C - 3)
- **Tie**: (B - 3.2) × C
- **3mm Strips**: (B - 3.2 + 1.6) × (D - 0.8) (quantity: 2)
- **Door Width**: Same piecewise formula as base cabinet
- **Door Height**: 92cm (fixed)

### Drawer (کشو)
- **Depth (C)**: Drawer depth in cm
- **Width (D)**: Drawer width in cm
- **Height (E)**: Drawer height in cm
- **Quantity (B)**: Number of drawers
- **Sides**: (C - 5) × (E/3 - 4) (quantity: B × 2)
- **Front**: (D - 9.1) × (E/3 - 4) (quantity: B)
- **Back**: (D - 9.1) × (E/3 - 4 - 2) (quantity: B)

## Cutting Optimization

The optimization engine uses the **MaxRects Best Area Fit** algorithm:
- Efficient 2D rectangular bin packing
- Supports rotation for better space utilization
- Accounts for saw kerf and sheet margins
- Validates all placements for correctness

### Optimization Settings
- **Sheet Size**: Standard MDF sheet dimensions (e.g., 244 × 183 cm)
- **Saw Kerf**: Blade thickness (default: 0.4 cm)
- **Sheet Margin**: Edge trim margin
- **Rotation**: Allow/disallow part rotation

## Localization

### Supported Languages
- **Persian (fa-IR)**: Default language with RTL layout
- **English (en-US)**: Alternative language with LTR layout

### Features
- Automatic language detection
- Persistent language preference across sessions
- Complete translation of all UI elements
- Proper handling of Persian numerals and text
- RTL/LTR layout switching without data loss

## Data Storage

Projects are stored locally in IndexedDB:
- **Offline Access**: All data available without internet
- **No Server Required**: Client-side only application
- **Export/Import**: JSON-based project backup
- **Multiple Projects**: Create and manage multiple cabinet projects

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm test             # Run tests
npm run test:ui      # Run tests with UI
npm run lint         # Lint code
npm run type-check   # Type check without emitting
```

### Code Quality

- TypeScript strict mode enabled
- ESLint for code linting
- Vitest for testing
- No unused variables or parameters

## About

**Developer**: عباس کروشاد / Abbas Khoroushad  
**Support Email**: webxplusx@gmail.com  
**GitHub**: https://github.com/gase99  
**Repository**: https://github.com/gase99/webxplusx  
**Instagram**: @webxplusx

## License

This project is proprietary software.

## Acknowledgments

Formula calculations verified against the original Excel workbook "analiz pro.2.xlsx"
