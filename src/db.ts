import { MongoClient } from "mongodb";

const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);

let isConnected = false;

export async function getDB(){
    if(!isConnected){
        await client.connect();
        isConnected = true;
        console.log("MongoDB connected");
    }
    return client.db("compatibility_research");
}