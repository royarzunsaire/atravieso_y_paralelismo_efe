---
name: pwa-inspecciones-obra
description: >
  Skill para desarrollo del módulo de Ejecución de Obras del Sistema AyP (EFE).
  Aplica cuando el usuario pide agregar features, corregir errores o iterar sobre
  la PWA de inspecciones (React/TypeScript + Node.js/Express + Power Automate +
  SharePoint). Cubre: componentes de formulario, navegación por pantallas,
  integración con flows, validaciones de negocio y gestión de estado.
---

# PWA Inspecciones de Obra — Agent Skill

## Stack y arquitectura

| Capa | Tecnología |
|------|-----------|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, JWT (RS256) |
| Integración | Power Automate flows → SharePoint |
| Caché | `requestCache.js` (in-memory, TTL configurable) |
| Estado global | `CatalogsContext` → `SolicitudContext` → `AppContent` |
| Navegación | Estado `Screen` discriminado en `App.tsx` (sin router) |
| Íconos | `lucide-react` |

### Jerarquía de providers

```
CatalogsProvider          ← catálogos globales (tiposInspeccion)
  └── SolicitudProvider   ← datos de la solicitud activa + inspecciones + fotos
        └── AppContent    ← toda la UI y navegación
```

### Tipo `Screen` en App.tsx

```ts
type Screen =
  | { type: 'login' }
  | { type: 'authCallback' }
  | { type: 'solicitudesDashboard' }
  | { type: 'solicitudDetail'; solicitudId: number }
  | { type: 'newInspection'; solicitudId: number; solicitud: Solicitud; minimoAvance: number }
  | { type: 'cierreObra'; solicitudId: number; solicitud: Solicitud }
  | { type: 'photoCapture' }
  | { type: 'profile' };
```

Cada pantalla es un componente full-screen. No hay `react-router`. El estado de la pantalla lleva los datos necesarios (ej. `minimoAvance`) para evitar prop drilling desde contextos.

---

## Convenciones de código

### Normalización de campos SharePoint

Los flows de Power Automate pueden devolver nombres de campo en PascalCase **o** camelCase. Siempre normalizar en el backend antes de responder:

```js
// ✅ Correcto — tolera ambas variantes
nombre: String(u.Nombre || u.nombre).trim(),
correo: String(u.Correo || u.correo).trim(),
```

Nunca asumir una sola casing. Nunca hacer la normalización en el frontend.

### Caché en el backend

Cada ruta usa caché en memoria con TTL. Patrón estándar:

```js
let cache = { data: null, expiresAt: 0 };

if (cache.data && Date.now() < cache.expiresAt) {
  return res.json({ success: true, data: cache.data, source: 'cache' });
}
// ... llamar al flow ...
cache = { data: resultado, expiresAt: Date.now() + TTL_MS };
```

En caso de error, retornar caché expirada antes que un array vacío:
```js
if (error && cache.data) {
  return res.json({ success: true, data: cache.data, source: 'stale-cache' });
}
```

### Caché en el frontend

`requestCache.js` es la única capa de caché del cliente. Toda llamada fetch va por `cachedGet(key, fetcher, { ttlMs })`. **No duplicar lógica de caché en componentes.**

| Recurso | TTL frontend | TTL backend |
|---------|-------------|-------------|
| Solicitudes | 20 s | — |
| Inspecciones | 10 s | 10 s |
| Archivos | 20 s | 20 s |
| Tipos inspección | 5 min | 5 min |
| Usuarios | 5 min | 5 min |

### Variables de entorno del backend

```
FLOW_INSPECCIONES_CREAR_URL
FLOW_INSPECCIONES_LISTAR_URL
FLOW_USUARIOS_URL
FLOW_TIPOS_INSPECCION_URL
FLOW_ARCHIVOS_LISTAR_URL
FLOW_FOTOS_SUBIR_URL
FLOW_FOTOS_LISTAR_URL
FLOW_FOTOS_CONTENIDO_URL
INSPECCIONES_CACHE_TTL_MS
USUARIOS_CACHE_TTL_MS
```

---

## Reglas de negocio implementadas

### Progreso de obra

- El avance de obra **nunca puede decrecer**: `NewInspection` recibe `minimoAvance` y clampea el slider con `Math.max(minimoAvance, value)`.
- El slider muestra siempre el rango 0–100 % con gradiente simple (azul 0→progreso, gris progreso→100). No usar zonas de color adicionales — generan confusión visual.
- `minimoAvance` viaja por: `SolicitudDetail.ultimaInspeccion.progress` → prop `onNewInspection(solicitud, minimoAvance)` → `Screen.minimoAvance` → prop `<NewInspection minimoAvance={...}>`.

### Cierre de obra

- El botón "Cerrar Obra" reemplaza al FAB "+ Inspección" cuando `ultimaInspeccion.progress === 100`.
- El formulario `CierreObra` siempre permite guardar, pero el comportamiento cambia según si hay archivo adjunto:

| Estado | `esCierreCompleto` | Botón | Toast |
|--------|-------------------|-------|-------|
| Sin informe adjunto | `false` | "Guardar Datos de Cierre" (azul) | Warning "cierre pendiente" |
| Con informe adjunto | `true` | "Confirmar Cierre de Obra" (verde) | Success "cierre definitivo" |

- `esCierreCompleto: !!archivo` se calcula en el submit y viaja en `CierreObraData`.

### Usuarios a notificar

- Presente en **ambos** formularios: `NewInspection` y `CierreObra`.
- Se carga desde `GET /api/usuarios` que llama al flow `FLOW_USUARIOS_URL`.
- Siempre opcional — nunca bloquea el guardado.
- El array `usuariosNotificar: [{ id, nombre, correo }]` se envía al flow de creación para que Power Automate gestione el envío de correos.
- La caché de usuarios es compartida entre ambos formularios (misma `cacheKey: 'usuarios:all'`).

### Filtrado de documentos

- El filtrado por `TipoDocumento` **se hace en el flow de Power Automate**, no en el frontend.
- `SolicitudDetail` muestra todos los archivos que devuelva la API sin filtrar.
- `archivosPermitidos = archivosList` (asignación directa, sin `.filter()`).

---

## Spec-Driven Development

Esta sección describe el proceso de trabajo acordado entre el agente y Rodrigo para evolucionar la PWA de forma predecible y sin regresiones.

### Principios

1. **Ediciones quirúrgicas, no rewrites**: ante cualquier cambio, modificar solo las líneas afectadas con `str_replace`. Nunca reescribir un archivo completo si el cambio es puntual.
2. **Los archivos del proyecto son la fuente de verdad**: antes de editar, leer el archivo actual desde los documentos adjuntos o los outputs. No asumir el estado del código desde memoria.
3. **El filtrado de datos es responsabilidad del origen más cercano**: si el flow ya filtra, el backend no filtra; si el backend ya filtra/normaliza, el frontend no filtra. Eliminar lógica redundante.
4. **Un feature = un commit conceptual**: cada feature (ej. "usuarios a notificar") toca exactamente los archivos necesarios y nada más. Verificar con `grep` antes de declarar completado.

### Flujo de trabajo por feature

```
1. LEER el archivo actual (grep / view)
2. IDENTIFICAR el cambio mínimo necesario
3. APLICAR str_replace quirúrgico
4. VERIFICAR con grep que el cambio quedó bien
5. PRESENT_FILES — solo los archivos modificados
```

### Propagación de datos entre capas

Cuando un dato nuevo necesita viajar de backend a UI:

```
Flow (SharePoint)
  → Backend route (normalizar + cachear)
    → Frontend service (cachedGet)
      → Context o App.tsx state
        → Screen type (si es dato de navegación)
          → Prop del componente
            → Render / validación
```

Cada eslabón debe actualizarse. Usar `grep` para rastrear todos los usos de una prop antes de cambiar su firma.

### Cambio de firma de una prop

Cuando se cambia la firma de una función prop (ej. `onNewInspection`), el checklist es:

- [ ] `interface` del componente hijo
- [ ] Desestructuración del componente hijo
- [ ] Todos los `onClick` / `onChange` que la llaman
- [ ] `type Screen` en `App.tsx` (si el dato se guarda en el screen)
- [ ] Handler en `App.tsx` (`handleXxx`)
- [ ] Uso del handler en el JSX de `AppContent`
- [ ] Prop pasada al componente en el render

### Validaciones de formulario

Patrón estándar en todos los formularios:

```ts
const validate = () => {
  const newErrors: Record<string, string> = {};
  if (!campo) newErrors.campo = 'Mensaje';
  // reglas de negocio
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

const handleSubmit = (e: FormEvent) => {
  e.preventDefault();
  if (!validate()) {
    // scroll al primer error en orden de aparición en el formulario
    if (!campo) { refCampo.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    return;
  }
  onSave({ ... });
};
```

- Cada campo con error tiene `ref` para scroll automático.
- El orden de `scrollIntoView` refleja el orden visual en el formulario.
- Los errores se limpian en el `onChange` del campo correspondiente.

### Integración con Power Automate

- Los flows retornan datos con **casing inconsistente** (PascalCase / camelCase / snake_case). Siempre normalizar en el backend con fallbacks: `u.Nombre || u.nombre`.
- Los flows pueden retornar el array directo **o** envuelto en `{ data: [...] }`. Siempre manejar ambos casos:
  ```js
  const raw = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : []);
  ```
- El filtrado de datos por negocio (ej. tipo de documento) se hace en el flow, no en el backend ni en el frontend. Si el requisito cambia en el flow, el código no necesita modificarse.
- Pasar `cantidadNotificados` junto con el array `usuariosNotificar` al flow de creación como campo de conveniencia para las condiciones de la automatización.

### Convenciones de componentes React

- **Selector de usuarios** (`listbox`): buscador + avatar con inicial + checkbox visual + chips de seleccionados. Reutilizar el mismo patrón en `NewInspection` y `CierreObra`.
- **FAB condicional**: usar un `ternary` en el JSX — nunca dos `FloatingActionButton` con condición en `className`.
- **Sliders**: siempre `min="0" max="100"` en el atributo HTML. El clamping es responsabilidad del `onChange`, no del atributo `min`.
- **Gradiente del slider**: gradiente de 2 zonas solamente — `azul 0→value` + `gris value→100`. Nunca 3 zonas (genera artefactos visuales con el thumb).

---

## Archivos clave y su responsabilidad

| Archivo | Responsabilidad |
|---------|----------------|
| `App.tsx` | Tipo `Screen`, handlers de navegación, orquestación de guardado |
| `SolicitudDetail.tsx` | Vista detalle + FAB condicional + propagación de `minimoAvance` |
| `NewInspection.tsx` | Formulario nueva inspección + validación avance mínimo |
| `CierreObra.tsx` | Formulario cierre + lógica `esCierreCompleto` |
| `SolicitudesDashboard.tsx` | Listado + fetch paralelo de avances |
| `SolicitudContext.tsx` | 3 niveles de carga: solicitud → inspecciones+archivos → fotos |
| `CatalogsContext.tsx` | Catálogos globales (tipos inspección) |
| `requestCache.js` | Única capa de caché del cliente |
| `pwa-backend/routes/inspecciones.js` | CRUD inspecciones + `usuariosNotificar` → flow |
| `pwa-backend/routes/usuarios.js` | GET usuarios desde flow + normalización PascalCase |
| `pwa-backend/routes/archivos.js` | GET documentos (filtrado delegado al flow) |

---

## Tokens de diseño

```
Azul primario:    #0066CC
Azul oscuro:      #003D7A
Rojo error:       #E30613
Texto principal:  #1A1A1A
Texto secundario: #4A4A4A
Fondo:            #F5F7FA
Blanco:           #FFFFFF
```

Tailwind personalizado no disponible — usar solo clases del CDN base más valores inline con `style={{}}` para colores exactos del sistema de diseño EFE.
