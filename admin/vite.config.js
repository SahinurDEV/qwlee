import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Serve the admin under a sub-path (e.g. /admin/) by setting VITE_BASE_PATH at build time.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Specify your IP address here
    port: 4000, // Optionally specify a port
  },
})
