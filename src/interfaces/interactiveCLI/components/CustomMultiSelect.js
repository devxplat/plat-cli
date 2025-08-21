import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colorPalettes } from '../theme/custom-theme.js';

/**
 * Custom MultiSelect component with consistent theme
 * Based on SimpleSelect but allows multiple selections
 * Uses ≫ symbol for focused items and consistent color scheme
 */
const CustomMultiSelect = ({ 
  options = [], 
  defaultValue = [], 
  onChange = () => {}, 
  onSubmit = () => {},
  isDisabled = false,
  placeholder = 'Select options...',
  label = '',
  showNavigationHints = true
}) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedValues, setSelectedValues] = useState(new Set(defaultValue));
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useInput((input, key) => {
    if (isDisabled || isSubmitted) return;

    // Navigation
    if (key.upArrow || input === 'k') {
      const newIndex = focusedIndex > 0 ? focusedIndex - 1 : options.length - 1;
      setFocusedIndex(newIndex);
    }

    if (key.downArrow || input === 'j') {
      const newIndex = focusedIndex < options.length - 1 ? focusedIndex + 1 : 0;
      setFocusedIndex(newIndex);
    }

    // Selection toggle with Space
    if (input === ' ') {
      const currentOption = options[focusedIndex];
      if (currentOption) {
        const newSelected = new Set(selectedValues);
        if (newSelected.has(currentOption.value)) {
          newSelected.delete(currentOption.value);
        } else {
          newSelected.add(currentOption.value);
        }
        setSelectedValues(newSelected);
        onChange(Array.from(newSelected));
        
        // Clear any error when user makes a selection
        if (error) {
          setError(null);
        }
      }
    }

    // Confirm selection with Enter
    if (key.return) {
      // Validate selection before submitting
      if (selectedValues.size === 0) {
        setError('Please select at least one instance');
        return;
      }
      
      // Clear any previous error and submit
      setError(null);
      setIsSubmitted(true);
      onSubmit(Array.from(selectedValues));
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

  if (isSubmitted) {
    const selectedLabels = options
      .filter(opt => selectedValues.has(opt.value))
      .map(opt => opt.label || opt.value);
    
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      label && React.createElement(
        Text,
        { color: colorPalettes.dust.primary, bold: true },
        label
      ),
      React.createElement(
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
          `${selectedLabels.length} selected: ${selectedLabels.slice(0, 2).join(', ')}${selectedLabels.length > 2 ? `... (+${selectedLabels.length - 2} more)` : ''}`
        )
      )
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 0 },
    label && React.createElement(
      Text,
      { color: colorPalettes.genericGradient[0], bold: true },
      label
    ),
    React.createElement(
      Box,
      { flexDirection: 'column', gap: 0 },
      options.map((option, index) => {
        const isFocused = index === focusedIndex;
        const isSelected = selectedValues.has(option.value);
        
        // Focus indicator (≫ symbol like SimpleSelect)
        const focusSymbol = isFocused ? '≫' : '  ';
        
        // Selection checkbox
        const checkbox = isSelected ? '☑' : '☐';
        
        return React.createElement(
          Box,
          { key: option.value || index, flexDirection: 'row', gap: 0 },
          // Focus indicator
          React.createElement(
            Text,
            { 
              color: isFocused ? colorPalettes.dust.primary : colorPalettes.dust.tertiary,
              bold: isFocused
            },
            focusSymbol
          ),
          // Selection checkbox  
          React.createElement(
            Text,
            { 
              color: isSelected ? colorPalettes.dust.primary : colorPalettes.dust.tertiary,
              bold: isSelected
            },
            ` ${checkbox} `
          ),
          // Option text
          React.createElement(
            Text,
            { 
              color: isFocused ? colorPalettes.dust.primary : colorPalettes.dust.tertiary,
              bold: isFocused
            },
            option.label || option.value
          )
        );
      })
    ),
    !isDisabled && showNavigationHints && React.createElement(
      Text,
      { color: '#ac8500', marginTop: 1 },
      '↑↓: navigate • Space: toggle • Enter: confirm'
    ),
    selectedValues.size > 0 && !isSubmitted && React.createElement(
      Text,
      { color: colorPalettes.dust.primary, marginTop: 1 },
      `${selectedValues.size} item${selectedValues.size === 1 ? '' : 's'} selected`
    ),
    // Display error message if validation failed
    error && React.createElement(
      Box,
      { flexDirection: 'row', gap: 1, marginTop: 1 },
      React.createElement(
        Text,
        { color: '#ff0000', bold: true },
        '✘'
      ),
      React.createElement(
        Text,
        { color: '#ff0000' },
        error
      )
    )
  );
};

export default CustomMultiSelect;