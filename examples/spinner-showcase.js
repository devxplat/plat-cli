#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import { Spinner } from '@inkjs/ui';
import chalk from 'chalk';

// Import our color palette
const colorPalettes = {
  dust: {
    primary: '#F204F1',
    secondary: '#50424F',
    tertiary: '#B7A6B5',
    accent: '#F35400',
  },
  collective: {
    primary: '#F204F1',
    secondary: '#FF00A7',
    accent: '#EB5D00',
  },
};

// All spinner frame sets
const spinnerFrameSets = {
  // Wave Comb variants
  'wave-comb-a': ['≈›', '≋›', '≈›', '≋›', '≈≫', '≋≫'],
  'wave-comb-b': ['~>', '~~>', '~~~>', '~~>', '~>'],
  'wave-comb-c': ['∿', '≈', '∿', '≈', '∿≈', '≈∿'],
  'wave-comb-d': ['≈', '≈≈', '≈≈≈', '≈≈', '≈'],
  'wave-comb-e': ['⁓›', '⁓⁓›', '⁓⁓⁓›', '⁓⁓›', '⁓›'],
  'wave-comb-f': ['≋❯', '≈❯', '∿❯', '≈❯', '≋❯'],
  
  // Sine Pulse variants
  'sine-pulse-a': ['∿', '≋', '∿', '≋', '∿', '≋'],
  'sine-pulse-b': ['⁓', '∿', '≋', '∿', '⁓'],
  'sine-pulse-c': ['⁓·', '⁓·', '⁓·', '⁓·', '⁓·'],
  'sine-pulse-d': ['~', '~~', '~~~', '~~', '~'],
  'sine-pulse-e': ['∿›', '≋›', '∿›', '≋›'],
  'sine-pulse-f': ['≈', '∿', '≈', '∿', '≈', '∿'],
  
  // Droplet variants
  'droplet-a': ['◌', '●', '◍', '◎'],
  'droplet-b': ['○', '◉', '●', '◉', '○'],
  'droplet-c': ['◔', '◑', '◕', '●', '◕', '◑', '◔', '○'],
  'droplet-d': ['·●', '··●', '···●', '··●', '·●'],
  'droplet-e': ['⠄⠄⠄', '⠆⠄⠄', '⠆⠆⠄', '⠆⠆⠆', '⠄⠆⠆', '⠄⠄⠆'],
  'droplet-f': ['◎', '◉', '●', '◉', '◎'],
};

// Custom spinner component that uses our frames
const CustomSpinner = ({ frames, label, color }) => {
  const [frame, setFrame] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, 80);
    
    return () => clearInterval(timer);
  }, [frames]);
  
  return React.createElement(Box, { gap: 1 },
    React.createElement(Text, { color: color }, frames[frame]),
    React.createElement(Text, { dimColor: true }, label)
  );
};

// Main app component
const SpinnerShowcase = () => {
  const [currentSet, setCurrentSet] = useState(0);
  const spinnerGroups = [
    { name: 'Wave Comb Variants', prefix: 'wave-comb' },
    { name: 'Sine Pulse Variants', prefix: 'sine-pulse' },
    { name: 'Droplet Variants', prefix: 'droplet' }
  ];
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSet(prev => (prev + 1) % spinnerGroups.length);
    }, 10000); // Change group every 10 seconds
    
    return () => clearInterval(timer);
  }, []);
  
  const currentGroup = spinnerGroups[currentSet];
  const variants = ['a', 'b', 'c', 'd', 'e', 'f'];
  
  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { bold: true, color: colorPalettes.dust.primary },
      '⎯⎯⎯ Spinner Showcase ⎯⎯⎯'
    ),
    React.createElement(Text, null, ''),
    React.createElement(Text, { bold: true, color: colorPalettes.collective.secondary },
      currentGroup.name
    ),
    React.createElement(Text, null, ''),
    React.createElement(Box, { flexDirection: 'column', gap: 1 },
      ...variants.map(variant => {
        const key = `${currentGroup.prefix}-${variant}`;
        const frames = spinnerFrameSets[key];
        if (!frames) return null;
        
        const colors = [
          colorPalettes.dust.primary,
          colorPalettes.dust.accent,
          colorPalettes.collective.secondary,
          colorPalettes.collective.accent,
          colorPalettes.dust.tertiary,
          colorPalettes.dust.secondary
        ];
        
        const colorIndex = variants.indexOf(variant);
        
        return React.createElement(Box, { key: key, gap: 2 },
          React.createElement(Text, { dimColor: true, width: 15 }, 
            `${currentGroup.prefix}-${variant}:`
          ),
          React.createElement(CustomSpinner, {
            frames: frames,
            label: `[${frames.join(' ')}]`,
            color: colors[colorIndex]
          })
        );
      })
    ),
    React.createElement(Text, null, ''),
    React.createElement(Text, { dimColor: true },
      'Press Ctrl+C to exit | Groups rotate every 10 seconds'
    )
  );
};

// Render the app
const app = render(React.createElement(SpinnerShowcase));

// Handle graceful exit
process.on('SIGINT', () => {
  app.unmount();
  process.exit(0);
});