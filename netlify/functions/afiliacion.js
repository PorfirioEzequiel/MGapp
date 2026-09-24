const { MongoClient } = require('mongodb');

let cachedClient = null;
let _cache = null;
let _cacheAt = 0;
const TTL = 5 * 60 * 1000; // 5 minutos

async function getClient() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(process.env.MONGODB_URI_CAIDA_CREDENCIALES);
  await client.connect();
  cachedClient = client;
  return client;
}

exports.handler = async (event) => {
  try {
    const now = Date.now();
    const forceRefresh = event.queryStringParameters?.refresh === 'true';
    if (_cache && !forceRefresh && (now - _cacheAt) < TTL) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(_cache),
      };
    }

    const client = await getClient();
    const col = client.db().collection('pipeline-credenciales');
    const docs = await col.find({}, { projection: { _id: 0 } }).toArray();

    _cache = docs;
    _cacheAt = now;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(docs),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
