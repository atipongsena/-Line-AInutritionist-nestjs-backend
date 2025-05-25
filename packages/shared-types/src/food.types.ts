export interface VitaminMineralDetail {
  value: number
  unit: string
  dv?: number
}

export interface NutritionData {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
  sodium?: number
  saturated_fat?: number
  cholesterol?: number
  water?: number
  omega3?: number
  vitamins?: Record<string, VitaminMineralDetail>
  minerals?: Record<string, VitaminMineralDetail>
}

// Based on Food schema in backend, fields LIFF app might need
export interface FoodItem {
  _id?: string // From MongoDB
  name: { th: string; en?: string }
  description?: { th: string; en?: string }
  nutrition: NutritionData
  serving?: {
    size?: number
    unit?: string
    weight?: number
  }
  category?: string
  barcode?: string
  brand?: string
  isVegetarian?: boolean
  isVegan?: boolean
  commonAllergens?: string[]
  imageUrl?: string
  tags?: string[]
  // Add other fields from FoodSchema as needed by the LIFF form
}
