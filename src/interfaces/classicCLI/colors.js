import chalk from 'chalk';

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
};

// Create chalk instances for our colors
const colors = {
  primary: chalk.hex(colorPalettes.dust.primary),
  secondary: chalk.hex(colorPalettes.dust.secondary),
  tertiary: chalk.hex(colorPalettes.dust.tertiary),
  accent: chalk.hex(colorPalettes.dust.accent),
  collectivePrimary: chalk.hex(colorPalettes.collective.primary),
  collectiveSecondary: chalk.hex(colorPalettes.collective.secondary),
  collectiveAccent: chalk.hex(colorPalettes.collective.accent),
  success: chalk.hex(colorPalettes.collective.secondary), // Pink for success
  error: chalk.hex(colorPalettes.dust.accent),           // Orange for error
  warning: chalk.hex(colorPalettes.collective.accent),   // Orange for warning
  info: chalk.hex(colorPalettes.dust.tertiary),         // Light for info
};

export { colors, colorPalettes };
export default colors;