import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': 'http://localhost:4000'
    }
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['.onrender.com', 'localhost']
  }
})
