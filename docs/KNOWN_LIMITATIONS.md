# Known Limitations

## Current Limitations

### 1. Storage Limitations

#### IndexedDB Storage
- **Browser Limit**: Typically 50MB per origin (varies by browser)
- **No Cloud Sync**: All data stored locally only
- **No Multi-Device Sync**: Projects not shared between devices
- **Manual Backup Required**: Users must export projects manually

**Mitigation**: Implement export/import functionality and document backup procedures.

### 2. Calculation Limitations

#### Formula Verification
- **Workshop Validation Needed**: Some clearance values need physical verification
- **Edge Banding Patterns**: Exact edge banding requirements not fully specified
- **Tie Height**: Fixed at 7cm, may need to be configurable
- **Shelf Quantity**: Currently 1 shelf per cabinet, may need multiple shelves

**Status**: Core formulas verified against Excel, but workshop validation recommended.

### 3. Optimization Limitations

#### Algorithm Constraints
- **No Grain Direction**: Doesn't consider wood grain direction
- **No Part Grouping**: Parts from same cabinet not grouped together
- **No Offcut Tracking**: Reusable offcuts not tracked
- **No Cutting Sequence**: Doesn't optimize cutting order
- **Single Material**: All parts assumed to be same material

**Impact**: May not achieve optimal material utilization in all cases.

### 4. Export Limitations

#### Missing Export Formats
- **PDF Export**: Not yet implemented
- **Excel Export**: Not yet implemented
- **CSV Export**: Not yet implemented
- **SVG Export**: Not yet implemented for technical drawings

**Status**: Libraries installed (jsPDF, XLSX), but export functions not yet implemented.

### 5. UI/UX Limitations

#### Missing Features
- **Undo/Redo**: No undo/redo functionality
- **Keyboard Shortcuts**: No keyboard shortcuts implemented
- **Drag and Drop**: No drag-and-drop for cabinet arrangement
- **Visual Feedback**: Limited visual feedback during calculations
- **Help System**: No integrated help or tooltips
- **Mobile Optimization**: UI not fully optimized for mobile devices

### 6. Localization Limitations

#### Translation Gaps
- **Error Messages**: Not all error messages translated
- **Validation Messages**: Validation messages not fully translated
- **Export Content**: Export file content not translated
- **Mixed Direction**: Some mixed RTL/LTR text may display incorrectly
- **Persian Numerals**: Automatic Persian numeral conversion not implemented

### 7. Technical Drawing Limitations

#### Missing Drawing Features
- **2D Drawings**: Technical drawings not yet implemented
- **Exploded View**: Exploded assembly view not implemented
- **Dimension Annotations**: Dimension annotations not implemented
- **Part Labels**: Part identification labels not implemented

**Status**: Core calculation engine ready, but visualization not implemented.

### 8. Material Management Limitations

#### Missing Material Features
- **Material Catalog**: No material catalog management
- **Custom Materials**: Cannot add custom materials
- **Price Management**: No price/cost tracking
- **Inventory Tracking**: No inventory management

### 9. Testing Limitations

#### Test Coverage Gaps
- **Integration Tests**: No integration tests yet
- **Browser Tests**: No browser-based testing (Playwright/Cypress)
- **Visual Regression**: No visual regression tests
- **Accessibility Tests**: No accessibility testing
- **Performance Tests**: No performance benchmarks

### 10. Browser Compatibility

#### Older Browsers
- **IE 11**: Not supported (requires modern browser)
- **Safari < 14**: May not work correctly
- **Firefox < 88**: May not work correctly
- **Chrome < 90**: May not work correctly

## Planned Improvements

### High Priority

1. **PDF Export**
   - Generate PDF cut lists
   - Generate PDF optimization layouts
   - Support Persian fonts in PDF

2. **Technical Drawings**
   - SVG-based 2D drawings
   - Dimension annotations
   - Part labels
   - Exploded view

3. **Material Catalog**
   - Material management UI
   - Custom material definitions
   - Price tracking
   - Material selection

4. **Undo/Redo**
   - Command pattern implementation
   - History stack
   - Keyboard shortcuts (Ctrl+Z, Ctrl+Y)

### Medium Priority

5. **Cloud Synchronization** (Optional)
   - User authentication
   - Project sync to cloud
   - Multi-device access
   - Collaboration features

6. **Advanced Optimization**
   - Grain direction constraints
   - Part grouping by cabinet
   - Offcut tracking
   - Multiple materials

7. **Enhanced Localization**
   - Complete translation coverage
   - Persian numeral conversion
   - Bilingual export options
   - Better RTL/LTR handling

8. **Performance Optimization**
   - Web Workers for heavy calculations
   - Virtual scrolling for large lists
   - Lazy loading for components

### Low Priority

9. **Mobile Optimization**
   - Touch-friendly UI
   - Responsive layout improvements
   - Mobile-specific features

10. **Accessibility**
    - ARIA labels
    - Keyboard navigation
    - Screen reader support
    - High contrast mode

## Workarounds

### Storage Limitations
- Regularly export projects to JSON
- Store exports in cloud storage (Google Drive, Dropbox)
- Use modern browsers with larger IndexedDB limits

### Optimization Limitations
- Manually group parts by material before optimization
- Run optimization multiple times with different settings
- Manually adjust layouts for better utilization

### Export Limitations
- Use browser print functionality as temporary PDF export
- Copy cut list data to external spreadsheet
- Screenshot optimization layouts

### UI Limitations
- Save frequently to avoid data loss
- Use browser back button with caution
- Test on multiple browsers for compatibility

## Reporting Issues

To report bugs or request features:
- Email: webxplusx@gmail.com
- GitHub Issues: https://github.com/gase99/webxplusx/issues
- Instagram: @webxplusx

## Version History

### v1.0.0 (Current)
- Initial release
- Core cabinet calculations
- Basic optimization engine
- Bilingual support (Persian/English)
- Local storage with IndexedDB
- 16 automated tests passing

### Future Versions
- v1.1.0: PDF export and technical drawings
- v1.2.0: Material catalog and costing
- v1.3.0: Cloud synchronization (optional)
- v2.0.0: Advanced optimization and mobile support
