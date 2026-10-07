# Retirar v1 y completar el flujo de documentos de la API directa (SharePoint)

**Base:** `feat/integracion-sharepoint-v2` · **Rama:** `chore/retirar-v1` · 5 commits · 111 archivos (+1.056 / −15.249)

## Resumen
Elimina por completo el modo v1 (Power Automate) y deja la app solo con la API directa del cliente (SharePoint, spec 13). Además incorpora las últimas mejoras del flujo de documentos y el mapa de ubicación de las inspecciones, y limpia el código y las dependencias que quedaron sin uso.

## Qué incluye

### 1. Retiro de v1 (3 commits)
- **Backend:** se quitan las rutas de flows (`/api/solicitudes`, `/inspecciones`, `/fotos`, `/informes`, `/archivos`, `/tipos-inspeccion`, `/usuarios`, `/datos` → ahora 404), el sync v1 y las variables `FLOW_*`.
- **Frontend:** se quitan las ramas v1, los servicios y contextos de flows y el flag `VITE_USE_API_V2`.
- **Infra y docs:** actualizados. La cola de Oracle no tenía filas v1; no se tocó ninguna tabla.

### 2. Flujo de documentos (commit `1bcc01a`)
- **Devolver documentación** (CU-32): botón rojo, equivale a rechazar (comentario obligatorio, sin adjunto). En «Gestión de Obra» va dentro de la tarjeta del acta de inicio; en las demás etapas, tarjeta propia «Documentación por revisar» con el último documento de cada tipo y «Descargar».
- **Quien devolvió espera la corrección** (CU-33): «Devuelto al ITO · en espera de la corrección», con su comentario y el documento; etiqueta «ESPERANDO CORRECCIÓN DEL ITO».
- **Validación** del informe final y de la documentación del ITO por el Supervisor (CU-19), respetando las banderas de la API; avance vigente en cada evento (CU-13); documentación rechazada con «Comentario rechazo».
- **Informe final:** la tarjeta de validación muestra solo el último documento.
- **Ubicación de las inspecciones** (CU-34): «Ver ubicación» con pop-up de mapa (OpenStreetMap, `leaflet` + `react-leaflet`), cargado bajo demanda y con aviso sin conexión.

### 3. Limpieza (commit `7078256` y parte del anterior)
- 59 archivos sin uso (pantallas v1, `ui/*` de shadcn, restos de plantilla).
- 56 dependencias npm sin uso. En ejecución quedan `react`, `react-dom`, `lucide-react`, `luxon`, `leaflet`, `react-leaflet` y `tw-animate-css`.

## Verificación
- `npm run check:ui` (220 reglas), `tsc --noEmit`, `eslint` y `npm run build` pasan; el service worker precachea las mismas 9 entradas.
- Probado en pantalla con datos reales y simulados: login, detalle de obra, mapa, devolver documentación y estado de espera (simulado), informe final con un solo documento.
- Imágenes Docker reconstruidas el 06-10-2026 en `concerto` (amd64): `ayp-backend.tar` (167 MB) y `ayp-frontend.tar` (69 MB). **No se probó login real con esas imágenes.**

## Pendiente / a tener en cuenta
- **Sin confirmar con datos reales:** el estado exacto que deja la API tras devolver un documento (CU-33 está implementado con datos simulados), el documento que corresponde a cada estado, el flujo `OBRA_FINALIZADA`, el rechazo del informe final y el mapa sin conexión.
- **Despliegue:** hay que reconstruir/usar las imágenes nuevas (las del 15-09 son de v1). El backend necesita `SHAREPOINT_API_URL` y `SHAREPOINT_API_SECRET`; `FRONTEND_URL` debe ser el origen público exacto (con `https://`, sin `/` final). Si hay CSP, permitir `tile.openstreetmap.org` (mapa).
- **Cliente:** quitar `COMENTARIO_OBRA` cuando lo confirme; filtro «Finalizadas» a la espera de cómo listar obras finalizadas; reporte de hallazgos en `documentacion/reporte-cliente-pendientes.md` y datos de prueba a borrar.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
