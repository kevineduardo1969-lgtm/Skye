# Skye

Prototipo frontend de una plataforma educativa para fortalecer pensamiento computacional y lógico-matemático en quinto de primaria.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abre la dirección que muestra Vite (usualmente `http://localhost:5173`).

## Verificar la versión de producción

```bash
npm run build
```

La compilación genera los archivos listos para publicar dentro de `dist/`.

## Incluye

- Inicio y tablero de 10 módulos.
- 40 retos interactivos: pensamiento computacional, divisiones, fracciones, decimales, proporcionalidad, porcentajes, lógica, datos y robot.
- Gran reto final, gamificación, insignias y progreso de sesión.
- Diseño responsive; no requiere backend, cuentas ni persistencia.
- Motor de ejercicios reutilizable en `src/components/ExerciseEngine.jsx`.
- Catálogo editable de ejercicios en `src/data/exercises.js`.
