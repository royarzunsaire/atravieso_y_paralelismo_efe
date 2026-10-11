# ─────────────────────────────────────────────
# Etapa 1 — Build de la SPA con Node
# ─────────────────────────────────────────────
# Imágenes base (hallazgo H-12). Node 24 LTS para compilar (Node 20 está sin soporte desde abril de 2026) y nginx SIN privilegios
# (corre como usuario no root). Para FIJAR la versión exacta (recomendado en producción), pasar --build-arg con el digest:
#   --build-arg NODE_IMAGE=node:24-alpine@sha256:<digest>   --build-arg NGINX_IMAGE=nginxinc/nginx-unprivileged:stable-alpine@sha256:<digest>
ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:stable-alpine

FROM ${NODE_IMAGE} AS build

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
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ─────────────────────────────────────────────
# Etapa 2 — Servir con nginx
# ─────────────────────────────────────────────
FROM ${NGINX_IMAGE}

# La imagen oficial procesa /etc/nginx/templates/*.template con envsubst al
# arrancar. Solo sustituimos las variables BACKEND_* (resueltas en runtime),
# para no tocar las variables propias de nginx ($uri, $host, etc.).
ENV NGINX_ENVSUBST_FILTER="^(BACKEND_|CSP_)"
# Origen de la API del cliente de donde el navegador baja las fotos (CSP connect-src). Se define al desplegar
# (ej. https://api.cliente.cl). Vacío = las fotos descargadas no cargarían.
ENV CSP_CONNECT_EXTRA=""

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY seguridad.inc.template /etc/nginx/templates/seguridad.inc.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
# CMD heredado de la imagen base de nginx (arranca el entrypoint + nginx)
