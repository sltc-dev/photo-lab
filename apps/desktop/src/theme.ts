import { createTheme } from '@mantine/core';

export const theme = createTheme({
  defaultRadius: 'sm',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  primaryColor: 'photoBlue',
  colors: {
    photoBlue: [
      '#eef5ff',
      '#dbe9ff',
      '#b7d1ff',
      '#8fb5f5',
      '#6898e8',
      '#477ed7',
      '#2f68c4',
      '#23539f',
      '#1b417d',
      '#15325f',
    ],
  },
  headings: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: '650',
  },
});
