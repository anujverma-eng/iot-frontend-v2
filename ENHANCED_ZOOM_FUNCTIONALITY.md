# Enhanced LineChart Zoom Functionality

## Overview
The LineChart component now features an improved zoom system that provides meaningful visual focus on data selections while preserving the brush selection for ongoing analysis.

## Key Improvements

### 1. **Intelligent Zoom Validation**
- Zoom only activates when selection is less than 80% of total data
- Prevents unnecessary zoom on large selections that wouldn't provide visual benefit
- Provides clear feedback on why zoom might be disabled

### 2. **Preserved Brush Selection**
- **Fixed Issue**: Reset now only clears zoom, not brush selection
- Brush selection remains intact for continued data exploration
- Visual selection info stays visible even when zoomed

### 3. **Enhanced Y-Axis Scaling**
- Smart Y-axis domain calculation based on selected data range
- 15% padding for better visual clarity
- Multi-series support with proper value aggregation
- Handles edge cases (single values, zero ranges)

### 4. **Improved User Experience**
- Clear visual indicators for zoom state ("Zoomed View" badge)
- Informative tooltips showing selection percentage
- Visual feedback for disabled zoom states
- Better color coding for zoom controls

### 5. **Keyboard Shortcuts**
- `Ctrl/Cmd + Z`: Toggle zoom (zoom in if not zoomed, reset if zoomed)
- `Escape`: Reset zoom when zoomed in
- Smart detection to avoid conflicts with form inputs

## Zoom Behavior

### When Zoom is Available
- Selection must be less than 80% of total dataset
- Clear tooltip shows percentage of data selected
- Zoom button is enabled and provides meaningful focus

### When Zoom is Disabled
- Selection is too large (>80% of data)
- Already zoomed in
- Tooltip explains why zoom is unavailable

### Zoom Reset
- **Only resets zoom view**, preserving brush selection
- Can be triggered by button or keyboard shortcut
- Returns to full dataset view while maintaining selection context

## Visual Feedback

### Zoom State Indicators
- Orange "Zoomed View" badge in chart header
- Orange-tinted reset button when zoomed
- Selection info shows "Viewing:" vs "Selection:" based on zoom state

### Progressive Disclosure
- Zoom controls only appear when meaningful selections exist
- Clear separation between zoom and download actions
- Responsive design for mobile devices

## Technical Implementation

### Performance Considerations
- Efficient Y-axis domain calculation
- Minimal re-renders through React.useCallback
- Smart value filtering for large datasets

### Multi-Series Support
- Proper handling of multiple data series in zoom calculations
- Aggregates values across all series for Y-axis domain
- Maintains visual clarity across different sensor types

## Usage Examples

### Basic Zoom Workflow
1. Use brush to select interesting data range (drag on bottom timeline)
2. Click zoom button to focus on selection (if <80% of data)
3. Explore zoomed view with enhanced detail
4. Reset zoom to return to full view (selection preserved)

### Keyboard-Driven Workflow
1. Make brush selection
2. Press `Ctrl/Cmd + Z` to zoom in
3. Analyze detailed view
4. Press `Escape` or `Ctrl/Cmd + Z` again to reset

### Multi-Series Analysis
1. Select sensors for comparison
2. Use brush to highlight specific time period
3. Zoom in to see detailed value differences
4. Reset zoom to see full timeline context

## Benefits

1. **Meaningful Zoom**: Only allows zoom when it provides real visual benefit
2. **Preserved Context**: Brush selection maintained across zoom operations
3. **Better Analysis**: Enhanced Y-axis scaling for detailed examination
4. **Intuitive Controls**: Clear feedback and keyboard shortcuts
5. **Mobile Friendly**: Responsive design works across devices

This enhanced zoom functionality transforms the chart from a basic visualization tool into a powerful data exploration interface, enabling users to seamlessly move between overview and detailed analysis while maintaining their selection context.
