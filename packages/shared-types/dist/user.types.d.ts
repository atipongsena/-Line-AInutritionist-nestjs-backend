export type Gender = 'male' | 'female' | 'lgbtq_lesbian' | 'lgbtq_gay' | 'lgbtq_bisexual' | 'lgbtq_transgender_m_to_f' | 'lgbtq_transgender_f_to_m' | 'lgbtq_queer' | 'lgbtq_non_binary' | 'lgbtq_other' | 'other' | 'not_specified';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type DietType = 'normal' | 'keto' | 'vegetarian' | 'vegan' | 'low_carb' | 'high_protein' | 'if_16_8' | 'if_5_2' | 'paleo' | 'mediterranean';
export type PregnancyLactationStatus = 'not_applicable' | 'pregnant' | 'lactating';
export interface SharedUserProfileDto {
    lineUserId: string;
    displayName?: string;
    pictureUrl?: string;
    language: string;
    goal?: string;
    gender?: Gender;
    age?: number;
    birthDate?: string;
    weightKg?: number;
    heightCm?: number;
    activityLevel?: ActivityLevel;
    dietType?: DietType;
    healthConditions?: string[];
    foodAllergies?: string[];
    createdAt?: Date;
    updatedAt?: Date;
    isActive?: boolean;
    lastActiveAt?: Date;
    ethicalFoodConsiderations?: string[];
    pregnancyLactationStatus?: PregnancyLactationStatus;
    preferredCuisine?: string[];
    preferredFlavorProfiles?: string[];
}
export interface SharedCreateUserProfileDto {
    lineUserId: string;
    displayName?: string;
    pictureUrl?: string;
    language?: string;
}
export interface SharedUpdateUserProfileDto {
    displayName?: string;
    pictureUrl?: string;
    language?: string;
    goal?: string;
    gender?: Gender;
    age?: number;
    birthDate?: string;
    weightKg?: number;
    heightCm?: number;
    activityLevel?: ActivityLevel;
    dietType?: DietType;
    healthConditions?: string[];
    foodAllergies?: string[];
    isActive?: boolean;
    lastActiveAt?: Date;
    ethicalFoodConsiderations?: string[];
    pregnancyLactationStatus?: PregnancyLactationStatus;
    preferredCuisine?: string[];
    preferredFlavorProfiles?: string[];
}
