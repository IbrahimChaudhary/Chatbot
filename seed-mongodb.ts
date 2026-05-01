import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI!;
const dbName = process.env.MONGODB_DB || "sales_app";

if (!uri) {
  console.error("❌ MONGODB_URI not set");
  process.exit(1);
}

// Configuration — tweak these for more/less data
const NUM_PRODUCTS = 30;
const NUM_TRANSACTIONS = 8000;
const MONTHS_OF_HISTORY = 24; // 2+ years to match system prompt

// === Aligned with system prompt ===
const CATEGORIES = ["Electronics", "Furniture", "Stationery"];

const REGIONS = ["North America", "Europe", "Asia Pacific", "Latin America"];

const CUSTOMER_SEGMENTS = ["Enterprise", "SMB", "Individual", "Education"];

const PRODUCT_NAMES: Record<string, string[]> = {
  Electronics: [
    "Laptop Pro 15\"",
    "Wireless Mouse",
    "Monitor 27\"",
    "Mechanical Keyboard",
    "USB-C Hub",
    "Bluetooth Speaker",
    "Webcam HD",
    "Headphones Pro",
    "Tablet 11\"",
    "Smart Watch",
  ],
  Furniture: [
    "Office Chair Ergonomic",
    "Standing Desk",
    "Desk Lamp",
    "File Cabinet",
    "Bookshelf 5-Tier",
    "Conference Table",
    "Storage Cabinet",
    "Whiteboard Large",
    "Office Sofa",
    "Reception Desk",
  ],
  Stationery: [
    "Notebook Pack",
    "Pen Set Premium",
    "Highlighter Set",
    "Sticky Notes Bulk",
    "Stapler Heavy Duty",
    "Paper Ream A4",
    "Binder Set",
    "Marker Pack",
    "Desk Organizer",
    "Calendar Planner",
  ],
};

// Realistic price ranges per category — Electronics is more expensive than Stationery
const PRICE_RANGES: Record<string, [number, number]> = {
  Electronics: [50, 1500],
  Furniture: [80, 600],
  Stationery: [5, 50],
};

// Segment weights — Enterprise contributes more revenue, so weight transactions accordingly
const SEGMENT_WEIGHTS: Record<string, number> = {
  Enterprise: 0.4,
  SMB: 0.3,
  Individual: 0.2,
  Education: 0.1,
};

// Region weights from your old schema's documented breakdown
const REGION_WEIGHTS: Record<string, number> = {
  "North America": 0.45,
  Europe: 0.3,
  "Asia Pacific": 0.15,
  "Latin America": 0.1,
};

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedRandom(weights: Record<string, number>): string {
  const rand = Math.random();
  let cumulative = 0;
  for (const [key, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (rand <= cumulative) return key;
  }
  return Object.keys(weights)[0];
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomDateInPastMonths(months: number): Date {
  const now = new Date();
  const past = new Date();
  past.setMonth(past.getMonth() - months);
  const time = randomBetween(past.getTime(), now.getTime());
  return new Date(time);
}

// Apply Q4 seasonality boost — sales peak Oct-Dec
function getSeasonalMultiplier(date: Date): number {
  const month = date.getMonth(); // 0-indexed
  if (month >= 9 && month <= 11) return 1.5; // Q4 boost
  if (month >= 0 && month <= 2) return 0.8; // Q1 dip
  return 1.0;
}

async function seed() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");
    const db = client.db(dbName);

    // === Clear existing data ===
    console.log("🗑️  Clearing existing data...");
    await db.collection("products").deleteMany({});
    await db.collection("sales_transactions").deleteMany({});

    const existingEmbeddings = await db
      .listCollections({ name: "document_embeddings" })
      .toArray();
    if (existingEmbeddings.length > 0) {
      await db.collection("document_embeddings").drop();
      console.log("   Dropped existing document_embeddings collection");
    }

    // === Generate Products ===
    console.log(`📦 Generating ${NUM_PRODUCTS} products...`);
    const products = [];
    for (let i = 0; i < NUM_PRODUCTS; i++) {
      const category = randomItem(CATEGORIES);
      const baseName = randomItem(PRODUCT_NAMES[category]);
      const [minPrice, maxPrice] = PRICE_RANGES[category];
      products.push({
        _id: new ObjectId(),
        name: `${baseName} ${i + 1}`,
        category,
        price: Number(randomBetween(minPrice, maxPrice).toFixed(2)),
        createdAt: randomDateInPastMonths(MONTHS_OF_HISTORY),
      });
    }
    await db.collection("products").insertMany(products);
    console.log(`✅ Inserted ${products.length} products`);

    // === Generate Transactions ===
    console.log(`💰 Generating ${NUM_TRANSACTIONS} transactions...`);
    const transactions = [];
    for (let i = 0; i < NUM_TRANSACTIONS; i++) {
      const product = randomItem(products);
      const transactionDate = randomDateInPastMonths(MONTHS_OF_HISTORY);
      const seasonalMult = getSeasonalMultiplier(transactionDate);

      // Quantity higher for Stationery (bulk orders), lower for expensive Electronics
      let quantity: number;
      if (product.category === "Stationery") {
        quantity = Math.floor(randomBetween(5, 25) * seasonalMult);
      } else if (product.category === "Furniture") {
        quantity = Math.floor(randomBetween(1, 5) * seasonalMult);
      } else {
        quantity = Math.floor(randomBetween(1, 8) * seasonalMult);
      }
      quantity = Math.max(1, quantity);

      const unitPrice = product.price;
      const totalAmount = Number((quantity * unitPrice).toFixed(2));

      transactions.push({
        _id: new ObjectId(),
        transactionDate,
        product: {
          id: product._id,
          name: product.name,
          category: product.category,
        },
        quantity,
        unitPrice,
        totalAmount,
        customerSegment: weightedRandom(SEGMENT_WEIGHTS),
        region: weightedRandom(REGION_WEIGHTS),
        createdAt: transactionDate,
      });
    }

    const BATCH = 1000;
    for (let i = 0; i < transactions.length; i += BATCH) {
      await db.collection("sales_transactions").insertMany(transactions.slice(i, i + BATCH));
      console.log(`  Inserted ${Math.min(i + BATCH, transactions.length)}/${transactions.length}`);
    }
    console.log(`✅ Inserted ${transactions.length} transactions`);

    // === Create document_embeddings collection ===
    console.log("📄 Creating document_embeddings collection...");
    await db.createCollection("document_embeddings", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["content", "createdAt"],
          properties: {
            content: { bsonType: "string" },
            embedding: { bsonType: ["array", "null"] },
            metadata: { bsonType: ["object", "null"] },
            createdAt: { bsonType: "date" },
          },
        },
      },
      validationLevel: "moderate",
      validationAction: "error",
    });
    console.log("✅ document_embeddings collection created (empty)");

    // === Create Indexes ===
    console.log("📇 Creating indexes...");
    await db.collection("products").createIndex({ category: 1 });
    await db.collection("products").createIndex({ name: 1 });
    await db.collection("sales_transactions").createIndex({ transactionDate: -1 });
    await db
      .collection("sales_transactions")
      .createIndex({ "product.category": 1, transactionDate: -1 });
    await db
      .collection("sales_transactions")
      .createIndex({ region: 1, transactionDate: -1 });
    await db
      .collection("sales_transactions")
      .createIndex({ customerSegment: 1, transactionDate: -1 });
    await db.collection("document_embeddings").createIndex({ "metadata.type": 1 });
    await db.collection("document_embeddings").createIndex({ createdAt: -1 });
    console.log("✅ Indexes created");

    // === Verification ===
    const productCount = await db.collection("products").countDocuments();
    const txnCount = await db.collection("sales_transactions").countDocuments();
    const embCount = await db.collection("document_embeddings").countDocuments();

    // Show distributions to verify weights worked
    const segmentDist = await db
      .collection("sales_transactions")
      .aggregate([
        { $group: { _id: "$customerSegment", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    const regionDist = await db
      .collection("sales_transactions")
      .aggregate([
        { $group: { _id: "$region", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    const categoryDist = await db
      .collection("sales_transactions")
      .aggregate([
        { $group: { _id: "$product.category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    console.log("\n📊 Final counts:");
    console.log(`   Products:            ${productCount}`);
    console.log(`   Transactions:        ${txnCount}`);
    console.log(`   Document Embeddings: ${embCount} (empty)`);

    console.log("\n📊 Segment distribution:");
    segmentDist.forEach((s) => console.log(`   ${s._id}: ${s.count}`));
    console.log("\n📊 Region distribution:");
    regionDist.forEach((r) => console.log(`   ${r._id}: ${r.count}`));
    console.log("\n📊 Category distribution:");
    categoryDist.forEach((c) => console.log(`   ${c._id}: ${c.count}`));
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();