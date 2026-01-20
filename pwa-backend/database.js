const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Crear/conectar a la base de datos
const db = new sqlite3.Database(path.join(__dirname, 'datos.db'), (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err);
  } else {
    console.log('Conectado a la base de datos SQLite');
  }
});

// Crear tabla si no existe
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS datos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      client_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error al crear tabla:', err);
    } else {
      console.log('Tabla "datos" lista');
    }
  });
});

module.exports = db;