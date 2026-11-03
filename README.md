# Sistema Nutri

Aplicación de escritorio (Electron + React + TypeScript) para consultas de nutrición. Plan en `Planv1.md`, sprints y costos en `Sprints_v1.md`.

## Uso

Requisitos: Windows 10 u 11 y Node.js 22.12 o superior.

```bash
npm install          # instala dependencias y descarga Electron
npm run dev          # desarrollo con recarga automática
npm run build        # compila a out/
npm start            # abre la versión compilada
npm test             # pruebas (node:test)
npm run typecheck    # revisión de tipos
```

La primera vez pide el nombre del profesional y una contraseña, y muestra la **clave de recuperación**: hay que imprimirla, porque es la única forma de abrir los datos si se olvida la contraseña.

### En Docker (cualquier equipo)

`.devcontainer/` arma el entorno de desarrollo en un contenedor Linux con Node 24, sin instalar nada más en el equipo:

- **VS Code + Docker Desktop**: extensión "Dev Containers" → "Reopen in Container".
- **GitHub Codespaces**: desde el repositorio en GitHub, "Code → Codespaces"; funciona desde el navegador.

Al crearse instala las dependencias (`npm ci`). Dentro del contenedor:

```bash
npm run dev -- --noSandbox   # Docker no permite el sandbox de Chromium
```

La ventana se ve en el escritorio del puerto 6080 (`http://localhost:6080`, contraseña `vscode`). `npm test`, `npm run typecheck` y `npm run build` funcionan igual que en Windows.

Los datos que se creen en el contenedor (`~/.config/SistemaNutri`) son solo de prueba y se pierden al reconstruirlo. Los datos reales de pacientes no van al repositorio ni al contenedor.

## Datos

- `%APPDATA%\SistemaNutri\nutri.db`: base SQLite cifrada (formato SQLCipher 4).
- `%APPDATA%\SistemaNutri\claves.json`: clave de la base, cifrada con la contraseña. Se respalda junto con `nutri.db`.
- `NUTRI_DATOS=<carpeta>` cambia esa ubicación, para probar sin tocar los datos reales.
- La tabla MET se carga desde `MET.md` (Compendio 2011, 822 actividades) al crear o migrar la base.

## Estructura

```text
src/calculo/    motor de cálculo puro: catálogo de fórmulas de TMB y gasto semanal por MET
src/main/       backend: sesión y cifrado, base de datos y migraciones, pacientes, controles y rutina
src/preload/    puente window.nutri (única puerta de la ventana al backend)
src/renderer/   frontend React + Mantine
src/shared/     contratos Zod por canal y validaciones compartidas (RUT, edad)
test/           pruebas
```

## Diferencias con Planv1

- Una sola aplicación en vez de monorepo pnpm; el motor de cálculo vive en `src/calculo/`, sin dependencias de Electron.
- SQL directo con migraciones en `src/main/db.ts` (`PRAGMA user_version`) en vez de Drizzle.
- `node:test` en vez de Vitest, y `@mantine/form` en vez de React Hook Form.
