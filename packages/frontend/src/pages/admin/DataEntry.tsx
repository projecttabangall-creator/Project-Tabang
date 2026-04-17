import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, X } from "lucide-react";
import api from "@/services/api";
import { uploadFile } from "@/utils/uploadFile";
import { BackButton } from "@/components/common/BackButton";

interface Item {
  id: string;
  name: string;
  minPrice: number;
  isFree: boolean;
  referencePhotoUrl?: string;
}

interface Category {
  id: string;
  name: string;
  isActive: boolean;
  items: Item[];
}

export function DataEntry() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{
    categoryId: string;
    item: Item;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryForm = useForm<{ name: string }>();
  const itemForm = useForm<{ name: string; minPrice: number; isFree: boolean }>();

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      setLoading(false);
      toast.error("Loading categories took too long. Check if emulators are running.");
    }, 5000);

    fetchCategories().finally(() => clearTimeout(timeout));
  }, []);

  async function fetchCategories() {
    try {
      const { data } = await api.get("/api/categories");
      setCategories(data.categories);
    } catch (error) {
      console.error("Failed to load categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCategory(formData: { name: string }) {
    try {
      await api.post("/api/categories", formData);
      toast.success(`Category "${formData.name}" created`);
      categoryForm.reset();
      setShowCategoryForm(false);
      fetchCategories();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to create category");
    }
  }

  async function handleCreateItem(
    categoryId: string,
    formData: { name: string; minPrice: number; isFree: boolean }
  ) {
    try {
      const createRes = await api.post(`/api/categories/${categoryId}/items`, {
        name: formData.name,
        minPrice: Number(formData.minPrice),
        isFree: formData.isFree || false,
      });

      const itemId = createRes.data.id;

      // If a photo was selected, upload and attach it
      if (selectedFile) {
        const photoUrl = await uploadFile(
          `categories/${categoryId}/items/${itemId}/reference.jpg`,
          selectedFile
        );
        await api.patch(`/api/categories/${categoryId}/items/${itemId}`, {
          referencePhotoUrl: photoUrl,
        });
      }

      toast.success(`Item "${formData.name}" added`);
      itemForm.reset();
      setShowItemForm(null);
      setSelectedFile(null);
      fetchCategories();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to add item");
    }
  }

  async function handleUpdateItem(
    categoryId: string,
    itemId: string,
    formData: { name: string; minPrice: number; isFree: boolean }
  ) {
    try {
      setUploadingItemId(itemId);

      const updatePayload: any = {
        name: formData.name,
        minPrice: Number(formData.minPrice),
        isFree: formData.isFree,
      };

      // If a new file is selected, upload it first
      if (selectedFile) {
        const photoUrl = await uploadFile(
          `categories/${categoryId}/items/${itemId}/reference.jpg`,
          selectedFile
        );
        updatePayload.referencePhotoUrl = photoUrl;
      }

      await api.patch(`/api/categories/${categoryId}/items/${itemId}`, updatePayload);
      toast.success("Item updated");
      setEditingItem(null);
      setSelectedFile(null);
      itemForm.reset();
      fetchCategories();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update item");
    } finally {
      setUploadingItemId(null);
    }
  }

  async function handleDeleteItem(categoryId: string, itemId: string) {
    if (!confirm("Delete this item?")) return;
    try {
      await api.delete(`/api/categories/${categoryId}/items/${itemId}`);
      toast.success("Item deleted");
      fetchCategories();
    } catch {
      toast.error("Failed to delete item");
    }
  }

  async function handleDeleteCategory(categoryId: string, categoryName: string) {
    if (!confirm(`Delete category "${categoryName}" and all its items? This cannot be undone.`))
      return;
    try {
      await api.delete(`/api/categories/${categoryId}`);
      toast.success(`Category "${categoryName}" deleted`);
      fetchCategories();
    } catch {
      toast.error("Failed to delete category");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <BackButton to="/admin/dashboard" label="Back to Dashboard" />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Data Entry</h2>
        <button
          onClick={() => setShowCategoryForm(!showCategoryForm)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      {/* Add Category Form */}
      {showCategoryForm && (
        <div className="card mb-4">
          <form
            onSubmit={categoryForm.handleSubmit(handleCreateCategory)}
            className="flex gap-3"
          >
            <input
              placeholder="Category name (e.g. Carpentry)"
              className="input-field flex-1"
              {...categoryForm.register("name", { required: true })}
            />
            <button type="submit" className="btn-primary text-sm">
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCategoryForm(false)}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Categories List */}
      {categories.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500">No categories yet.</p>
          <p className="text-sm text-slate-400 mt-2">
            Add service categories and items with minimum prices to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <div key={category.id} className="card p-0 overflow-hidden">
              {/* Category Header */}
              <div className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <button
                  onClick={() =>
                    setExpandedCategory(
                      expandedCategory === category.id ? null : category.id
                    )
                  }
                  className="flex-1 flex items-center gap-3"
                >
                  {expandedCategory === category.id ? (
                    <ChevronDown size={18} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={18} className="text-slate-400" />
                  )}
                  <span className="font-semibold">{category.name}</span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {category.items.length} items
                  </span>
                </button>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      category.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {category.isActive ? "Active" : "Inactive"}
                  </span>
                  <button
                    onClick={() =>
                      handleDeleteCategory(category.id, category.name)
                    }
                    className="text-slate-400 hover:text-red-600 transition-colors"
                    title="Delete category"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Expanded: Items List */}
              {expandedCategory === category.id && (
                <div className="border-t border-slate-100 px-4 pb-4">
                  {category.items.length > 0 && (
                    <table className="w-full text-sm mt-3">
                      <thead>
                        <tr className="text-left text-slate-500 border-b">
                          <th className="pb-2 font-medium">Item</th>
                          <th className="pb-2 font-medium">Min Price</th>
                          <th className="pb-2 font-medium">Free</th>
                          <th className="pb-2 font-medium w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {category.items.map((item) =>
                          editingItem?.item.id === item.id ? (
                            <tr key={item.id}>
                              <td className="py-2 pr-2">
                                <div className="space-y-2">
                                  <input
                                    className="input-field text-sm"
                                    defaultValue={item.name}
                                    {...itemForm.register("name", {
                                      required: true,
                                    })}
                                  />
                                  <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded text-xs cursor-pointer hover:bg-slate-50">
                                      <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) =>
                                          setSelectedFile(e.target.files?.[0] || null)
                                        }
                                      />
                                      Upload photo
                                    </label>
                                    {selectedFile && (
                                      <div className="flex items-center gap-1 text-xs text-slate-600">
                                        <span className="truncate max-w-[80px]">
                                          {selectedFile.name}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedFile(null);
                                            if (fileInputRef.current)
                                              fileInputRef.current.value = "";
                                          }}
                                          className="text-slate-400 hover:text-red-600"
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  type="number"
                                  className="input-field text-sm w-24"
                                  defaultValue={item.minPrice}
                                  {...itemForm.register("minPrice", {
                                    required: true,
                                  })}
                                />
                              </td>
                              <td className="py-2">
                                <input
                                  type="checkbox"
                                  defaultChecked={item.isFree}
                                  {...itemForm.register("isFree", {
                                    onChange: (e) => {
                                      if (e.target.checked) {
                                        itemForm.setValue("minPrice", 0);
                                      }
                                    },
                                  })}
                                />
                              </td>
                              <td className="py-2 flex gap-1">
                                <button
                                  onClick={itemForm.handleSubmit((data) =>
                                    handleUpdateItem(
                                      category.id,
                                      item.id,
                                      data
                                    )
                                  )}
                                  disabled={uploadingItemId === item.id}
                                  className="text-primary-600 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {uploadingItemId === item.id ? "Saving..." : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingItem(null);
                                    setSelectedFile(null);
                                    if (fileInputRef.current) fileInputRef.current.value = "";
                                  }}
                                  className="text-slate-400 text-xs"
                                >
                                  Cancel
                                </button>
                              </td>
                            </tr>
                          ) : (
                            <tr
                              key={item.id}
                              className="border-b border-slate-50"
                            >
                              <td className="py-2">
                                <div className="flex items-center gap-2">
                                  {item.referencePhotoUrl && (
                                    <img
                                      src={item.referencePhotoUrl}
                                      alt={item.name}
                                      className="w-6 h-6 rounded object-cover"
                                    />
                                  )}
                                  <span>{item.name}</span>
                                </div>
                              </td>
                              <td className="py-2">
                                {item.isFree
                                  ? "Free"
                                  : `₱${item.minPrice.toLocaleString()}`}
                              </td>
                              <td className="py-2">
                                {item.isFree ? (
                                  <span className="text-emerald-600 text-xs">
                                    Yes
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-2">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingItem({
                                        categoryId: category.id,
                                        item,
                                      });
                                      itemForm.setValue("name", item.name);
                                      itemForm.setValue(
                                        "minPrice",
                                        item.minPrice
                                      );
                                      itemForm.setValue("isFree", item.isFree);
                                    }}
                                    className="text-slate-400 hover:text-primary-600"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteItem(category.id, item.id)
                                    }
                                    className="text-slate-400 hover:text-red-600"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  )}

                  {/* Add Item Form */}
                  {showItemForm === category.id ? (
                    <form
                      onSubmit={itemForm.handleSubmit((data) =>
                        handleCreateItem(category.id, data)
                      )}
                      className="mt-3 space-y-2"
                    >
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="label">Item Name</label>
                          <input
                            placeholder="e.g. Leaky Faucet Repair"
                            className="input-field text-sm"
                            {...itemForm.register("name", { required: true })}
                          />
                        </div>
                        <div className="w-28">
                          <label className="label">Min Price (₱)</label>
                          <input
                            type="number"
                            placeholder="0"
                            className="input-field text-sm"
                            {...itemForm.register("minPrice", { required: true })}
                          />
                        </div>
                        <label className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            {...itemForm.register("isFree", {
                              onChange: (e) => {
                                if (e.target.checked) {
                                  itemForm.setValue("minPrice", 0);
                                }
                              },
                            })}
                          />
                          Free
                        </label>
                      </div>
                      <div className="flex gap-2 items-end">
                        <label className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded text-sm cursor-pointer hover:bg-slate-50">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              setSelectedFile(e.target.files?.[0] || null)
                            }
                          />
                          📷 Reference Photo
                        </label>
                        {selectedFile && (
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <span className="truncate max-w-[100px]">
                              {selectedFile.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedFile(null)}
                              className="text-slate-400 hover:text-red-600"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                        <button type="submit" className="btn-primary text-sm">
                          Add
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowItemForm(null);
                          itemForm.reset();
                        }}
                        className="btn-secondary text-sm mb-0.5"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => {
                        setShowItemForm(category.id);
                        itemForm.reset();
                      }}
                      className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-3 font-medium"
                    >
                      <Plus size={14} /> Add Item
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
