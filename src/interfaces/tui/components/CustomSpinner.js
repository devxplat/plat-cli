import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { colorPalettes } from '../theme/custom-theme.js';

// Spinner frame sequence as specified
const SPINNER_FRAMES = ['∿', '≋', '∿', '≋', '∿', '≋'];

// Spinner color sequence
const SPINNER_COLORS = colorPalettes.spinnerColors;

// Animation interval (80-120ms as recommended)
const ANIMATION_INTERVAL = 100;

/**
 * Custom animated spinner with brand colors and frame sequence
 * Implements the specified frame sequence: ['∿', '≋', '∿', '≋', '∿', '≋']
 * And color sequence: #F204F1 #FF9DFF #E900E8 #9A009F #73007C
 */
const CustomSpinner = ({ 
  label = '', 
  isVisible = true,
  status = 'running', // 'running', 'success', 'error'
  compact = false 
}) => {
  const [frameIndex, setFrameIndex] = useState(0);
  const [colorIndex, setColorIndex] = useState(0);

  useEffect(() => {
    if (!isVisible || status !== 'running') {
      return;
    }

    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
      setColorIndex((prev) => (prev + 1) % SPINNER_COLORS.length);
    }, ANIMATION_INTERVAL);

    return () => clearInterval(interval);
  }, [isVisible, status]);

  if (!isVisible) {
    return null;
  }

  // Handle final states
  const getFinalStateDisplay = () => {
    switch (status) {
      case 'success':
        return {
          frame: '✓',
          color: colorPalettes.matchingGradient[4], // Green-ish color
        };
      case 'error':
        return {
          frame: '✗',
          color: colorPalettes.classyPalette[4], // Red color
        };
      default:
        return {
          frame: SPINNER_FRAMES[frameIndex],
          color: SPINNER_COLORS[colorIndex],
        };
    }
  };

  const { frame, color } = getFinalStateDisplay();

  if (compact) {
    return React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(
        Text,
        { color, bold: true },
        frame
      ),
      label && React.createElement(
        Text,
        { color: colorPalettes.genericGradient[0] },
        label
      )
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 1 },
    React.createElement(
      Text,
      { color, bold: true },
      frame
    ),
    label && React.createElement(
      Text,
      { color: colorPalettes.genericGradient[0] },
      label
    )
  );
};

/**
 * Advanced spinner with multiple animation modes
 * Supports wave-like motion and color transitions
 */
const WaveSpinner = ({ 
  label = '', 
  isVisible = true,
  status = 'running',
  waveLength = 3 
}) => {
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    if (!isVisible || status !== 'running') {
      return;
    }

    const interval = setInterval(() => {
      setAnimationStep((prev) => (prev + 1) % (SPINNER_FRAMES.length * SPINNER_COLORS.length));
    }, ANIMATION_INTERVAL);

    return () => clearInterval(interval);
  }, [isVisible, status]);

  if (!isVisible) {
    return null;
  }

  if (status === 'success') {
    return React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.matchingGradient[4], bold: true },
        '✓'
      ),
      label && React.createElement(
        Text,
        { color: colorPalettes.genericGradient[0] },
        label
      )
    );
  }

  if (status === 'error') {
    return React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.classyPalette[4], bold: true },
        '✗'
      ),
      label && React.createElement(
        Text,
        { color: colorPalettes.genericGradient[0] },
        label
      )
    );
  }

  // Create wave effect with multiple frames
  const waveFrames = [];
  for (let i = 0; i < waveLength; i++) {
    const frameIndex = (animationStep + i) % SPINNER_FRAMES.length;
    const colorIndex = (animationStep + i) % SPINNER_COLORS.length;
    
    waveFrames.push(
      React.createElement(
        Text,
        { 
          key: i,
          color: SPINNER_COLORS[colorIndex], 
          bold: true,
          dimColor: i > 0 // Make trailing frames dimmer
        },
        SPINNER_FRAMES[frameIndex]
      )
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 0 },
    ...waveFrames,
    label && React.createElement(
      Text,
      { color: colorPalettes.genericGradient[0], marginLeft: 1 },
      label
    )
  );
};

/**
 * Flow-style spinner with continuous wave motion
 * Perfect for "flow" aesthetic as mentioned in requirements
 */
const FlowSpinner = ({ 
  label = '', 
  isVisible = true,
  status = 'running' 
}) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!isVisible || status !== 'running') {
      return;
    }

    const interval = setInterval(() => {
      setPhase((prev) => (prev + 1) % 12); // 12 phases for smooth flow
    }, ANIMATION_INTERVAL);

    return () => clearInterval(interval);
  }, [isVisible, status]);

  if (!isVisible) {
    return null;
  }

  if (status === 'success') {
    return React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.matchingGradient[4], bold: true },
        '✓'
      ),
      label && React.createElement(
        Text,
        { color: colorPalettes.genericGradient[0] },
        label
      )
    );
  }

  if (status === 'error') {
    return React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.classyPalette[4], bold: true },
        '✗'
      ),
      label && React.createElement(
        Text,
        { color: colorPalettes.genericGradient[0] },
        label
      )
    );
  }

  // Create flowing animation with Unicode waves
  const flowPatterns = [
    '∿≋∿',
    '≋∿≋', 
    '∿≋∿',
    '≋∿≋',
    '∿≋∿',
    '≋∿≋'
  ];
  
  const pattern = flowPatterns[phase % flowPatterns.length];
  const colorIndex = phase % SPINNER_COLORS.length;

  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 1 },
    React.createElement(
      Text,
      { color: SPINNER_COLORS[colorIndex], bold: true },
      pattern
    ),
    label && React.createElement(
      Text,
      { color: colorPalettes.genericGradient[0] },
      label
    )
  );
};

/**
 * Shimmer spinner with traveling glow effect
 * Creates a smooth wave of light that passes through the text
 */
const ShimmerSpinner = ({ 
  label = 'Migration in progress...', 
  isVisible = true,
  status = 'running',
  baseColor = '#F204F1',
  glowSpeed = 120, // ms per character
  glowWidth = 2, // number of characters affected by glow
  showIcon = true // whether to show animated ASCII icon
}) => {
  const [glowPosition, setGlowPosition] = useState(-glowWidth);
  const [frameIndex, setFrameIndex] = useState(0);
  const [colorIndex, setColorIndex] = useState(0);
  
  // Define shimmer color gradients
  const shimmerColors = {
    purple: {
      base: '#F204F1',
      light1: '#F655F2', // Slightly lighter
      light2: '#FA88F5', // Medium light
      peak: '#FF9DFF'    // Lightest
    },
    pink: {
      base: '#FF00A7',
      light1: '#FF33B8',
      light2: '#FF66C9',
      peak: '#FFB3E3'
    },
    collective: {
      base: '#EB5D00',
      light1: '#F07320',
      light2: '#F58940',
      peak: '#FFAB6B'
    }
  };
  
  // Select color scheme based on baseColor
  const colorScheme = baseColor === '#FF00A7' ? shimmerColors.pink : 
                      baseColor === '#EB5D00' ? shimmerColors.collective : 
                      shimmerColors.purple;
  
  useEffect(() => {
    if (!isVisible || status !== 'running') {
      return;
    }
    
    // Shimmer animation
    const shimmerInterval = setInterval(() => {
      setGlowPosition((prev) => {
        // Always move to the right
        const next = prev + 1;
        
        // When it reaches the end, reset to start
        if (next > label.length + glowWidth) {
          return -glowWidth;
        }
        
        return next;
      });
    }, glowSpeed);
    
    // ASCII frame animation (if icon is shown)
    let frameInterval;
    if (showIcon) {
      frameInterval = setInterval(() => {
        setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
        setColorIndex((prev) => (prev + 1) % SPINNER_COLORS.length);
      }, ANIMATION_INTERVAL);
    }
    
    return () => {
      clearInterval(shimmerInterval);
      if (frameInterval) clearInterval(frameInterval);
    };
  }, [isVisible, status, label.length, glowSpeed, glowWidth, showIcon]);
  
  if (!isVisible) {
    return null;
  }
  
  // Handle completion states
  if (status === 'success') {
    return React.createElement(
      Box,
      { flexDirection: 'row', gap: 0 },
      React.createElement(
        Text,
        { color: colorPalettes.matchingGradient[4], bold: true },
        '✓ '
      ),
      React.createElement(
        Text,
        { color: colorPalettes.genericGradient[0] },
        label
      )
    );
  }
  
  if (status === 'error') {
    return React.createElement(
      Box,
      { flexDirection: 'row', gap: 0 },
      React.createElement(
        Text,
        { color: colorPalettes.classyPalette[4], bold: true },
        '✗ '
      ),
      React.createElement(
        Text,
        { color: colorPalettes.genericGradient[0] },
        label
      )
    );
  }
  
  // Render shimmering text
  const renderShimmerText = () => {
    return label.split('').map((char, index) => {
      // Calculate distance from glow center
      const distance = Math.abs(index - glowPosition);
      
      let color;
      let bold = false;
      
      if (distance === 0) {
        // Peak glow position
        color = colorScheme.peak;
        bold = true;
      } else if (distance === 1) {
        // Adjacent to glow - medium bright
        color = colorScheme.light2;
      } else if (distance === 2 && glowWidth > 2) {
        // Secondary glow area
        color = colorScheme.light1;
      } else {
        // Base color
        color = colorScheme.base;
      }
      
      // Special handling for spaces - maintain consistent width
      if (char === ' ') {
        return React.createElement(
          Text,
          { key: index },
          ' '
        );
      }
      
      return React.createElement(
        Text,
        { 
          key: index,
          color: color,
          bold: bold
        },
        char
      );
    });
  };
  
  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 1 },
    // Show animated ASCII icon if enabled
    showIcon && React.createElement(
      Text,
      { 
        color: SPINNER_COLORS[colorIndex],
        bold: true
      },
      SPINNER_FRAMES[frameIndex]
    ),
    // Show shimmering text
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 0 },
      ...renderShimmerText()
    )
  );
};

export default CustomSpinner;
export { WaveSpinner, FlowSpinner, ShimmerSpinner };