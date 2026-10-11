// Errores que nadie capturó (H-22). Tras una excepción no controlada el proceso puede quedar en un estado inconsistente
// (conexiones a medias, cola de sincronización a medio procesar): lo seguro es registrar y TERMINAR para que Docker/OCI
// lo reinicie limpio (compose: `restart: unless-stopped`). Fuera de producción solo se registra, para no cortar el servidor
// de desarrollo (nodemon) por un error de una petición.
const enProduccion = () => process.env.NODE_ENV === 'production';

function terminarSiProduccion(origen) {
  if (!enProduccion()) return;
  console.error(`⛔ Cerrando el proceso tras ${origen} (se espera que el orquestador lo reinicie).`);
  // Un respiro para que se vacíen los logs; unref para no retener el proceso si ya se está cerrando solo.
  setTimeout(() => process.exit(1), 200).unref();
}

process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException:', err?.message, err?.stack);
  terminarSiProduccion('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 unhandledRejection:', reason instanceof Error ? `${reason.message}\n${reason.stack}` : reason);
  terminarSiProduccion('unhandledRejection');
});
