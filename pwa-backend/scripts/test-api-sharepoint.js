require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');

const API_BASE_URL = 'http://146.181.52.2:3000';
const CORREO_PRUEBA = 'gateway@efe.cl';

async function main() {
  const secreto = process.env.SHAREPOINT_API_SECRET;
  if (!secreto) {
    console.error('Falta SHAREPOINT_API_SECRET en .env');
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
