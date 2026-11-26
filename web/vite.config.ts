import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls to the NadeDeck server (npm run dev at the repo root starts both)
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
