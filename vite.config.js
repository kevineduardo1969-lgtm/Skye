import { defineConfig } from 'vite'

// Permite abrir el servidor de desarrollo desde el navegador del equipo,
// incluso cuando el proyecto se ejecuta dentro de WSL/Linux.
export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
})
