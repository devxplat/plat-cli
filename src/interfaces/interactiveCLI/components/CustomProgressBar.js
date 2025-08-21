import React from 'react';
import { Text, Box } from 'ink';
import { colorPalettes } from '../theme/custom-theme.js';

// Progress bar shades palette: #F204F1 #CF00D0 #AC00B0 #890091 #670072
const PROGRESS_SHADES = colorPalettes.shades;

/**
 * Custom progress bar using the specified shades palette
 * Color changes based on progress value for visual feedback
 */
const CustomProgressBar = ({ 
  value = 0, 
  width = 30,
  showPercentage = true,
  label = '',
  style = 'bar' // 'bar', 'gradient', 'segments'
}) => {
  // Ensure value is between 0 and 100
  const progress = Math.min(Math.max(value, 0), 100);
  
  // Calculate which color to use based on progress
  const getProgressColor = () => {
    if (progress >= 90) return PROGRESS_SHADES[0]; // #F204F1 - Brightest for high progress
    if (progress >= 70) return PROGRESS_SHADES[1]; // #CF00D0
    if (progress >= 50) return PROGRESS_SHADES[2]; // #AC00B0
    if (progress >= 25) return PROGRESS_SHADES[3]; // #890091
    return PROGRESS_SHADES[4]; // #670072 - Darkest for low progress
  };

  // Calculate filled width
  const filledWidth = Math.round((progress / 100) * width);
  const emptyWidth = width - filledWidth;

  if (style === 'gradient') {
    return renderGradientBar(progress, width, showPercentage, label);
  }

  if (style === 'segments') {
    return renderSegmentedBar(progress, width, showPercentage, label);
  }

  // Default bar style
  const progressColor = getProgressColor();
  const filledChar = '█';
  const emptyChar = '░';

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 0 },
    label && React.createElement(
      Text,
      { color: colorPalettes.dust.primary },
      label
    ),
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(
        Box,
        { flexDirection: 'row' },
        filledWidth > 0 && React.createElement(
          Text,
          { color: progressColor },
          filledChar.repeat(filledWidth)
        ),
        emptyWidth > 0 && React.createElement(
          Text,
          { color: colorPalettes.progressShades[4] },
          emptyChar.repeat(emptyWidth)
        )
      ),
      showPercentage && React.createElement(
        Text,
        { color: progressColor, bold: true },
        `${Math.round(progress)}%`
      )
    )
  );
};

/**
 * Renders a gradient-style progress bar
 * Uses different shades based on position
 */
const renderGradientBar = (progress, width, showPercentage, label) => {
  const filledWidth = Math.round((progress / 100) * width);
  const segments = [];

  // Create gradient effect by using different colors for different segments
  for (let i = 0; i < filledWidth; i++) {
    const segmentProgress = (i / width) * 100;
    let colorIndex;
    
    if (segmentProgress >= 80) colorIndex = 0;
    else if (segmentProgress >= 60) colorIndex = 1;
    else if (segmentProgress >= 40) colorIndex = 2;
    else if (segmentProgress >= 20) colorIndex = 3;
    else colorIndex = 4;

    segments.push(
      React.createElement(
        Text,
        { key: i, color: PROGRESS_SHADES[colorIndex] },
        '█'
      )
    );
  }

  // Add empty segments
  const emptyWidth = width - filledWidth;
  if (emptyWidth > 0) {
    segments.push(
      React.createElement(
        Text,
        { key: 'empty', color: colorPalettes.progressShades[4] },
        '░'.repeat(emptyWidth)
      )
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 0 },
    label && React.createElement(
      Text,
      { color: colorPalettes.dust.primary },
      label
    ),
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(
        Box,
        { flexDirection: 'row' },
        ...segments
      ),
      showPercentage && React.createElement(
        Text,
        { color: PROGRESS_SHADES[0], bold: true },
        `${Math.round(progress)}%`
      )
    )
  );
};

/**
 * Renders a segmented progress bar
 * Shows distinct color blocks for different progress ranges
 */
const renderSegmentedBar = (progress, width, showPercentage, label) => {
  const segmentSize = width / 5; // 5 segments for 5 colors
  const segments = [];

  for (let i = 0; i < 5; i++) {
    const segmentStart = i * 20; // Each segment represents 20%
    const segmentEnd = (i + 1) * 20;
    
    const isActive = progress > segmentStart;
    const segmentProgress = Math.min(Math.max(progress - segmentStart, 0), 20);
    const segmentWidth = Math.round((segmentProgress / 20) * segmentSize);
    
    if (isActive && segmentWidth > 0) {
      segments.push(
        React.createElement(
          Text,
          { key: `active-${i}`, color: PROGRESS_SHADES[i] },
          '█'.repeat(segmentWidth)
        )
      );
    }
    
    // Add empty part of segment
    const emptySegmentWidth = segmentSize - segmentWidth;
    if (emptySegmentWidth > 0) {
      segments.push(
        React.createElement(
          Text,
          { key: `empty-${i}`, color: colorPalettes.progressShades[4] },
          '░'.repeat(Math.round(emptySegmentWidth))
        )
      );
    }
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 0 },
    label && React.createElement(
      Text,
      { color: colorPalettes.dust.primary },
      label
    ),
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(
        Box,
        { flexDirection: 'row' },
        ...segments
      ),
      showPercentage && React.createElement(
        Text,
        { color: PROGRESS_SHADES[0], bold: true },
        `${Math.round(progress)}%`
      )
    )
  );
};

/**
 * Circular progress indicator using brand colors
 * Perfect for compact spaces
 */
const CircularProgress = ({ 
  value = 0, 
  size = 'small',
  showPercentage = true 
}) => {
  const progress = Math.min(Math.max(value, 0), 100);
  
  // Different circular characters based on progress
  const getCircularChar = () => {
    if (progress === 0) return '○';
    if (progress < 25) return '◔';
    if (progress < 50) return '◑';
    if (progress < 75) return '◕';
    if (progress < 100) return '●';
    return '●'; // Full circle for 100%
  };

  const getProgressColor = () => {
    if (progress >= 90) return PROGRESS_SHADES[0];
    if (progress >= 70) return PROGRESS_SHADES[1];
    if (progress >= 50) return PROGRESS_SHADES[2];
    if (progress >= 25) return PROGRESS_SHADES[3];
    return PROGRESS_SHADES[4];
  };

  const circleSize = size === 'large' ? 2 : 1;
  const color = getProgressColor();
  const char = getCircularChar();

  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 1 },
    React.createElement(
      Text,
      { color, bold: true },
      char.repeat(circleSize)
    ),
    showPercentage && React.createElement(
      Text,
      { color, bold: true },
      `${Math.round(progress)}%`
    )
  );
};

/**
 * Minimal progress dots
 * Shows progress as a series of colored dots
 */
const DotProgress = ({ 
  value = 0, 
  dots = 10,
  showPercentage = false 
}) => {
  const progress = Math.min(Math.max(value, 0), 100);
  const filledDots = Math.round((progress / 100) * dots);
  
  const dotElements = [];
  
  for (let i = 0; i < dots; i++) {
    const isFilled = i < filledDots;
    const dotProgress = (i / dots) * 100;
    
    let colorIndex;
    if (dotProgress >= 80) colorIndex = 0;
    else if (dotProgress >= 60) colorIndex = 1;
    else if (dotProgress >= 40) colorIndex = 2;
    else if (dotProgress >= 20) colorIndex = 3;
    else colorIndex = 4;

    dotElements.push(
      React.createElement(
        Text,
        { 
          key: i, 
          color: isFilled ? PROGRESS_SHADES[colorIndex] : 'gray',
          dimColor: !isFilled
        },
        isFilled ? '●' : '○'
      )
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 0 },
    ...dotElements,
    showPercentage && React.createElement(
      Text,
      { color: PROGRESS_SHADES[0], bold: true, marginLeft: 1 },
      `${Math.round(progress)}%`
    )
  );
};

export default CustomProgressBar;
export { CircularProgress, DotProgress };