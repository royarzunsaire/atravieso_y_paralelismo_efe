# Sistema de Atravieso y Paralelismo (AyP) — EFE

## ¿Qué es este sistema?
PWA complementaria a la aplicación web de Atravieso y Paralelismo (AyP) de EFE,
diseñada para uso en terreno por inspectores de obra.

Permite gestionar las solicitudes que se encuentran en la fase "Realización de Obra":
registrar avance con porcentaje de progreso, adjuntar documentos y fotografías,
solicitar el cierre de obra y notificar a los involucrados.

Diseñada para funcionar en modo offline, garantizando que los inspectores puedan
operar con normalidad en terrenos o lugares sin conexión a internet, sincronizando
automáticamente cuando se restablece la conexión.

---

## Stack
- Frontend: React + TypeScript + Vite (PWA)
- Backend: Node.js + Express
- Auth: Supabase (usuarios externos) + Azure AD (usuarios internos EFE)
- Integración: Power Automate + SharePoint
- Deploy: Render (backend) + Vercel (frontend)

---

## Estructura de carpetas del proyecto

```
Atravieso y Paralelismo/
├── CLAUDE.md
├── .claude/
│   └── skills/
│       └── pwa-inspecciones-obra/
│           ├── SKILL.md
│           └── references/
│               ├── arquitectura.md
│               ├── reglas-negocio.md
│               ├── convenciones.md
│               └── specs/
│                   ├── 01-contador-dias.md
│                   ├── 02-azure-ad-login.md
│                   ├── 03-perfiles-usuario.md
│                   └── 04-offline-mode.md
├── frontend/
│   └── src/
│       ├── components/     ← componentes React reutilizables
│       ├── context/        ← providers de estado global
│       ├── hooks/          ← hooks personalizados
│       ├── services/       ← llamadas a API y lógica de datos
│       ├── types/          ← interfaces y tipos TypeScript
│       └── utils/          ← funciones utilitarias puras
└── pwa-backend/
    └── src/
        ├── middleware/     ← auth, validación, logging
        ├── routes/         ← endpoints REST
        └── utils/          ← helpers del backend
```

---

## Skills de este proyecto
Antes de cualquier tarea, leer en este orden:
1. `~/.claude/skills/user/rodrigo-protocolo-tecnico/SKILL.md`
2. `.claude/skills/pwa-inspecciones-obra/SKILL.md`
3. La referencia correspondiente a la tarea

---

## ⚠️ Reglas irrompibles

### 1. Nunca asumir — siempre preguntar
Ante cualquier duda, ambigüedad o información faltante,
Claude DEBE preguntar antes de continuar. Sin excepciones.
No existe la "suposición razonable" — si no está confirmado, se pregunta.

### 2. Mostrar planning completo y esperar autorización
Antes de CUALQUIER acción (crear archivo, editar código, instalar
dependencia, modificar configuración), Claude debe:
  a) Mostrar el plan completo detallando qué hará y por qué
  b) Esperar respuesta explícita del usuario ("sí", "procede", "ok")
  c) Solo entonces ejecutar — nunca antes

### 3. Un paso a la vez
Nunca ejecutar múltiples acciones sin checkpoint intermedio.
Cada acción sigue el ciclo: mostrar → esperar aprobación → ejecutar.

### 4. Happy Path y Sad Path siempre definidos
Toda spec y todo código debe contemplar ambos caminos:
- Happy Path: qué pasa cuando todo funciona correctamente
- Sad Path: qué pasa cuando algo falla o el usuario hace algo inesperado
Si el Sad Path no está definido en la spec, Claude debe preguntar
antes de asumir un comportamiento de error.

---

## Features pendientes (en orden de prioridad)
1. [ ] Contador de días desde fecha de boleta
2. [ ] Login Azure AD para usuarios internos EFE — código comentado en esta fase (ver spec 02-azure-ad-login.md), se retoma en una fase futura, no en el corto plazo
3. [ ] Perfiles de usuario según rol SharePoint
4. [ ] Modo offline (lectura + escritura + sync)
5. [ ] Subida de documentos a carpeta separada: actualmente los documentos se suben junto con las fotos en la carpeta/página `FotosInspecciones`. Se requiere que la subida de documentos ocurra en una carpeta/página distinta llamada `DocumentosInspecciones`. Sin spec aún — ambigüedades a resolver antes de implementar: ¿es una carpeta en SharePoint, un flow de Power Automate distinto, o ambos? ¿el backend necesita una ruta/env var nueva (ej. `FLOW_DOCUMENTOS_SUBIR_URL`) o reutiliza la de fotos con un parámetro de tipo?
