/**
 * Shared MongoDB client for aiplanner data APIs.
 * Database: mongodb://localhost:27017/aiplanner
 */

import { MongoClient, Db } from "mongodb";

const MONGO_URI = process.env.MONGODB_URI || ""

let client: MongoClient | null = null;
export async function getMongoClient(): Promise<MongoClient> {
  if (!client) {
    client = new MongoClient(MONGO_URI);
    await client.connect();
  }
  return client;
}

export async function getDb(): Promise<Db> {
  const c = await getMongoClient();
  return c.db();
}
