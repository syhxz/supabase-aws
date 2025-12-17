import localFont from 'next/font/local'

export const customFont = localFont({
  variable: '--font-custom',
  display: 'swap',
  fallback: ['Circular', 'custom-font', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
  src: [
    {
      path: './CustomFont-Book.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './CustomFont-BookItalic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: './CustomFont-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './CustomFont-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: './CustomFont-BoldItalic.woff2',
      weight: '700',
      style: 'italic',
    },
    {
      path: './CustomFont-Black.woff2',
      weight: '800',
      style: 'normal',
    },
    {
      path: './CustomFont-BlackItalic.woff2',
      weight: '800',
      style: 'italic',
    },
  ],
})

// Use CSS-only font configuration to avoid Google Fonts network issues during build
export const sourceCodePro = {
  variable: '--font-source-code-pro',
  className: 'font-mono',
  style: {
    fontFamily: 'Source Code Pro, Office Code Pro, Menlo, Monaco, Consolas, monospace',
  },
}
