# Integración externa — API de usuarios (AyP)

Guía para la plataforma externa (EFE) que consume la API de usuarios del
Sistema de Atravieso y Paralelismo vía **ORDS REST** con **OAuth2
(client_credentials)**.

> Fuente de verdad del comportamiento de ORDS:
> `.claude/skills/pwa-inspecciones-obra/references/oracle-ords.md`.
> DDL real de estos endpoints: `pwa-backend/sql/01_tabla_usuarios.sql`
> (register/last-login/change-password) y `pwa-backend/sql/13_lectura_usuarios.sql`
> (los tres GET de lectura).

---

## Datos de conexión

| Dato | Valor |
|------|-------|
| Base URL | `https://gf0c968a5244b47-devtrans.adb.sa-santiago-1.oraclecloudapps.com/ords/atraviesoparalelismo` |
| Client OAuth2 | `AYP_INTEGRACION_EXTERNA` |
| `client_id` / `client_secret` | Se entregan por separado (gestor de contraseñas). **No van en este documento ni en el repo.** |

Todo el tráfico es sobre **HTTPS**. El `client_secret` no se puede recuperar
si se pierde: hay que rotarlo.

---

## Paso 1 — Obtener un token

```
POST {BaseURL}/oauth/token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

Respuesta:

```json
{ "access_token": "...", "token_type": "bearer", "expires_in": 3600 }
```

- El token **expira en 3600s (1 hora)**.
- **Cachear el token** — no pedir uno nuevo en cada request. Renovar poco
  antes de que expire, o reactivamente si un request devuelve `401`.
- Usarlo en cada llamada como `Authorization: Bearer {access_token}`.

---

## Paso 2 — Llamar a los endpoints

Base de todos: `{BaseURL}/usuarios-actions/...`, con `Authorization: Bearer {token}`.

> ⚠️ **No enviar `Content-Type: application/json` en requests GET** (sin body):
> ORDS intenta parsear el body vacío como JSON y falla. Solo el POST de
> `register` lleva `Content-Type: application/json`.

### Crear usuario — `POST /usuarios-actions/register`

```
POST {BaseURL}/usuarios-actions/register
Authorization: Bearer {token}
Content-Type: application/json

{
  "email": "persona@efe.cl",
  "password": "<hash bcrypt>",
  "nombre": "Nombre Apellido",
  "rol": "usuario"
}
```

- `rol` es opcional (por defecto `usuario`).
- ⚠️ **`password` debe ser un HASH bcrypt, NO la contraseña en texto plano.**
  El sistema guarda el valor tal cual llega y toda la verificación (login de la
  PWA, doble verificación de esta integración) se hace con `bcrypt.compare`
  contra ese valor. Si se envía texto plano, la comparación nunca coincidirá.
  Generar el hash con bcrypt (cost 10) del lado de la plataforma antes de enviar.

Respuesta (`201`):

```json
{ "id_out": "A1B2C3D4E5F6..." }
```

`id_out` es el id del usuario en **hex**.

### Listar usuarios — `GET /usuarios-actions/listar`

Sin hash. Paginado por ORDS (25 por página; usar los enlaces `next` que
devuelve el feed para avanzar).

```
GET {BaseURL}/usuarios-actions/listar
Authorization: Bearer {token}
```

Respuesta:

```json
{
  "items": [
    {
      "id": "A1B2C3...",
      "email": "persona@efe.cl",
      "nombre": "Nombre Apellido",
      "rol": "usuario",
      "auth_type": "local",
      "activo": 1,
      "created_at": "2026-09-11T13:45:02Z",
      "last_login": "2026-09-11T14:10:33Z"
    }
  ],
  "hasMore": false,
  "limit": 25,
  "offset": 0
}
```

### Obtener usuario por id — `GET /usuarios-actions/{id}`

Sin hash. `{id}` en **hex** (el mismo formato de `id` / `id_out`).

```
GET {BaseURL}/usuarios-actions/A1B2C3...
Authorization: Bearer {token}
```

El usuario viene en `items[0]`. Si no existe, `items` llega vacío (`[]`).

### Obtener usuario por email (con hash) — `GET /usuarios-actions/por-email/{email}`

**Este es el endpoint de la doble verificación.** Devuelve `password_hash`
además de los datos del usuario.

```
GET {BaseURL}/usuarios-actions/por-email/persona@efe.cl
Authorization: Bearer {token}
```

Respuesta:

```json
{
  "items": [
    {
      "id": "A1B2C3...",
      "email": "persona@efe.cl",
      "nombre": "Nombre Apellido",
      "rol": "usuario",
      "auth_type": "local",
      "activo": 1,
      "password_hash": "$2a$10$....",
      "created_at": "2026-09-11T13:45:02Z",
      "last_login": "2026-09-11T14:10:33Z"
    }
  ]
}
```

- El usuario viene en `items[0]`. Si no existe, `items` llega vacío (`[]`).
- La comparación se hace en el backend de la plataforma:
  `bcrypt.compare(passwordTextoPlano, item.password_hash)` → `true` / `false`.
- **Nunca** almacenar ni loguear `password_hash` fuera de la memoria del
  proceso que hace la comparación.

---

## Formato de datos

- `id` siempre en **hex**.
- `created_at` / `last_login` en **UTC ISO 8601 con `Z`**
  (ej. `2026-09-11T13:45:02Z`). `last_login` puede ser `null`.
- `activo`: `1` (activo) / `0` (inactivo).

---

## Errores esperables (Sad Path)

| Código | Causa |
|--------|-------|
| `401` | Falta token, token inválido o expirado → pedir/renovar token. |
| `403` | El client no tiene permiso sobre ese recurso. |
| `404` / `items: []` | Recurso no encontrado (email/id inexistente). |
| `405` | Método no permitido en esa ruta (ej. `GET` a `register`). |
| `4xx` | id mal formado (no hex) en `GET /{id}`. |

---

## Seguridad — resumen

- Autenticación exclusivamente OAuth2 `client_credentials` sobre HTTPS.
- El client `AYP_INTEGRACION_EXTERNA` está acotado a `/usuarios-actions/*`
  (no tiene acceso al AutoREST directo de la tabla `usuarios`).
- `password_hash` solo se expone en `por-email` (no en `listar` ni en `{id}`),
  y es un hash bcrypt — resistente a cracking offline, pero igualmente
  tratarlo como dato sensible.
