import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;

if (!uri) {
  throw new Error("MONGO_URI is not defined");
}

const client = new MongoClient(uri);

let isConnected = false;

export async function getDB() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log("MongoDB connected");
  }
  return client.db("compatibility_research");
}