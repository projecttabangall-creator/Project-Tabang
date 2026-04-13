/**
 * Quick test: reproduce the createItem 500 error.
 * Run with: node scripts/test-create-item.js
 */
const admin = require("firebase-admin");

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
admin.initializeApp({ projectId: "project-tabang---claude-code" });

const db = admin.firestore();

async function test() {
  // 1. Find a category
  const snap = await db.collection("categories").limit(1).get();
  if (snap.empty) {
    console.log("No categories found");
    return;
  }
  const catDoc = snap.docs[0];
  console.log(`Category: ${catDoc.id} — ${catDoc.data().name}`);

  // 2. Try adding an item to the subcollection (same as createItem does)
  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const itemRef = await db
      .collection("categories")
      .doc(catDoc.id)
      .collection("items")
      .add({
        name: "Test Item",
        minPrice: 500,
        isFree: false,
        createdAt: now,
        updatedAt: now,
      });
    console.log("Item created OK:", itemRef.id);
  } catch (err) {
    console.error("STEP 2 FAILED — item add:", err);
    return;
  }

  // 3. Try adding a system log (same as createItem does)
  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("systemLogs").add({
      action: "item_created",
      performedBy: "test-uid",
      details: "Test log entry",
      createdAt: now,
    });
    console.log("System log created OK");
  } catch (err) {
    console.error("STEP 3 FAILED — systemLogs add:", err);
  }
}

test().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
