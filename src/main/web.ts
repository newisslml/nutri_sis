// Modo web solo para pruebas automáticas (AgenteQA en Docker): la misma app en el navegador, sin Electron.
// Sirve el renderer compilado y atiende los canales por POST /api/<canal>; sin PDF.
// No usar con datos reales: no hay más control de acceso que la contraseña de la app.
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { crearCanales } from './canales'

const carpeta = process.env.NUTRI_DATOS ?? join(process.cwd(), 'datos-prueba')
mkdirSync(carpeta, { recursive: true })
const canales = crearCanales(carpeta)
canales.manejar('archivos.guardarPdf', () => {
  throw new Error('El PDF solo se genera en la app de escritorio')
})
canales.manejar('archivos.elegirCarpeta', () => {
  throw new Error('Elegir carpetas solo funciona en la app de escritorio')
})

const RAIZ = resolve(__dirname, '../renderer')
const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
}
const HOST = process.env.HOST ?? '127.0.0.1'
const PORT = Number(process.env.PORT ?? 8080)

createServer(async (req, res) => {
  // new URL ya resuelve los "..": una ruta fuera de RAIZ igual se descarta abajo.
  const { pathname } = new URL(req.url ?? '/', 'http://localhost')
  if (req.method === 'POST' && pathname.startsWith('/api/')) {
    let cuerpo = ''
    for await (const parte of req) cuerpo += parte
    let entrada: unknown
    try {
      entrada = (JSON.parse(cuerpo || '{}') as { entrada?: unknown }).entrada
    } catch {
      res.writeHead(400).end()
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(await canales.atender(pathname.slice(5), entrada)))
    return
  }
  // HashRouter: lo que no sea un archivo del build es la app.
  const pedido = resolve(RAIZ, '.' + pathname)
  const archivo = pedido.startsWith(RAIZ + sep) && existsSync(pedido) && statSync(pedido).isFile() ? pedido : join(RAIZ, 'index.html')
  res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream' }).end(readFileSync(archivo))
}).listen(PORT, HOST, () => console.log(`Sistema Nutri (modo web de prueba) en http://${HOST}:${PORT}, datos en ${carpeta}`))
