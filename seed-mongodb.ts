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
const NUM_PRODUCTS = 50;
const NUM_TRANSACTIONS = 5000;
const MONTHS_OF_HISTORY = 12;

const CATEGORIES = [
  "Electronics",
  "Clothing",
  "Home & Garden",
  "Sports",
  "Books",
  "Toys",
  "Food & Beverage",
  "Beauty",
];

const REGIONS = ["North", "South", "East", "West", "Central"];

const CUSTOMER_SEGMENTS = ["Enterprise", "SMB", "Consumer", "Government"];

const PRODUCT_NAMES: Record<string, string[]> = {
  Electronics: ["Wireless Headphones", "Smart Watch", "Laptop Stand", "USB Hub", "Bluetooth Speaker"],
  Clothing: ["Cotton T-Shirt", "Denim Jacket", "Running Shoes", "Wool Sweater", "Baseball Cap"],
  "Home & Garden": ["Coffee Maker", "Garden Hose", "LED Lamp", "Throw Pillow", "Plant Pot"],
  Sports: ["Yoga Mat", "Tennis Racket", "Dumbbell Set", "Bike Helmet", "Water Bottle"],
  Books: ["Mystery Novel", "Cookbook", "Self-Help Guide", "Sci-Fi Anthology", "Biography"],
  Toys: ["Building Blocks", "Stuffed Animal", "Board Game", "Puzzle", "Action Figure"],
  "Food & Beverage": ["Organic Coffee", "Hot Sauce", "Granola Mix", "Tea Sampler", "Olive Oil"],
  Beauty: ["Face Serum", "Lipstick Set", "Hair Oil", "Body Lotion", "Perfume"],
};

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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

    // Drop document_embeddings entirely so we can recreate it with validation
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
      products.push({
        _id: new ObjectId(),
        name: `${baseName} ${i + 1}`,
        category,
        price: Math.round(randomBetween(10, 500) * 100) / 100,
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
      const quantity = Math.floor(randomBetween(1, 10));
      const unitPrice = product.price;
      const totalAmount = Math.round(quantity * unitPrice * 100) / 100;
      const transactionDate = randomDateInPastMonths(MONTHS_OF_HISTORY);

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
        customerSegment: randomItem(CUSTOMER_SEGMENTS),
        region: randomItem(REGIONS),
        createdAt: transactionDate,
      });
    }

    // Insert in batches to avoid memory issues
    const BATCH = 1000;
    for (let i = 0; i < transactions.length; i += BATCH) {
      await db.collection("sales_transactions").insertMany(transactions.slice(i, i + BATCH));
      console.log(`  Inserted ${Math.min(i + BATCH, transactions.length)}/${transactions.length}`);
    }
    console.log(`✅ Inserted ${transactions.length} transactions`);

    // === Create document_embeddings collection (empty, with schema validation) ===
    console.log("📄 Creating document_embeddings collection...");
    await db.createCollection("document_embeddings", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["content", "createdAt"],
          properties: {
            content: {
              bsonType: "string",
              description: "The text content that was embedded",
            },
            embedding: {
              bsonType: ["array", "null"],
              description: "Vector representation (e.g., 1536 dims for text-embedding-3-small)",
            },
            metadata: {
              bsonType: ["object", "null"],
              description: "Optional metadata about the document",
            },
            createdAt: {
              bsonType: "date",
            },
          },
        },
      },
      validationLevel: "moderate",
      validationAction: "error",
    });
    console.log("✅ document_embeddings collection created (empty)");

    // === Create Indexes ===
    console.log("📇 Creating indexes...");

    // Products
    await db.collection("products").createIndex({ category: 1 });
    await db.collection("products").createIndex({ name: 1 });

    // Sales transactions
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

    // Document embeddings
    await db.collection("document_embeddings").createIndex({ "metadata.type": 1 });
    await db.collection("document_embeddings").createIndex({ createdAt: -1 });

    console.log("✅ Indexes created");

    // === Summary ===
    const productCount = await db.collection("products").countDocuments();
    const txnCount = await db.collection("sales_transactions").countDocuments();
    const embCount = await db.collection("document_embeddings").countDocuments();
    console.log("\n📊 Final counts:");
    console.log(`   Products:            ${productCount}`);
    console.log(`   Transactions:        ${txnCount}`);
    console.log(`   Document Embeddings: ${embCount} (empty — populate via embedding script)`);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();