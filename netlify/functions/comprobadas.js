const { MongoClient } = require('mongodb');

let cachedClient = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(process.env.MONGODB_URI_CAIDA_CREDENCIALES);
  await client.connect();
  cachedClient = client;
  return client;
}

exports.handler = async () => {
  try {
    const client = await getClient();
    const col = client.db().collection('registros-credenciales');

    const [bySec, sp0Raw] = await Promise.all([
      col.aggregate([
        { $match: { seccion: { $gt: 0 } } },
        { $group: { _id: '$seccion', comprobadas: { $sum: 1 } } },
      ]).toArray(),
      col.aggregate([
        { $match: { $or: [{ seccion: 0 }, { seccion: null }, { seccion: { $exists: false } }] } },
        { $match: { sp: { $gt: 0 } } },
        { $group: { _id: '$sp', comprobadas: { $sum: 1 } } },
      ]).toArray(),
    ]);

    const bySp0 = {};
    sp0Raw.forEach(r => { bySp0[r._id] = r.comprobadas; });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        bySec: bySec.map(r => ({ seccion: r._id, comprobadas: r.comprobadas })),
        bySp0,
      }),
    };
  } catch (err) {
    cachedClient = null;
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
