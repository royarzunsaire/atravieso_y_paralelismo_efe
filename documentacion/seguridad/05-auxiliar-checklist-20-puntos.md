# Checklist auxiliar — «20 cosas para pedirle a Claude antes de lanzar tu app»

> **Documento AUXILIAR** (12-10-2026). La lista viene de un reel, no es un requisito oficial de Ciberseguridad de EFE; Rodrigo la eligió como guía general. Cuando llegue el listado propio de Ciberseguridad se repetirá el ejercicio con ese (como `04-checklist-ciberseguridad-EFE.md`). La fuente de verdad de la auditoría sigue siendo `01-planner.md`, `02-checklist.md` (87 controles) y `03-informe-hallazgos.md`.
>
> Estados: ✅ cumple · ⚠️ parcial · ❌ no cumple · ⏳ depende de infraestructura/otra persona · ➖ no aplica.

## 1. Los 20 puntos contra el proyecto

| # | Punto | Estado | Evidencia |
|---|---|---|---|
| 1 | Ocultar API keys | ✅ | Todo en variables de entorno del servidor; el frontend no lleva ninguna (revisión del paquete compilado, H-20/H-25). |
| 2 | Eliminar secretos de Git | ⚠️ | `.env` ignorado. Dos `.db` antiguos siguen en el **historial** (H-13; contraseñas ya cambiadas). Decisión: no reescribir el historial salvo que Ciberseguridad lo exija. |
| 3 | Key pública para la base de datos | ➖ | La BD solo se alcanza desde el backend con credenciales OAuth2 de servidor (ORDS `client_credentials`); el navegador nunca ve una clave de BD. |
| 4 | Row-Level Security | ➖ | No aplica en el sentido de Oracle. Equivalente: cada petición **revalida el acceso a la obra** contra la API del cliente (pruebas D12/D13). |
| 5 | Encriptar datos sensibles | ⚠️ | Contraseñas con bcrypt (costo 12 las nuevas). La API del cliente va por HTTP sin cifrar (H-05, del cliente). Los borradores en el navegador no se cifran (se borran al cerrar sesión, H-14). |
| 6 | Forzar la autenticación | ✅ | Todo `/api` exige token (D3); sin registro público (H-01). |
| 7 | Restringir el acceso a registros | ✅ | Revalidación por obra en cada lectura y escritura (D12/D13/D14). |
| 8 | Bloquear manipulación de campos | ✅ | `Payload` limpiado a las claves del contrato, con tipos y rangos (H-11, D19). |
| 9 | Proteger las session cookies | ➖ / ⚠️ | No hay cookies (token por cabecera). El token vive en `localStorage` (expuesto a XSS; mitigado con CSP estricta y sin sinks XSS) y dura 7 días (H-08, parcial). |
| 10 | Hashear contraseñas | ✅ | bcrypt; el login no revela si el correo existe (H-06). |
| 11 | Rate limiting | ✅ | Login: 5 fallos/10 min por correo + IP; nginx: `/auth/` 20/min y `/api/` 50/s (E13, probado con nginx real). |
| 12 | Protección contra bots | ⚠️ | Cubierto por límite de peticiones. Sin CAPTCHA ni WAF (el WAF es del balanceador de OCI). |
| 13 | Parametrizar queries | ✅ | Todo viaja como JSON hacia ORDS; sin SQL armado a mano (D17). |
| 14 | Validar inputs | ✅ | Tipos, largos, rangos, fechas y archivos validados en el servidor (H-10, H-11, H-19). |
| 15 | Sanitizar contenido | ✅ | React escapa el texto; sin `dangerouslySetInnerHTML`/`innerHTML`/`eval` (H-24); DOMPurify no es necesario. |
| 16 | Restringir archivos | ✅ | Extensión, firma real, peso, cantidad y nombre; HEIC no admitido (H-11). |
| 17 | Devolver solo los datos necesarios | ✅ | `/auth/me` y el login excluyen hash y `activo`; `/` y `/health` solo el estado; errores genéricos (H-15, H-18). |
| 18 | Security headers | ✅ | CSP estricta, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS con HTTPS (H-07). |
| 19 | Forzar HTTPS | ⏳ | Lo fuerza el balanceador de OCI (TLS + `X-Forwarded-Proto`); se espera en el ambiente de la jefatura y de Ciberseguridad. La API del cliente por HTTP (H-05) es del cliente. |
| 20 | Escanear dependencias | ✅ | `npm audit` de producción en 0 y `trivy` en 0 vulnerabilidades en ambas imágenes. |

**Resumen:** ✅ 13 · ⚠️ 4 (2, 5, 9, 12) · ➖ 2 (3, 4) · ⏳ 1 (19).

## 2. Qué de lo parcial depende de NOSOTROS (y qué no)

HTTPS, TLS, HSTS y WAF son prácticas comunes de infraestructura: se dan por hechos en el ambiente de la jefatura y en el de Ciberseguridad (punto 19 y parte del 12), y la PWA ya está preparada (HSTS con `X-Forwarded-Proto`, CSP, límites de peticiones).

| Pendiente | ¿De quién? | Esfuerzo / impacto | Recomendación |
|---|---|---|---|
| **Duración del token (punto 9)** | De nosotros implementarlo; **decide la jefatura** | Medio: 24 h con renovación deslizante; exige reconstruir imágenes | Hacerlo cuando el jefe confirme (CLAUDE.md item 18-A1). |
| **Historial de git con los `.db` (punto 2)** | Decisión de Rodrigo / Ciberseguridad; la ejecutaríamos nosotros | Destructivo: `git filter-repo` + push forzado, todos deben re-clonar | **No** hacerlo salvo que Ciberseguridad lo exija. Lo barato: confirmar que el repositorio es privado. |
| **Limpiar código muerto (H-23, informativo)** | Nosotros | Bajo: quitar `supabase_session`/`connection_token` de `auth.js`, el `runtimeCaching` a `api.tuservidor.com` en `vite.config.js` y la dependencia sobrante | Sí, es una limpieza segura (requiere contrato de UI y reconstruir imágenes; mejor junto con el cambio del token). |
| **Token en `localStorage` → cookie HttpOnly (punto 9)** | Nosotros | **Alto:** cambia el flujo de sesión, exige CSRF y complica el modo offline | **No ahora.** Con CSP estricta y el token más corto el riesgo baja bastante; revisar si Ciberseguridad lo exige. |
| **Cifrar los borradores del navegador (punto 5)** | Nosotros | Medio y de poco valor: la clave tendría que vivir en el mismo navegador | No. Ya se vacían al cerrar sesión (H-14). |
| **CAPTCHA en el login (punto 12)** | Nosotros (opcional) | Medio: dependencia externa (Google) y más superficie en la CSP | No hace falta con el límite de peticiones; un WAF en OCI lo cubre mejor. |
| **Sesiones en memoria / una sola réplica** | Nosotros solo si escalan a varias réplicas | Medio: almacén compartido (Redis) | Mientras haya una réplica, no. Avisar al colega de OCI que son **1 réplica**. |
| **HTTPS de la API del cliente (H-05)** | **Cliente** | — | Ya pedido en el reporte (hallazgo 17). |

**Conclusión:** de lo parcial, lo único que nos toca construir de verdad es el token (cuando decida la jefatura) y, junto con él, la limpieza de código muerto. Lo demás es infraestructura, del cliente o una decisión de riesgo ya tomada.
