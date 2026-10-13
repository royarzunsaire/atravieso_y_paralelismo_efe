require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');

// Herramienta de exploración de la API del cliente. Nada va escrito en el código (H-12 / H-20):
//   SHAREPOINT_API_URL y SHAREPOINT_API_SECRET salen del .env; el correo de prueba, de CORREO_PRUEBA.
// Las lecturas (GET) corren siempre; el envío de un evento de PRUEBA (POST, escribe en SharePoint) solo con --escribir.
const API_BASE_URL = process.env.SHAREPOINT_API_URL;
const CORREO_PRUEBA = process.env.CORREO_PRUEBA;

async function main() {
  const secreto = process.env.SHAREPOINT_API_SECRET;
  if (!secreto || !API_BASE_URL || !CORREO_PRUEBA) {
    console.error('Faltan SHAREPOINT_API_URL y SHAREPOINT_API_SECRET en .env, o CORREO_PRUEBA en el entorno');
    process.exit(1);
  }

  const token = jwt.sign(
    { email: CORREO_PRUEBA, nombre: 'Rodrigo Prueba' },
    secreto,
    { algorithm: 'HS256', expiresIn: '8h' }
  );

  const headers = { Authorization: `Bearer ${token}` };

  try {
    console.log('--- GET /v1/mobile/inicio ---');
    const respuestaInicio = await axios.get(`${API_BASE_URL}/v1/mobile/inicio`, { headers });
    console.log('Status:', respuestaInicio.status);
    console.log('Data:', JSON.stringify(respuestaInicio.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error de red:', error.message);
    }
  }

  try {
    console.log('\n--- GET /v1/solicitudes/136 ---');
    const respuestaDetalle = await axios.get(`${API_BASE_URL}/v1/solicitudes/136`, { headers });
    console.log('Status:', respuestaDetalle.status);
    console.log('Data:', JSON.stringify(respuestaDetalle.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error de red:', error.message);
    }
  }

  if (!process.argv.includes('--escribir')) {
    console.log('\n(Se omitió el POST de prueba: escribe en SharePoint. Usa --escribir para enviarlo.)');
    return;
  }

  try {
    console.log('\n--- POST /v1/solicitudes/136/eventos (prueba campos nuevos) ---');
    const eventoPrueba = {
      EventoIdExterno: crypto.randomUUID(),
      TipoEvento: 'INSPECCION_AVANCE',
      Origen: 'Mobile',
      FechaEvento: '2026-09-28T15:00:00Z',
      Payload: {
        Comentario: 'Prueba de campo fecha (2do intento, FechaEvento raiz) - ignorar',
        AvancePct: 30,
        TipoInspeccionId: 1,
        Fotos: [
          {
            Nombre: 'prueba_campos_nuevos.png',
            Contenido: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          },
        ],
      },
    };
    console.log('Body enviado:', JSON.stringify(eventoPrueba, null, 2));
    const respuestaEvento = await axios.post(`${API_BASE_URL}/v1/solicitudes/136/eventos`, eventoPrueba, { headers });
    console.log('Status:', respuestaEvento.status);
    console.log('Data:', JSON.stringify(respuestaEvento.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error de red:', error.message);
    }
  }
}

main();
