// Configuración en ejecución. En desarrollo no define nada (se usa VITE_API_URL). En la imagen Docker este archivo lo reemplaza el que
// genera el contenedor al arrancar (docker-entrypoint.d/40-ayp-config.sh) con la variable API_URL.
window.__AYP_CONFIG__ = {};
