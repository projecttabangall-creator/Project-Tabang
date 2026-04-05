import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { db } from "../config/firebase";
import admin from "../config/firebase";
import { CreateCategoryInput, CreateItemInput, UpdateItemInput } from "@tabang/shared";

const categoriesRef = db.collection("categories");

/**
 * GET /api/categories
 * List all categories with their items.
 */
export async function listCategories(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const snapshot = await categoriesRef.orderBy("name").get();
    const categories = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        // Fetch items subcollection
        const itemsSnapshot = await categoriesRef
          .doc(doc.id)
          .collection("items")
          .orderBy("name")
          .get();
        const items = itemsSnapshot.docs.map((itemDoc) => ({
          id: itemDoc.id,
          ...itemDoc.data(),
        }));
        return { id: doc.id, ...data, items };
      })
    );

    res.json({ categories });
  } catch (error) {
    console.error("List categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
}

/**
 * POST /api/categories
 * Create a new service category.
 */
export async function createCategory(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { name } = req.body as CreateCategoryInput;

  try {
    // Check for duplicate name
    const existing = await categoriesRef
      .where("name", "==", name)
      .limit(1)
      .get();
    if (!existing.empty) {
      res.status(409).json({ error: "Category already exists" });
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await categoriesRef.add({
      name,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Log the action
    await db.collection("systemLogs").add({
      action: "category_created",
      performedBy: req.user!.uid,
      details: `Created category: ${name}`,
      createdAt: now,
    });

    res.status(201).json({ id: docRef.id, name, isActive: true });
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
}

/**
 * PATCH /api/categories/:id
 * Update a category (name, isActive).
 */
export async function updateCategory(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;
  const { name, isActive } = req.body;

  try {
    const docRef = categoriesRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const updates: Record<string, any> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (name !== undefined) updates.name = name;
    if (isActive !== undefined) updates.isActive = isActive;

    await docRef.update(updates);

    res.json({ id, ...doc.data(), ...updates });
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
}

/**
 * POST /api/categories/:id/items
 * Add a service item to a category.
 */
export async function createItem(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const categoryId = req.params.id as string;
  const { name, minPrice, isFree } = req.body as CreateItemInput;

  try {
    const categoryDoc = await categoriesRef.doc(categoryId).get();
    if (!categoryDoc.exists) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const itemRef = await categoriesRef
      .doc(categoryId)
      .collection("items")
      .add({
        name,
        minPrice: isFree ? 0 : minPrice,
        isFree: isFree || false,
        createdAt: now,
        updatedAt: now,
      });

    await db.collection("systemLogs").add({
      action: "item_created",
      performedBy: req.user!.uid,
      details: `Added item "${name}" to category "${categoryDoc.data()!.name}" with min price ${minPrice}`,
      createdAt: now,
    });

    res.status(201).json({ id: itemRef.id, name, minPrice, isFree });
  } catch (error) {
    console.error("Create item error:", error);
    res.status(500).json({ error: "Failed to create item" });
  }
}

/**
 * PATCH /api/categories/:id/items/:itemId
 * Update a service item (name, minPrice, isFree, referencePhotoUrl).
 */
export async function updateItem(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const categoryId = req.params.id as string;
  const itemId = req.params.itemId as string;
  const body = req.body as UpdateItemInput & { referencePhotoUrl?: string };

  try {
    const itemRef = categoriesRef
      .doc(categoryId)
      .collection("items")
      .doc(itemId);
    const itemDoc = await itemRef.get();

    if (!itemDoc.exists) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const updates: Record<string, any> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (body.name !== undefined) updates.name = body.name;
    if (body.minPrice !== undefined) updates.minPrice = body.minPrice;
    if (body.isFree !== undefined) updates.isFree = body.isFree;
    if (body.referencePhotoUrl !== undefined)
      updates.referencePhotoUrl = body.referencePhotoUrl;

    await itemRef.update(updates);

    res.json({ id: itemId, ...itemDoc.data(), ...updates });
  } catch (error) {
    console.error("Update item error:", error);
    res.status(500).json({ error: "Failed to update item" });
  }
}

/**
 * DELETE /api/categories/:id/items/:itemId
 * Soft-delete: sets isActive to false. We don't actually delete to preserve history.
 */
export async function deleteItem(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const categoryId = req.params.id as string;
  const itemId = req.params.itemId as string;

  try {
    const itemRef = categoriesRef
      .doc(categoryId)
      .collection("items")
      .doc(itemId);
    const itemDoc = await itemRef.get();

    if (!itemDoc.exists) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    await itemRef.delete();

    res.json({ message: "Item deleted" });
  } catch (error) {
    console.error("Delete item error:", error);
    res.status(500).json({ error: "Failed to delete item" });
  }
}
