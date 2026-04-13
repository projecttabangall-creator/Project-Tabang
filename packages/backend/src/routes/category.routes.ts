import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import { createCategorySchema, createItemSchema, updateItemSchema } from "@tabang/shared";
import {
  listCategories,
  createCategory,
  updateCategory,
  createItem,
  updateItem,
  deleteItem,
  deleteCategory,
} from "../controllers/category.controller";

export const categoryRouter = Router();

categoryRouter.use(verifyToken);

// GET /api/categories — list all categories with items
categoryRouter.get("/", listCategories);

// POST /api/categories — create category (admin only)
categoryRouter.post(
  "/",
  roleGuard("admin"),
  validate(createCategorySchema),
  createCategory
);

// PATCH /api/categories/:id — update category (admin only)
categoryRouter.patch("/:id", roleGuard("admin"), updateCategory);

// DELETE /api/categories/:id — delete category (admin only)
categoryRouter.delete("/:id", roleGuard("admin"), deleteCategory);

// POST /api/categories/:id/items — add item (admin only)
categoryRouter.post(
  "/:id/items",
  roleGuard("admin"),
  validate(createItemSchema),
  createItem
);

// PATCH /api/categories/:id/items/:itemId — update item (admin only)
categoryRouter.patch(
  "/:id/items/:itemId",
  roleGuard("admin"),
  validate(updateItemSchema),
  updateItem
);

// DELETE /api/categories/:id/items/:itemId — delete item (admin only)
categoryRouter.delete(
  "/:id/items/:itemId",
  roleGuard("admin"),
  deleteItem
);
