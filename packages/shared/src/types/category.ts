export interface CategoryItem {
  id: string;
  name: string;
  minPrice: number;
  isFree: boolean; // calamity/bayanihan flag
  referencePhotoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  items?: CategoryItem[]; // populated on fetch
}
