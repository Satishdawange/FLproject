import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const envSheets =
    env.VITE_GOOGLE_SHEETS_URLS ||
    env.GOOGLE_SHEETS_URLS ||
    env.SHEETS_URLS ||
    env.VITE_SHEETS_URLS ||
    env.VITE_SHEET_URLS ||
    ''

  return {
    plugins: [react()],
    define: {
      'process.env.GOOGLE_SHEETS_URLS': JSON.stringify(envSheets),
    },
  }
})

