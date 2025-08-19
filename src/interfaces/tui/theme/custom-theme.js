import { extendTheme, defaultTheme } from '@inkjs/ui';

// Simplified color palettes as requested
const colorPalettes = {
  // Dust Palette (main UI colors)
  dust: {
    primary: '#F204F1',    // Primary brand color
    secondary: '#50424F',  // Dark secondary
    tertiary: '#B7A6B5',   // Light tertiary
    accent: '#F35400',     // Orange accent
  },
  
  // Collective Palette (emphasis and highlights)
  collective: {
    primary: '#F204F1',    // Primary brand color
    secondary: '#FF00A7',  // Pink secondary
    accent: '#EB5D00',     // Orange accent
  },
  
  // Keep spinner colors for animated sequence
  spinnerColors: ['#F204F1', '#FF9DFF', '#E900E8', '#9A009F', '#73007C'],
  
  // Keep progress shades for gradient effect
  progressShades: ['#F204F1', '#CF00D0', '#AC00B0', '#890091', '#670072'],
  
  // Legacy mappings for backwards compatibility
  // These map old references to new simplified palette
  shades: ['#F204F1', '#CF00D0', '#AC00B0', '#890091', '#670072'],
  genericGradient: ['#F204F1', '#FF00A7', '#EB5D00', '#F35400', '#B7A6B5', '#50424F'],
  matchingGradient: ['#F204F1', '#FF00A7', '#F204F1', '#B7A6B5', '#50424F', '#50424F'],
  spotPalette: ['#F204F1', '#B7A6B5', '#50424F', '#FF00A7'],
  twistedSpotPalette: ['#F204F1', '#EB5D00', '#F35400', '#50424F'],
  classyPalette: ['#F204F1', '#50424F', '#B7A6B5', '#F35400', '#F35400']
};

// Spinner frame sequence as specified
const spinnerFrames = ['∿', '≋', '∿', '≋', '∿', '≋'];

// Helper function to get progress bar color based on progress value
const getProgressBarColor = (progress = 0) => {
  const { shades } = colorPalettes;
  
  if (progress >= 100) return shades[0]; // Primary color for complete
  if (progress >= 80) return shades[1];
  if (progress >= 60) return shades[2];
  if (progress >= 40) return shades[3];
  
  return shades[4]; // Darkest shade for low progress
};

// Helper function to cycle through spinner colors
let spinnerColorIndex = 0;
const getSpinnerColor = () => {
  const color = colorPalettes.spinnerColors[spinnerColorIndex];
  spinnerColorIndex = (spinnerColorIndex + 1) % colorPalettes.spinnerColors.length;
  return color;
};

// Custom theme configuration
const customTheme = extendTheme(defaultTheme, {
  components: {
    // Custom Spinner theme
    Spinner: {
      styles: {
        container: () => ({
          gap: 1,
        }),
        frame: () => ({
          color: getSpinnerColor(),
          bold: true,
        }),
        label: () => ({
          color: colorPalettes.dust.primary, // Primary brand color
        }),
      },
      config: () => ({
        frames: spinnerFrames,
        interval: 100, // 100ms for smooth animation
      }),
    },
    
    // Custom ProgressBar theme  
    ProgressBar: {
      styles: {
        container: () => ({
          flexDirection: 'row',
        }),
        bar: ({ value = 0 }) => ({
          color: getProgressBarColor(value),
          backgroundColor: colorPalettes.shades[4], // Dark base color
        }),
        progress: ({ value = 0 }) => ({
          color: getProgressBarColor(value),
          bold: true,
        }),
      },
    },
    
    // Custom Alert theme using simplified colors
    Alert: {
      styles: {
        container: (props = {}) => {
          const variant = props.variant || 'info';
          const variantColors = {
            success: colorPalettes.collective.secondary, // Pink for success
            error: colorPalettes.dust.accent,           // Orange for error
            warning: colorPalettes.collective.accent,    // Orange for warning
            info: colorPalettes.dust.tertiary,          // Light for info
          };
          
          return {
            borderColor: variantColors[variant] || variantColors.info,
            borderStyle: 'round',
            padding: 1,
          };
        },
        icon: (props = {}) => {
          const variant = props.variant || 'info';
          const variantColors = {
            success: colorPalettes.collective.secondary,
            error: colorPalettes.dust.accent,
            warning: colorPalettes.collective.accent,
            info: colorPalettes.dust.tertiary,
          };
          
          return {
            color: variantColors[variant] || variantColors.info,
            bold: true,
          };
        },
        message: (props = {}) => ({
          color: 'white',
        }),
        title: (props = {}) => ({
          color: colorPalettes.dust.primary,
          bold: true,
        }),
      },
    },
    
    // Custom Badge theme
    Badge: {
      styles: {
        container: (props = {}) => {
          const color = props.color || 'blue';
          const badgeColors = {
            green: colorPalettes.collective.secondary,
            red: colorPalettes.dust.accent,
            yellow: colorPalettes.collective.accent,
            blue: colorPalettes.dust.tertiary,
            magenta: colorPalettes.dust.primary,
            cyan: colorPalettes.collective.secondary,
          };
          
          return {
            backgroundColor: badgeColors[color] || badgeColors.blue,
            color: 'white',
            paddingX: 1,
            borderRadius: 1,
          };
        },
        text: (props = {}) => ({
          color: 'white',
          bold: true,
        }),
      },
    },
    
    // Custom StatusMessage theme
    StatusMessage: {
      styles: {
        container: (props = {}) => ({
          gap: 1,
        }),
        icon: (props = {}) => {
          const variant = props.variant || 'info';
          const variantColors = {
            success: colorPalettes.collective.secondary,
            error: colorPalettes.dust.accent,
            warning: colorPalettes.collective.accent,
            info: colorPalettes.dust.tertiary,
          };
          
          return {
            color: variantColors[variant] || variantColors.info,
            bold: true,
          };
        },
        message: (props = {}) => ({
          color: 'white',
        }),
      },
    },
    
    // Custom Select theme
    Select: {
      styles: {
        container: (props = {}) => ({
          flexDirection: 'column',
        }),
        option: (props = {}) => {
          const isSelected = props.isSelected || false;
          const isFocused = props.isFocused || false;
          let color = 'white';
          let backgroundColor = undefined;
          
          if (isSelected) {
            color = 'white';
            backgroundColor = colorPalettes.dust.primary;
          } else if (isFocused) {
            color = colorPalettes.dust.primary;
            backgroundColor = colorPalettes.dust.tertiary;
          }
          
          return {
            color,
            backgroundColor,
            paddingX: 1,
          };
        },
        indicator: (props = {}) => {
          const isSelected = props.isSelected || false;
          return {
            color: isSelected ? 'white' : colorPalettes.dust.primary,
            bold: true,
          };
        },
      },
    },
    
    // Custom MultiSelect theme
    MultiSelect: {
      styles: {
        container: (props = {}) => ({
          flexDirection: 'column',
        }),
        option: (props = {}) => {
          const isSelected = props.isSelected || false;
          const isFocused = props.isFocused || false;
          let color = 'white';
          let backgroundColor = undefined;
          
          if (isSelected) {
            color = 'white';
            backgroundColor = colorPalettes.dust.primary;
          } else if (isFocused) {
            color = colorPalettes.dust.primary;
            backgroundColor = colorPalettes.dust.tertiary;
          }
          
          return {
            color,
            backgroundColor,
            paddingX: 1,
          };
        },
        checkbox: (props = {}) => {
          const isSelected = props.isSelected || false;
          return {
            color: isSelected ? colorPalettes.dust.primary : colorPalettes.dust.secondary,
            bold: true,
          };
        },
      },
    },
    
    // Custom TextInput theme
    TextInput: {
      styles: {
        container: (props = {}) => ({
          borderStyle: 'round',
          borderColor: colorPalettes.dust.primary,
          paddingX: 1,
        }),
        input: (props = {}) => ({
          color: 'white',
        }),
        placeholder: (props = {}) => ({
          color: colorPalettes.dust.secondary,
        }),
        cursor: (props = {}) => ({
          color: colorPalettes.dust.primary,
          inverse: true,
        }),
      },
    },
    
    // Custom PasswordInput theme (inherits from TextInput)
    PasswordInput: {
      styles: {
        container: (props = {}) => ({
          borderStyle: 'round',
          borderColor: colorPalettes.dust.primary,
          paddingX: 1,
        }),
        input: (props = {}) => ({
          color: 'white',
        }),
        placeholder: (props = {}) => ({
          color: colorPalettes.dust.secondary,
        }),
        cursor: (props = {}) => ({
          color: colorPalettes.dust.primary,
          inverse: true,
        }),
      },
    },
    
    // Custom EmailInput theme (inherits from TextInput)
    EmailInput: {
      styles: {
        container: (props = {}) => ({
          borderStyle: 'round',
          borderColor: colorPalettes.dust.primary,
          paddingX: 1,
        }),
        input: (props = {}) => ({
          color: 'white',
        }),
        placeholder: (props = {}) => ({
          color: colorPalettes.dust.secondary,
        }),
        suggestion: (props = {}) => ({
          color: colorPalettes.dust.tertiary,
          dimColor: true,
        }),
        cursor: (props = {}) => ({
          color: colorPalettes.dust.primary,
          inverse: true,
        }),
      },
    },
    
    // Custom ConfirmInput theme
    ConfirmInput: {
      styles: {
        container: (props = {}) => ({
          gap: 1,
        }),
        prompt: (props = {}) => ({
          color: colorPalettes.dust.primary,
          bold: true,
        }),
        option: (props = {}) => {
          const isSelected = props.isSelected || false;
          return {
            color: isSelected ? colorPalettes.dust.primary : colorPalettes.dust.tertiary,
            bold: isSelected,
            inverse: isSelected,
          };
        },
      },
    },
    
    // Custom UnorderedList theme
    UnorderedList: {
      styles: {
        container: (props = {}) => ({
          flexDirection: 'column',
        }),
        item: (props = {}) => ({
          color: 'white',
        }),
        marker: (props = {}) => ({
          color: colorPalettes.dust.primary,
          bold: true,
        }),
      },
      config: (props = {}) => ({
        marker: '▸', // Custom marker character
      }),
    },
    
    // Custom OrderedList theme
    OrderedList: {
      styles: {
        container: (props = {}) => ({
          flexDirection: 'column',
        }),
        item: (props = {}) => ({
          color: 'white',
        }),
        number: (props = {}) => ({
          color: colorPalettes.dust.primary,
          bold: true,
        }),
      },
    },
  },
});

// Export the custom theme and color palettes for use in other components
export { customTheme, colorPalettes, spinnerFrames };
export default customTheme;