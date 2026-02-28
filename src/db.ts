import { MongoClient } from "mongodb";

const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri, {
  tls: true,
  serverSelectionTimeoutMS: 5000
});
console.log("DB file loaded");
console.log("MONGO_URI exists:", !!process.env.MONGO_URI);
let isConnected = false;

export async function getDB(){
    if(!isConnected){
        await client.connect();
        isConnected = true;
        console.log("MongoDB connected");
    }
    return client.db("compatibility_research");
}