# ─────────────────────────────────────────────
# Etapa 1 — Build de la SPA con Node
# ─────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Dependencias primero (capa cacheable)
COPY package*.json ./
RUN npm ci

# Resto del código y compilación
COPY . .

# VITE_API_URL vacío ⇒ el frontend llama con rutas RELATIVAS (mismo origen);
# nginx hace de reverse proxy hacia el backend. Así la imagen es INMUTABLE
# entre ambientes: no se hornea ninguna URL del backend en el build.
ARG VITE_API_URL=""
ARG VITE_USE_API_V2="false"
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_USE_API_V2=${VITE_USE_API_V2}

RUN npm run build

# ─────────────────────────────────────────────
# Etapa 2 — Servir con nginx
# ─────────────────────────────────────────────
FROM nginx:alpine

# La imagen oficial procesa /etc/nginx/templates/*.template con envsubst al
# arrancar. Solo sustituimos las variables BACKEND_* (resueltas en runtime),
# para no tocar las variables propias de nginx ($uri, $host, etc.).
ENV NGINX_ENVSUBST_FILTER="^BACKEND_"

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
# CMD heredado de la imagen base de nginx (arranca el entrypoint + nginx)
