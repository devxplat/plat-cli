import React from 'react';
import { Box, Text } from 'ink';
import { colorPalettes } from '../theme/custom-theme.js';

/**
 * Custom Alert component without padding/margins for compact display
 */
const CustomAlert = ({ variant, title, children }) => {
  const variantColors = {
    success: { border: colorPalettes.collective.secondary, icon: '✓' },
    error: { border: colorPalettes.dust.accent, icon: '⚠' },
    warning: { border: colorPalettes.collective.accent, icon: '!' },
    info: { border: colorPalettes.dust.tertiary, icon: 'ℹ' }
  };

  const config = variantColors[variant] || variantColors.info;

  return React.createElement(
    Box,
    { 
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: config.border,
      paddingX: 1
    },
    title && React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(
        Text,
        { color: config.border, bold: true },
        config.icon
      ),
      React.createElement(
        Text,
        { color: colorPalettes.dust.primary, bold: true },
        title
      )
    ),
    children && React.createElement(
      Text,
      { color: 'white' },
      children
    )
  );
};

export default CustomAlert;