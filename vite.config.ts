import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'cookie',
      'style-to-js',
      'lucide-react',
      'react-markdown',
      'remark-gfm',
      'rehype-highlight',
      'reactflow',
      'axios',
      'zustand',
    ],
  },
})
