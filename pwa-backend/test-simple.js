const axios = require('axios');
require('dotenv').config();

const API_URL = 'http://localhost:3001/api/datos';

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = (color, message) => console.log(`${colors[color]}${message}${colors.reset}`);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCRUD() {
  log('cyan', '\n╔════════════════════════════════════════════════════╗');
  log('cyan', '║     🧪 TEST COMPLETO - CRUD SharePoint PWA        ║');
  log('cyan', '╚════════════════════════════════════════════════════╝\n');

  let testItemId = null;
  let allTestsPassed = true;

  try {
    // ========================================
    // TEST 0: Health Check
    // ========================================
    log('blue', '🏥 TEST 0: Health Check');
    log('blue', '━'.repeat(50));
    try {
      const health = await axios.get('http://localhost:3001/');
      log('green', '✅ Servidor funcionando');
      console.log('   Status:', health.data.status);
      console.log('');
    } catch (error) {
      log('red', '❌ Servidor no responde');
      log('red', '   Asegúrate de ejecutar: npm run dev');
      return;
    }

    await sleep(500);

    // ========================================
    // TEST 1: CREATE
    // ========================================
    log('blue', '📝 TEST 1: POST - Crear Item');
    log('blue', '━'.repeat(50));
    
    const testData = {
      nombre: 'Test Automatizado CRUD',
      descripcion: 'Este es un test completo de todas las operaciones',
      timestamp: new Date().toISOString(),
      id: Date.now()
    };

    console.log('   Datos a enviar:', testData);
    
    try {
      const createResponse = await axios.post(API_URL, testData);
      
      if (createResponse.status === 201 && createResponse.data.success) {
        testItemId = createResponse.data.data.id;
        log('green', `✅ Item creado exitosamente`);
        console.log('   ID asignado:', testItemId);
        console.log('   Datos:', JSON.stringify(createResponse.data.data, null, 2));
        
        // Validar estructura
        const item = createResponse.data.data;
        if (item.id && item.nombre && item.descripcion && item.created_at) {
          log('green', '✅ Estructura de datos correcta');
        } else {
          log('yellow', '⚠️  Estructura incompleta');
          allTestsPassed = false;
        }
      } else {
        log('red', '❌ Respuesta inesperada');
        allTestsPassed = false;
      }
    } catch (error) {
      log('red', '❌ Error en CREATE');
      console.error('   ', error.response?.data || error.message);
      allTestsPassed = false;
      return; // Si falla CREATE, no continuar
    }

    console.log('');
    await sleep(1000);

    // ========================================
    // TEST 2: READ ALL
    // ========================================
    log('blue', '📋 TEST 2: GET - Obtener Todos los Items');
    log('blue', '━'.repeat(50));
    
    try {
      const getAllResponse = await axios.get(API_URL);
      
      if (getAllResponse.data.success && Array.isArray(getAllResponse.data.data)) {
        const items = getAllResponse.data.data;
        log('green', `✅ ${items.length} items obtenidos`);
        
        // Verificar que nuestro item está en la lista
        const ourItem = items.find(item => item.id === testItemId);
        if (ourItem) {
          log('green', `✅ Item creado encontrado en la lista (ID: ${testItemId})`);
        } else {
          log('yellow', '⚠️  Item creado no encontrado en la lista');
          allTestsPassed = false;
        }
        
        // Mostrar primeros 3 items
        console.log('   Primeros items:');
        items.slice(0, 3).forEach(item => {
          console.log(`   - ID: ${item.id}, Nombre: ${item.nombre}`);
        });
      } else {
        log('red', '❌ Respuesta inesperada');
        allTestsPassed = false;
      }
    } catch (error) {
      log('red', '❌ Error en READ ALL');
      console.error('   ', error.response?.data || error.message);
      allTestsPassed = false;
    }

    console.log('');
    await sleep(1000);

    // ========================================
    // TEST 3: READ ONE
    // ========================================
    log('blue', `🔍 TEST 3: GET - Obtener Item por ID (${testItemId})`);
    log('blue', '━'.repeat(50));
    
    try {
      const getOneResponse = await axios.get(`${API_URL}/${testItemId}`);
      
      if (getOneResponse.data.success && getOneResponse.data.data.id === testItemId) {
        log('green', '✅ Item obtenido correctamente');
        console.log('   Datos:', JSON.stringify(getOneResponse.data.data, null, 2));
        
        // Validar que los datos coinciden
        const item = getOneResponse.data.data;
        if (item.nombre === testData.nombre && item.descripcion === testData.descripcion) {
          log('green', '✅ Datos coinciden con los creados');
        } else {
          log('yellow', '⚠️  Datos no coinciden exactamente');
        }
      } else {
        log('red', '❌ Item no encontrado o respuesta incorrecta');
        allTestsPassed = false;
      }
    } catch (error) {
      log('red', '❌ Error en READ ONE');
      console.error('   ', error.response?.data || error.message);
      allTestsPassed = false;
    }

    console.log('');
    await sleep(1000);

    // ========================================
    // TEST 4: UPDATE
    // ========================================
    log('blue', `✏️  TEST 4: PUT - Actualizar Item (${testItemId})`);
    log('blue', '━'.repeat(50));
    
    const updateData = {
      nombre: 'Test Automatizado ACTUALIZADO',
      descripcion: 'Descripción modificada en el test'
    };

    console.log('   Datos a actualizar:', updateData);
    
    try {
      const updateResponse = await axios.put(`${API_URL}/${testItemId}`, updateData);
      
      if (updateResponse.data.success) {
        log('green', '✅ Item actualizado correctamente');
        console.log('   Datos actualizados:', JSON.stringify(updateResponse.data.data, null, 2));
        
        // Validar que updated_at cambió
        const item = updateResponse.data.data;
        if (item.nombre === updateData.nombre && item.descripcion === updateData.descripcion) {
          log('green', '✅ Cambios aplicados correctamente');
        } else {
          log('yellow', '⚠️  Cambios no se reflejan');
          allTestsPassed = false;
        }
        
        // Verificar que updated_at es diferente de created_at
        if (item.updated_at && item.updated_at !== item.created_at) {
          log('green', '✅ Timestamp de actualización correcto');
        }
      } else {
        log('red', '❌ Error al actualizar');
        allTestsPassed = false;
      }
    } catch (error) {
      log('red', '❌ Error en UPDATE');
      console.error('   ', error.response?.data || error.message);
      allTestsPassed = false;
    }

    console.log('');
    await sleep(1000);

    // ========================================
    // TEST 5: DELETE
    // ========================================
    log('blue', `🗑️  TEST 5: DELETE - Eliminar Item (${testItemId})`);
    log('blue', '━'.repeat(50));
    
    try {
      const deleteResponse = await axios.delete(`${API_URL}/${testItemId}`);
      
      if (deleteResponse.data.success) {
        log('green', '✅ Item eliminado correctamente');
        console.log('   Mensaje:', deleteResponse.data.message);
        
        // Verificar que ya no existe
        try {
          await axios.get(`${API_URL}/${testItemId}`);
          log('yellow', '⚠️  Item todavía existe después de eliminar');
          allTestsPassed = false;
        } catch (error) {
          if (error.response?.status === 404) {
            log('green', '✅ Confirmado: Item ya no existe');
          }
        }
      } else {
        log('red', '❌ Error al eliminar');
        allTestsPassed = false;
      }
    } catch (error) {
      log('red', '❌ Error en DELETE');
      console.error('   ', error.response?.data || error.message);
      allTestsPassed = false;
    }

    console.log('');

  } catch (error) {
    log('red', '❌ Error general en los tests');
    console.error(error);
    allTestsPassed = false;
  }

  // ========================================
  // RESUMEN FINAL
  // ========================================
  console.log('');
  log('cyan', '╔════════════════════════════════════════════════════╗');
  if (allTestsPassed) {
    log('green', '║          🎉 TODOS LOS TESTS PASARON ✅             ║');
    log('cyan', '╚════════════════════════════════════════════════════╝');
    log('green', '\n✅ Tu backend está listo para conectar con el frontend\n');
  } else {
    log('yellow', '║          ⚠️  ALGUNOS TESTS FALLARON               ║');
    log('cyan', '╚════════════════════════════════════════════════════╝');
    log('yellow', '\n⚠️  Revisa los errores arriba y verifica:\n');
    console.log('   1. Todos los flows están creados y activados');
    console.log('   2. Las URLs están correctas en el .env');
    console.log('   3. Las columnas de SharePoint están configuradas');
    console.log('   4. El backend está ejecutándose (npm run dev)\n');
  }
}

// Ejecutar tests
testCRUD();