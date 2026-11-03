import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// CSP solo en la versión compilada: en desarrollo React inyecta un script inline para recarga rápida.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
const csp = {
  name: 'csp',
  apply: 'build' as const,
  transformIndexHtml: (html: string) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
}

export default defineConfig({
  // web: modo web de prueba para AgenteQA (Dockerfile), comparte los canales con la app de escritorio.
  main: { build: { rollupOptions: { input: { index: 'src/main/index.ts', web: 'src/main/web.ts' } } } },
  preload: {},
  renderer: { plugins: [react(), csp] }
})
