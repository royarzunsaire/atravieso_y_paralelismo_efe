const express = require('express');
const cors = require('cors');
require('dotenv').config();

const datosRoutes = require('./routes/datos');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: '✓ API funcionando',
    status: 'online'
  });
});

app.use('/api/datos', datosRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log(`✓ Servidor en puerto ${PORT}`);
  console.log(`✓ Flow CREATE: ${process.env.FLOW_CREATE_URL ? 'Configurado' : '❌ NO'}`);
  console.log('='.repeat(50));
});
