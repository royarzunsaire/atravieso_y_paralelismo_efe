# Imagen base: Node 24 LTS (Node 20 salió de soporte en abril de 2026), FIJADA por digest: es exactamente la imagen con que se probó (11-10-2026,
# node v24.21.0). Para actualizarla: obtener un digest nuevo (ver oci-deploy.md), reprobar y cambiarlo aquí o con --build-arg NODE_IMAGE=...
ARG NODE_IMAGE=node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
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
