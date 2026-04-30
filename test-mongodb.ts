import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const uri = process.env.MONGODB_URI;
console.log("MONGODB_URI present:", !!uri);

if (!uri) {
  console.error("❌ MONGODB_URI is undefined");
  process.exit(1);
}

async function test() {
  const client = new MongoClient(uri!);
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Connected to MongoDB");

    const dbs = await client.db().admin().listDatabases();
    console.log("Databases:", dbs.databases.map((d) => d.name));
  } catch (err) {
    console.error("❌ Connection failed:", err);
  } finally {
    await client.close();
  }
}

test();