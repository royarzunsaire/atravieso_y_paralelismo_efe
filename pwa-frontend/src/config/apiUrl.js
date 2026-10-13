// Dirección del backend. Se resuelve en este orden:
//  1. `window.__AYP_CONFIG__.API_URL`: lo escribe `config.js`, que el contenedor genera AL ARRANCAR desde su variable de entorno
//     `API_URL` (así la MISMA imagen sirve para desarrollo y producción). Texto vacío = mismo origen (nginx hace de proxy).
//  2. `VITE_API_URL`: valor fijado al compilar (desarrollo local y la imagen Docker de compose, donde es '').
//  3. `http://localhost:3001` (solo desarrollo local sin ninguna configuración).
// Sin barra final, para poder escribir `${API_URL}/auth/...`.
const enEjecucion = typeof window !== 'undefined' ? window.__AYP_CONFIG__?.API_URL : undefined;
const bruto = typeof enEjecucion === 'string' ? enEjecucion : (import.meta.env.VITE_API_URL ?? 'http://localhost:3001');

export const API_URL = String(bruto).trim().replace(/\/+$/, '');
