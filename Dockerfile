# Modo web de prueba para AgenteQA: la app en el navegador, sin Electron (src/main/web.ts). No usar con datos reales.
FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: no descarga Electron, que aquí no se usa; SQLite trae su binario para Linux.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
ENV HOST=0.0.0.0 PORT=8080 NUTRI_DATOS=/tmp/nutri
EXPOSE 8080
USER node
CMD ["node", "out/main/web.js"]
