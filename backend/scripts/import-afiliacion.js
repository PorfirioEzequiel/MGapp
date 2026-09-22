require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const data     = require('../../src/data/afiliacion.json');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI_CAIDA_CREDENCIALES);
  console.log('[MONGO] Conectado ✅');

  const col = mongoose.connection.db.collection('pipeline-credenciales');

  // Limpia la colección antes de reimportar para evitar duplicados
  await col.deleteMany({});
  console.log('[MONGO] Colección limpiada');

  const docs = data.map(({ sp, seccion, afiliados, impresiones, loteadas,
    sin_datos, en_stock, entregadas_sp, comprobadas,
    credenciales_entregadas, pct_avance, sin_entregar }) => ({
    sp, seccion, afiliados, impresiones, loteadas,
    sin_datos, en_stock, entregadas_sp, comprobadas,
    credenciales_entregadas, pct_avance, sin_entregar,
  }));

  await col.insertMany(docs);
  console.log(`[MONGO] ${docs.length} secciones importadas ✅`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
