# Architecture Documentation

## Overview

CabinetPro Web is a client-side web application built with React and TypeScript, designed for cabinet design, manufacturing preparation, and cut optimization.

## Architecture Principles

1. **Local-First**: All data stored in IndexedDB for offline access
2. **Separation of Concerns**: Business logic separated from UI components
3. **Type Safety**: Full TypeScript strict mode
4. **Internationalization**: Complete bilingual support (Persian/English)
5. **Testability**: Modular design with comprehensive test coverage

## System Components

### Frontend Layer (React)
- **Pages**: Dashboard, CabinetEditor, About
- **Components**: Reusable UI components
- **Hooks**: Custom React hooks for i18n and storage

### Engine Layer (TypeScript)
- **Cabinet Calculations**: Formula implementations from Excel workbook
- **Cutting Optimization**: MaxRects bin packing algorithm
- **Validation**: Geometric and quantity validation

### Storage Layer (IndexedDB)
- **Projects**: Cabinet projects with all components
- **Settings**: User preferences and configuration
- **Export/Import**: JSON-based data transfer

### Localization Layer (i18next)
- **Translation Files**: Persian (fa.json) and English (en.json)
- **Language Detection**: Automatic browser language detection
- **RTL Support**: Proper right-to-left layout for Persian

## Data Flow

1. User creates/edits cabinet → Cabinet calculation engine
2. Calculation engine → Components with dimensions
3. Components → Cutting list generation
4. Cutting list → Optimization engine
5. Optimization results → Visualization and export

## Key Design Decisions

### IndexedDB vs localStorage
- IndexedDB chosen for structured data and larger storage capacity
- Better suited for complex project data with multiple cabinets

### MaxRects Algorithm
- Industry-standard 2D bin packing
- Good balance of performance and space utilization
- Supports rotation and constraints

### Separate Calculation Engine
- Business logic independent of UI
- Easy to test and verify against Excel formulas
- Reusable for different output formats (cut list, drawings, etc.)

## Module Dependencies

```
App.tsx
├── Dashboard
│   ├── CabinetEditor
│   └── Storage (IndexedDB)
├── About
└── i18n

Engine
├── cabinet.ts (calculations)
└── optimization.ts (bin packing)

Storage
└── indexedDB.ts (data persistence)
```

## Future Enhancements

### Planned Features
- PDF export with jsPDF
- Excel export with XLSX library
- SVG technical drawings
- Material catalog management
- Cost estimation
- Cloud synchronization (optional)

### Technical Debt
- Add more comprehensive error handling
- Implement undo/redo for cabinet editing
- Add keyboard shortcuts
- Improve mobile responsiveness
