# Imagen base: Node 24 LTS (Node 20 salió de soporte en abril de 2026). Para FIJAR la versión exacta (recomendado en producción):
#   docker build --build-arg NODE_IMAGE=node:24-alpine@sha256:<digest> ...   (cómo obtener el digest: ver oci-deploy.md)
ARG NODE_IMAGE=node:24-alpine
FROM ${NODE_IMAGE}

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .

ENV NODE_ENV=production \
    PORT=3001
EXPOSE 3001

# No correr como root (CIS Docker 4.1, hallazgo H-12). El backend no escribe a disco.
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["node", "server.js"]
