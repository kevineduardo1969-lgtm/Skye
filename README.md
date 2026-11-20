# Skye

Prototipo frontend de una plataforma educativa para fortalecer pensamiento computacional y lógico-matemático en quinto de primaria.

## Configurar acceso y evidencias con Supabase (Fases 1, 2, 3 y 4)

Skye admite dos accesos: estudiantes con **código + apodo** y docentes con correo y contraseña. El apodo es el único dato mostrado para estudiantes; no se solicitan nombres completos, fotos ni correos de menores.

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. En **Authentication > Providers**, habilita **Anonymous Sign-Ins** para estudiantes y **Email** para docentes.
3. Abre **SQL Editor** y ejecuta, en este orden:
   - [supabase/migrations/202611200001_access_and_groups.sql](supabase/migrations/202611200001_access_and_groups.sql)
   - [supabase/migrations/202611200002_learning_evidence.sql](supabase/migrations/202611200002_learning_evidence.sql)
   - [supabase/migrations/202611200003_teacher_learning_dashboard.sql](supabase/migrations/202611200003_teacher_learning_dashboard.sql)
4. Copia `.env.example` como `.env.local` y agrega los valores públicos de **Settings > API**:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
```

5. Nunca uses ni publiques `service_role`, secretos de base de datos o archivos `.env.local`.
6. Inicia la app. El primer docente puede crear su cuenta, generar un grupo y emitir códigos para estudiantes. Cada código solo puede asociarse a una sesión de estudiante.
7. Al abrir un reto, usar una pista o responder, Skye guarda una evidencia con el ejercicio, habilidad, estado, intentos, pistas, estrellas y procedimiento seleccionado. No guarda nombres completos, correos de estudiantes ni respuestas con información personal.
8. En **Mis evidencias**, cada estudiante verá una bitácora persistente con su apodo, grupo, actividades recientes, evidencias por módulo, intentos, pistas, fortalezas, habilidades en práctica y un siguiente reto recomendado.
9. En **Mis grupos**, cada docente puede filtrar evidencias de sus propios grupos y abrir una bitácora individual basada únicamente en apodo y código. La función SQL de la Fase 4 limita el listado a grupos cuyo `teacher_id` coincida con el docente autenticado; las políticas RLS de evidencias mantienen la misma restricción.

> Para producción, configura la confirmación de correo docente y entrega códigos de estudiante únicamente a través del docente responsable. Las políticas RLS incluidas limitan perfiles, grupos, códigos y evidencias desde la base de datos: cada estudiante solo lee sus propias evidencias; el docente solo puede consultar las de sus grupos.

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
- Gran reto final, gamificación, insignias y progreso persistente por estudiante.
- Bitácora persistente por estudiante: apodo, grupo, retos resueltos, estrellas, habilidades, evidencias por módulo, intentos, pistas, fortalezas y siguiente paso.
- Evidencias de aprendizaje: intentos, pistas, procedimiento, estado y estrellas recuperables al volver a entrar con el mismo código.
- Panel docente protegido: grupos, filtros, resumen de evidencias y bitácora individual por apodo/código, sin exponer datos privados de menores.
- Diseño responsive y acceso opcional con Supabase para estudiantes y docentes.
- Motor de ejercicios reutilizable en `src/components/ExerciseEngine.jsx`.
- Catálogo editable de ejercicios en `src/data/exercises.js`.
