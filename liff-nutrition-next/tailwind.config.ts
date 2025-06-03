// Use interface instead of import type to avoid module resolution issues
interface TailwindConfig {
  content: string[]
  theme?: {
    extend?: Record<string, any>
  }
  plugins?: any[]
}

const config: TailwindConfig = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
    },
  },
  plugins: [],
}

export default config
