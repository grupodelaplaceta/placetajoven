// Placeta Joven — almacenamiento de suscripciones (colección placeta_joven)
// - Si existe MONGODB_URI usa MongoDB (producción recomendada).
// - Si no, usa memoria (válido para desarrollo/tests, se pierde al reiniciar).
'use strict';

const memoria = new Map();

function newDoc(dip) {
  const now = new Date().toISOString();
  return {
    placeta_id: String(dip).trim().toUpperCase(),
    status: 'PENDIENTE',
    plan: null,
    started_at: null,
    expires_at: null,
    payment_provider: 'lemonsqueezy',
    subscription_id: null,
    created_at: now,
    updated_at: now
  };
}

async function coleccion() {
  if (!process.env.MONGODB_URI) return null;
  try {
    const { MongoClient } = require('mongodb');
    if (!coleccion._client) {
      coleccion._client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
      await coleccion._client.connect();
    }
    const dbName = process.env.MONGODB_DB || 'laplaceta';
    return coleccion._client.db(dbName).collection('placeta_joven');
  } catch (e) {
    return null; // si no hay driver o no conecta, caemos a memoria
  }
}

module.exports = {
  newDoc,

  async get(dip) {
    const key = String(dip).trim().toUpperCase();
    const col = await coleccion();
    if (col) {
      const d = await col.findOne({ placeta_id: key });
      return d || null;
    }
    return memoria.get(key) || null;
  },

  async set(doc) {
    if (!doc || !doc.placeta_id) return;
    const col = await coleccion();
    if (col) {
      await col.replaceOne({ placeta_id: doc.placeta_id }, doc, { upsert: true });
    } else {
      memoria.set(String(doc.placeta_id).trim().toUpperCase(), Object.assign({}, doc));
    }
  },

  async del(dip) {
    const key = String(dip).trim().toUpperCase();
    const col = await coleccion();
    if (col) {
      await col.deleteOne({ placeta_id: key });
    } else {
      memoria.delete(key);
    }
  }
};
