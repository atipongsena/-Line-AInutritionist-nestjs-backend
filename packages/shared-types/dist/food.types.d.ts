export interface VitaminMineralDetail {
    value: number;
    unit: string;
    dv?: number;
}
export interface NutritionData {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
    saturated_fat?: number;
    cholesterol?: number;
    water?: number;
    omega3?: number;
    trans_fat?: number;
    polyunsaturated_fat?: number;
    monounsaturated_fat?: number;
    potassium_nutrient?: number;
    caffeine?: number;
    alcohol?: number;
    vitamins?: Record<string, VitaminMineralDetail>;
    minerals?: Record<string, VitaminMineralDetail>;
}
export interface FoodItem {
    _id?: string;
    name: {
        th: string;
        en?: string;
    };
    description?: {
        th: string;
        en?: string;
    };
    nutrition: NutritionData;
    serving?: {
        size?: number;
        unit?: string;
        weight?: number;
    };
    category?: string;
    barcode?: string;
    brand?: string;
    isVegetarian?: boolean;
    isVegan?: boolean;
    commonAllergens?: string[];
    imageUrl?: string;
    tags?: string[];
}
