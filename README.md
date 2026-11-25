# Skye

Prototipo frontend de una plataforma educativa para fortalecer pensamiento computacional y lógico-matemático en quinto de primaria.

## Configurar acceso, evidencias, retos docentes e IA segura con Supabase (Fases 1 a 7)

Skye admite dos accesos: estudiantes con **código + apodo** y docentes con correo y contraseña. El apodo es el único dato mostrado para estudiantes; no se solicitan nombres completos, fotos ni correos de menores.

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. En **Authentication > Providers**, habilita **Anonymous Sign-Ins** para estudiantes y **Email** para docentes.
3. Abre **SQL Editor** y ejecuta, en este orden:
   - [supabase/migrations/202611200001_access_and_groups.sql](supabase/migrations/202611200001_access_and_groups.sql)
   - [supabase/migrations/202611200002_learning_evidence.sql](supabase/migrations/202611200002_learning_evidence.sql)
   - [supabase/migrations/202611200003_teacher_learning_dashboard.sql](supabase/migrations/202611200003_teacher_learning_dashboard.sql)
   - [supabase/migrations/202611240004_teacher_challenges.sql](supabase/migrations/202611240004_teacher_challenges.sql)
   - [supabase/migrations/202611240005_teacher_material_storage.sql](supabase/migrations/202611240005_teacher_material_storage.sql)
   - [supabase/migrations/202611240006_ai_challenge_generations.sql](supabase/migrations/202611240006_ai_challenge_generations.sql)
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
10. La Fase 5 usa los mismos datos y políticas: agrega resúmenes, tabla de habilidades, recomendaciones pedagógicas, exportación CSV e impresión; no requiere una migración adicional.
11. La Fase 6 permite que cada docente cree retos para sus propios grupos desde **Mis grupos**. Puede guardarlos como borrador o publicarlos. Los retos publicados se integran al módulo elegido del estudiante y la base de datos solo los devuelve al grupo destinatario.

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

## Exportar e imprimir reportes docentes

1. Entra como docente y abre **Mis grupos**.
2. Ajusta los filtros de grupo, módulo, habilidad, periodo y actividad según el seguimiento que necesites.
3. Presiona **Exportar CSV filtrado** para descargar un archivo compatible con Excel, LibreOffice o Google Sheets. El archivo contiene únicamente grupo, apodo, código y evidencia de aprendizaje; no incluye correos ni nombres completos.
4. Para un reporte individual, presiona **Ver reporte** en la tarjeta del estudiante y luego **Imprimir reporte**. La vista de impresión muestra únicamente el reporte individual limpio, con procesos, fortalezas, práctica y siguiente paso pedagógico.

Los resúmenes están diseñados para acompañar el proceso de pensamiento computacional —descomposición, patrones, secuenciación, pensamiento algorítmico, análisis de datos, toma de decisiones y perseverancia— sin generar rankings entre estudiantes.

## Crear retos docentes

Desde **Mis grupos**, el docente puede crear retos de opción múltiple, respuesta numérica, selección múltiple u ordenamiento de pasos. Cada reto requiere grupo, módulo, habilidad, dificultad, consigna, pista, explicación pedagógica y estrellas. Los borradores solo son visibles para el docente creador; al publicar, únicamente estudiantes del grupo asignado pueden leerlos. El docente puede editar, despublicar o eliminar sus propios retos.

La migración `202611240004_teacher_challenges.sql` activa Row Level Security: el docente autenticado solo gestiona retos vinculados a sus propios grupos y cada estudiante autenticado solo lee los retos publicados de su grupo. No se almacena información personal adicional de estudiantes.

## Material privado para futuros borradores con IA

En **Mis grupos > Mis retos**, la opción **Crear borrador desde archivo** admite `.txt`, `.csv`, `.docx` y `.pdf` de hasta 5 MB. En esta fase no se conecta ningún modelo de IA ni se generan retos automáticamente: el docente puede validar el archivo, revisar el texto detectado cuando corresponda y subirlo de forma privada para una revisión posterior.

Ejecuta la migración `202611240005_teacher_material_storage.sql`. Crea el bucket privado `teacher-materials` y políticas de Supabase Storage que permiten leer, subir, actualizar o eliminar únicamente archivos dentro de la carpeta del docente autenticado. Nunca subas nombres, calificaciones ni datos personales de estudiantes. La aplicación usa solamente la clave pública de Supabase; no requiere ni expone claves privadas.

## IA segura para borradores editables

La función `supabase/functions/generate-challenge-drafts` descarga el material privado únicamente después de verificar que la persona autenticada es docente y que el archivo pertenece a su carpeta. Extrae texto de `.txt`, `.csv`, `.docx` y `.pdf`, envía solo ese texto al modelo y devuelve entre 1 y 5 propuestas estructuradas. No guarda el texto extraído: la tabla `ai_challenge_generations` registra únicamente docente, fecha, nombre/ruta de archivo, estado y cantidad de propuestas.

Configura los secretos **solo en Supabase Edge Functions**; nunca los agregues a `.env.local`, `.env.example`, React, GitHub ni Vercel:

```bash
supabase secrets set OPENAI_API_KEY="tu_clave_de_ia"
supabase secrets set OPENAI_MODEL="gpt-4o-mini"
supabase functions deploy generate-challenge-drafts
```

La interfaz no publica resultados automáticamente. El docente revisa, modifica, descarta o guarda cada propuesta como borrador; después usa el flujo normal de **Mis retos** para publicarla manualmente. Si un archivo no se puede extraer, Skye muestra un mensaje y no genera ni publica retos.

## Incluye

- Inicio y tablero de 10 módulos.
- 40 retos interactivos: pensamiento computacional, divisiones, fracciones, decimales, proporcionalidad, porcentajes, lógica, datos y robot.
- Gran reto final, gamificación, insignias y progreso persistente por estudiante.
- Bitácora persistente por estudiante: apodo, grupo, retos resueltos, estrellas, habilidades, evidencias por módulo, intentos, pistas, fortalezas y siguiente paso.
- Evidencias de aprendizaje: intentos, pistas, procedimiento, estado y estrellas recuperables al volver a entrar con el mismo código.
- Panel docente protegido: grupos, filtros, resumen de evidencias y bitácora individual por apodo/código, sin exponer datos privados de menores.
- Seguimiento académico docente: resúmenes por grupo, tabla de habilidades, recomendaciones pedagógicas, CSV filtrado e impresión individual limpia.
- Retos personalizados por docente: borradores, publicación por grupo y cuatro formatos compatibles con el motor de ejercicios.
- Material didáctico privado por docente, preparado para una futura generación de borradores con IA.
- Borradores de IA revisables y guardados manualmente, protegidos por una Supabase Edge Function.
- Diseño responsive y acceso opcional con Supabase para estudiantes y docentes.
- Motor de ejercicios reutilizable en `src/components/ExerciseEngine.jsx`.
- Catálogo editable de ejercicios en `src/data/exercises.js`.
