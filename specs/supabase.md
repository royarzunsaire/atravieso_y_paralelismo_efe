---
name: supabase-auth-node-deploy
description: >
  Skill para configurar, depurar y deployar autenticación local con Supabase
  en aplicaciones Node.js/Express con frontend React/Vite. Úsalo cuando el
  usuario mencione: login local con Supabase, migración desde SQLite a Supabase,
  deploy en Render + Vercel, errores de CORS en producción, "Usuario no encontrado"
  intermitente, RLS bloqueando queries, cliente Supabase contaminado por sesión,
  o cualquier combinación de Express + Passport + JWT + Supabase Auth.
---

# Supabase Auth + Node.js — Agent Skill

## Contexto y arquitectura

Este skill captura el conocimiento de configurar autenticación dual
(login local + Microsoft/Azure AD) en una app monorepo con:

- **Backend:** Node.js + Express + Passport.js + JWT + Supabase
- **Frontend:** React + Vite (PWA)
- **Deploy:** Render (backend) + Vercel (frontend)
- **Auth:** Supabase Auth (gestión de sesiones) + tabla `usuarios` (perfil app)

---

## Spec — Arquitectura de autenticación

### Dos sistemas en paralelo

```
┌─────────────────────────────────────────────────┐
│              SUPABASE                           │
│                                                 │
│  ┌──────────────────┐   ┌────────────────────┐  │
│  │  Supabase Auth   │   │  Tabla: usuarios   │  │
│  │  (auth.users)    │   │  (public.usuarios) │  │
│  │                  │   │                    │  │
│  │  - UUID          │   │  - id (int/uuid)   │  │
│  │  - email         │   │  - email           │  │
│  │  - password hash │   │  - password (bcrypt)│  │
│  │  - sessions      │   │  - rol             │  │
│  │                  │   │  - auth_type       │  │
│  │  → connection_   │   │  - activo          │  │
│  │    token         │   │  → JWT propio app  │  │
│  └──────────────────┘   └────────────────────┘  │
└─────────────────────────────────────────────────┘
```

El usuario debe existir en **ambos** sistemas para que el login funcione.
`create-test-user.js` hace las dos operaciones en secuencia.

### Dos tokens generados al login

| Token | Origen | Uso |
|-------|--------|-----|
| `token` | JWT propio (`JWT_SECRET`) | Authorization header en cada request |
| `connection_token` | Supabase Auth session | Operaciones directas a Supabase desde el cliente |

---

## Spec — Variables de entorno requeridas

### Backend (`pwa-backend/.env`)

```env
# Críticas — sin estas el servidor no arranca
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # DEBE ser service_role, NO anon
JWT_SECRET=clave-secreta-larga
SESSION_SECRET=otra-clave-secreta

# Deploy
NODE_ENV=production
FRONTEND_URL=https://tu-app.vercel.app
RENDER_EXTERNAL_URL=https://tu-backend.onrender.com

# Azure AD (opcional)
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=
AZURE_AD_REDIRECT_URI=

# Power Automate Flows
FLOW_SOLICITUD_READ_ALL_URL=
FLOW_SOLICITUD_READ_ONE_URL=
FLOW_ARCHIVOS_LISTAR_URL=
FLOW_INSPECCIONES_CREAR_URL=
FLOW_INSPECCIONES_LISTAR_URL=
FLOW_FOTOS_SUBIR_URL=
FLOW_FOTOS_LISTAR_URL=
FLOW_FOTOS_CONTENIDO_URL=
FLOW_TIPOS_INSPECCION_URL=
FLOW_USUARIOS_URL=
```

### Frontend (`pwa-frontend/.env.production`)

```env
VITE_API_URL=https://tu-backend.onrender.com
```

---

## Spec — Tabla `usuarios` en Supabase

```sql
create table usuarios (
  id        uuid primary key default gen_random_uuid(),
  email     text unique not null,
  password  text not null,           -- bcrypt hash, NUNCA plain text
  nombre    text not null,
  rol       text default 'usuario',
  auth_type text default 'local',
  activo    boolean default true,
  created_at timestamptz default now(),
  last_login timestamptz
);

-- En ambiente de desarrollo/pruebas
alter table usuarios disable row level security;
```

---

## Spec — Dos clientes Supabase separados (CRÍTICO)

### El problema

`supabase.auth.signInWithPassword()` modifica el estado interno del cliente
compartido, sobreescribiendo el contexto `service_role` con la sesión del
usuario. En el siguiente request, las queries a la tabla devuelven `null`
sin lanzar error — exactamente como si RLS bloqueara.

### La solución: `supabase.js`

```js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
}

// Cliente admin — service_role, bypasea RLS
// NUNCA debe mutar su estado de sesión
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// Cliente auth — solo para signIn/signOut
// Este SÍ puede mutar su estado de sesión
const supabaseAuth = createClient(supabaseUrl, anonKey || serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

module.exports = { supabaseAdmin, supabaseAuth };
```

### Regla de uso

| Operación | Cliente a usar |
|-----------|---------------|
| `from('usuarios').select/insert/update` | `supabaseAdmin` |
| `auth.admin.createUser()` | `supabaseAdmin` |
| `auth.signInWithPassword()` | `supabaseAuth` |
| `auth.admin.signOut()` | `supabaseAdmin` |

---

## Spec — Crear usuario (script)

El script debe crear el usuario en **ambos** sistemas:

```js
// 1. Supabase Auth (para connection_token)
await supabaseAdmin.auth.admin.createUser({
  email, password,           // password en plain text aquí
  email_confirm: true,
  user_metadata: { nombre },
});

// 2. Tabla usuarios (para el perfil de la app)
const hashedPassword = await bcrypt.hash(password, 10);
await supabaseAdmin.from('usuarios').insert({
  email,
  password: hashedPassword,  // bcrypt hash aquí
  nombre, rol: 'admin',
  auth_type: 'local', activo: true,
});
```

> ⚠️ `auth.admin.createUser()` requiere `SERVICE_ROLE_KEY`.
> Con `ANON_KEY` falla con "This endpoint requires a valid Bearer token".

---

## Spec — CORS para monorepo en producción

```js
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Postman/curl
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origen no permitido → ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Version'],
}));
```

> ⚠️ `FRONTEND_URL` debe coincidir **exactamente** con el origen de Vercel,
> sin barra al final: `https://mi-app.vercel.app`

---

## Spec — Health check endpoint

Exponer `/health` para verificar estado en producción:

```js
app.get('/health', (req, res) => {
  const checks = {
    supabase:          !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    jwt:               !!process.env.JWT_SECRET,
    session:           !!process.env.SESSION_SECRET,
    frontend_url:      !!process.env.FRONTEND_URL,
    azure_ad:          !!(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_TENANT_ID),
    flow_solicitudes:  !!process.env.FLOW_SOLICITUD_READ_ALL_URL,
    flow_inspecciones: !!process.env.FLOW_INSPECCIONES_CREAR_URL,
    flow_archivos:     !!process.env.FLOW_ARCHIVOS_LISTAR_URL,
    flow_fotos:        !!process.env.FLOW_FOTOS_SUBIR_URL,
    flow_tipos:        !!process.env.FLOW_TIPOS_INSPECCION_URL,
    flow_usuarios:     !!process.env.FLOW_USUARIOS_URL,
  };

  const allCriticalOk = checks.supabase && checks.jwt && checks.session;

  res.status(allCriticalOk ? 200 : 207).json({
    status: allCriticalOk ? 'ok' : 'degraded',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    checks,
  });
});
```

---

## Spec — Deploy checklist

### Backend en Render

```
Root Directory:   pwa-backend
Build Command:    npm install
Start Command:    node server.js
Environment:      Node
```

Variables de entorno mínimas en Render:
- `NODE_ENV=production`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `SESSION_SECRET`
- `FRONTEND_URL`
- `RENDER_EXTERNAL_URL`
- Todos los `FLOW_*`

### Frontend en Vercel

```
Root Directory:   pwa-frontend
Build Command:    npm run build
Output Directory: dist
```

Variables en Vercel:
- `VITE_API_URL=https://tu-backend.onrender.com`

### `vercel.json` (routing del PWA)

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Supabase — URL Configuration

```
Site URL: https://tu-app.vercel.app
```

---

## Árbol de diagnóstico — errores frecuentes

```
Error recibido
│
├── "Cannot GET /auth/login/local"
│   └── El request llega como GET en vez de POST
│       ├── Causa: test manual en el browser (navegar al URL)
│       ├── Causa: service worker del PWA cacheando requests
│       └── Fix: usar Postman con POST, limpiar SW en DevTools
│
├── "Usuario no encontrado"
│   ├── Causa A: tabla `usuarios` no existe o está vacía
│   │   └── Fix: crear tabla + ejecutar create-test-user.js
│   ├── Causa B: RLS activado + usando anon key
│   │   └── Fix: disable RLS o usar SERVICE_ROLE_KEY
│   └── Causa C: cliente Supabase contaminado por sesión ← MÁS COMÚN
│       └── Fix: separar supabaseAdmin y supabaseAuth
│
├── "Contraseña incorrecta"
│   └── El hash en la tabla no corresponde al password
│       └── Fix: generar hash con bcrypt desde Node, no manualmente
│           node -e "const b=require('bcryptjs'); b.hash('pass',10).then(console.log)"
│
├── "This endpoint requires a valid Bearer token"
│   └── auth.admin.createUser() con anon key
│       └── Fix: usar SERVICE_ROLE_KEY
│
├── "Invalid login credentials" (en signInLocalAuthUser)
│   └── Usuario existe en tabla pero NO en Supabase Auth
│       └── Fix: ejecutar createLocalAuthUser() para crearlo en Auth
│
└── CORS bloqueado en producción
    └── FRONTEND_URL en Render no coincide exactamente con origen Vercel
        └── Fix: verificar sin trailing slash, redeploy Render
```

---

## Flujo de debug recomendado

### Paso 1 — Postman antes que el browser

```
POST http://localhost:3001/auth/login/local
Content-Type: application/json

{ "email": "...", "password": "..." }
```

Esto descarta CORS y problemas del frontend.

### Paso 2 — Verificar qué key usa Supabase

Agregar al health check temporalmente:
```js
supabase_key_type: process.env.SUPABASE_SERVICE_ROLE_KEY
  ? 'service_role ✅'
  : 'anon ⚠️'
```

### Paso 3 — Log en LocalStrategy

```js
console.log('🔍 Buscando:', email);
const user = await usersDb.getLocalActiveUserByEmail(email);
console.log('👤 Encontrado:', user ? 'SÍ' : 'NO');
console.log('📦 Raw:', JSON.stringify(user));
```

### Paso 4 — Log en database.js

```js
const { data, error } = await supabaseAdmin
  .from('usuarios').select('*')
  .eq('email', email).maybeSingle();
console.log('Data:', JSON.stringify(data));
console.log('Error:', JSON.stringify(error));
```

Si `data: null` y `error: null` con service_role key → cliente contaminado.

---

## Notas de producción

### Render plan gratuito — hibernación

El servidor hiberna tras 15 minutos sin tráfico. Solución: keep-alive ping.

```js
// keepalive.js
function startKeepAlive() {
  if (process.env.NODE_ENV !== 'production') return;
  const url = `${process.env.RENDER_EXTERNAL_URL}/health`;
  setInterval(() => {
    https.get(url, (res) =>
      console.log(`🏓 Keep-alive → ${res.statusCode}`)
    ).on('error', (e) =>
      console.warn('⚠️  Keep-alive failed:', e.message)
    );
  }, 14 * 60 * 1000); // cada 14 minutos
}
```

### RLS en Supabase

- **Desarrollo/pruebas:** `alter table usuarios disable row level security;`
- **Producción:** Configurar policies + usar `SERVICE_ROLE_KEY` en backend

### bcrypt — hash correcto

```bash
# Generar hash desde Node (no manualmente en SQL)
node -e "const b=require('bcryptjs'); b.hash('MiPassword',10).then(console.log)"
```

Los `/` en el hash son normales — forman parte del alfabeto Base64 de bcrypt.

---

## Referencias cruzadas

- `pwa-backend/supabase.js` — clientes separados admin/auth
- `pwa-backend/database.js` — queries usando supabaseAdmin
- `pwa-backend/routes/auth.js` — login/logout/register endpoints
- `pwa-backend/config/auth.js` — LocalStrategy de Passport
- `pwa-backend/scripts/create-test-user.js` — creación de usuario en ambos sistemas
- `pwa-backend/server.js` — CORS, health check, keep-alive
- `pwa-frontend/src/services/auth.js` — logout llamando al backend
