import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colorPalettes } from '../theme/custom-theme.js';

/**
 * Simple select component with custom theme colors
 * Used by ConfigurationForm for option selection
 */
const SimpleSelect = ({ 
  options = [], 
  defaultValue = null, 
  onChange = () => {}, 
  onSubmit = () => {},
  isDisabled = false,
  placeholder = 'Select an option...',
  label = '',
  showNavigationHints = true
}) => {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (defaultValue) {
      const index = options.findIndex(opt => opt.value === defaultValue);
      return index >= 0 ? index : 0;
    }
    return 0;
  });

  const [isSubmitted, setIsSubmitted] = useState(false);

  useInput((input, key) => {
    if (isDisabled) return;
    
    // After submission, only block Enter key to prevent double submission
    if (isSubmitted && key.return) return;

    if (key.upArrow || input === 'k') {
      const newIndex = selectedIndex > 0 ? selectedIndex - 1 : options.length - 1;
      setSelectedIndex(newIndex);
      onChange(options[newIndex]?.value);
    }

    if (key.downArrow || input === 'j') {
      const newIndex = selectedIndex < options.length - 1 ? selectedIndex + 1 : 0;
      setSelectedIndex(newIndex);
      onChange(options[newIndex]?.value);
    }

    if (key.return) {
      if (options[selectedIndex]) {
        setIsSubmitted(true);
        onSubmit(options[selectedIndex].value);
      }
    }
  });

  if (options.length === 0) {
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      label && React.createElement(
        Text,
        { color: colorPalettes.dust.primary, bold: true },
        label
      ),
      React.createElement(
        Text,
        { color: colorPalettes.dust.tertiary },
        'No options available'
      )
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    label && React.createElement(
      Text,
      { color: colorPalettes.genericGradient[0], bold: true },
      label
    ),
    !isSubmitted && React.createElement(
      Box,
      { flexDirection: 'column', gap: 0 },
      options.map((option, index) => {
        const isSelected = index === selectedIndex;
        const isFocused = !isDisabled && index === selectedIndex;
        
        return React.createElement(
          Box,
          { key: option.value || index, flexDirection: 'row', gap: 1 },
          React.createElement(
            Text,
            { 
              color: isSelected ? colorPalettes.dust.primary : colorPalettes.dust.tertiary,
              bold: isSelected
            },
            isSelected ? '≫' : '  '
          ),
          React.createElement(
            Text,
            { 
              color: isSelected ? colorPalettes.dust.primary : colorPalettes.dust.tertiary,
              bold: isSelected
            },
            option.label || option.value
          )
        );
      }),
      !isDisabled && showNavigationHints && React.createElement(
        Text,
        { color: '#ac8500', marginTop: 1 },
        '↑↓: navigate • Enter: select'
      )
    ),
    isSubmitted && React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.collective.secondary, bold: true },
        '✓'
      ),
      React.createElement(
        Text,
        { color: 'white' },
        options[selectedIndex]?.label || options[selectedIndex]?.value
      )
    )
  );
};

/**
 * Compact select component for smaller spaces
 */
const CompactSelect = ({ 
  options = [], 
  defaultValue = null, 
  onChange = () => {},
  onSubmit = () => {},
  isDisabled = false,
  label = ''
}) => {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (defaultValue) {
      const index = options.findIndex(opt => opt.value === defaultValue);
      return index >= 0 ? index : 0;
    }
    return 0;
  });

  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useInput((input, key) => {
    if (isDisabled || isSubmitted) return;

    if (key.return) {
      if (!isOpen) {
        setIsOpen(true);
      } else if (options[selectedIndex]) {
        setIsSubmitted(true);
        setIsOpen(false);
        onSubmit(options[selectedIndex].value);
      }
    }

    if (key.escape && isOpen) {
      setIsOpen(false);
    }

    if (isOpen) {
      if (key.upArrow || input === 'k') {
        const newIndex = selectedIndex > 0 ? selectedIndex - 1 : options.length - 1;
        setSelectedIndex(newIndex);
        onChange(options[newIndex]?.value);
      }

      if (key.downArrow || input === 'j') {
        const newIndex = selectedIndex < options.length - 1 ? selectedIndex + 1 : 0;
        setSelectedIndex(newIndex);
        onChange(options[newIndex]?.value);
      }
    }
  });

  if (isSubmitted) {
    return React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      label && React.createElement(
        Text,
        { color: colorPalettes.dust.primary, bold: true },
        `${label}:`
      ),
      React.createElement(
        Text,
        { color: colorPalettes.collective.secondary, bold: true },
        '✓'
      ),
      React.createElement(
        Text,
        { color: 'white' },
        options[selectedIndex]?.label || options[selectedIndex]?.value
      )
    );
  }

  if (!isOpen) {
    return React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      label && React.createElement(
        Text,
        { color: colorPalettes.dust.primary, bold: true },
        `${label}:`
      ),
      React.createElement(
        Box,
        { 
          flexDirection: 'row', 
          gap: 1,
          borderStyle: 'round',
          borderColor: colorPalettes.dust.primary,
          paddingX: 1
        },
        React.createElement(
          Text,
          { color: 'white' },
          options[selectedIndex]?.label || 'Select...'
        ),
        React.createElement(
          Text,
          { color: colorPalettes.dust.primary },
          '▼'
        )
      ),
      !isDisabled && React.createElement(
        Text,
        { color: '#7e9400' },
        'Enter to open'
      )
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 0 },
    label && React.createElement(
      Text,
      { color: colorPalettes.genericGradient[0], bold: true, marginBottom: 1 },
      label
    ),
    React.createElement(
      Box,
      { 
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: colorPalettes.genericGradient[0],
        paddingX: 1,
        paddingY: 0
      },
      options.map((option, index) => {
        const isSelected = index === selectedIndex;
        
        return React.createElement(
          Text,
          { 
            key: option.value || index,
            color: isSelected ? colorPalettes.dust.primary : 'white',
            backgroundColor: isSelected ? colorPalettes.dust.secondary : undefined,
            bold: isSelected
          },
          `${isSelected ? '≫ ' : '  '}${option.label || option.value}`
        );
      })
    ),
    React.createElement(
      Text,
      { color: '#7e9400', marginTop: 1 },
      '↑/↓ Navigate • Enter Select • Esc Close'
    )
  );
};

export default SimpleSelect;
export { CompactSelect };