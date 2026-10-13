#!/bin/sh
# Genera /tmp/ayp-config.js con la dirección del backend (variable de entorno API_URL) cada vez que arranca el contenedor.
# nginx lo sirve como /config.js (ver nginx.conf.template). Vacío = mismo origen (nginx hace de proxy hacia BACKEND_HOST).
set -e
API="${API_URL:-}"
# Solo caracteres de una URL: nada de comillas, barras invertidas ni <>, para que el valor no pueda salirse del texto.
if ! printf '%s' "$API" | grep -Eq '^[A-Za-z0-9:/._~%+?&=#@!,;-]*$'; then
  echo "40-ayp-config.sh: API_URL contiene caracteres no permitidos; se ignora." >&2
  API=""
fi
printf 'window.__AYP_CONFIG__ = { API_URL: "%s" };\n' "$API" > /tmp/ayp-config.js
echo "40-ayp-config.sh: API_URL='${API}'"
