import { Type } from 'class-transformer'
import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  ValidateNested,
  Min,
  IsObject,
  IsDateString,
  IsNotEmpty,
} from 'class-validator'

// DTO for VitaminMineralDetail if it can be updated
class UpdateVitaminMineralDetailDto {
  @IsNumber()
  @IsOptional()
  value?: number

  @IsString()
  @IsOptional()
  unit?: string
}

class UpdateFoodNutritionDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  calories?: number

  @IsNumber()
  @IsOptional()
  @Min(0)
  protein?: number

  @IsNumber()
  @IsOptional()
  @Min(0)
  carbs?: number

  @IsNumber()
  @IsOptional()
  @Min(0)
  fat?: number

  @IsNumber()
  @IsOptional()
  @Min(0)
  fiber?: number

  @IsNumber()
  @IsOptional()
  @Min(0)
  sugar?: number

  @IsNumber()
  @IsOptional()
  @Min(0)
  sodium?: number
}

class UpdateFoodNameDto {
  @IsString()
  @IsOptional()
  th?: string

  @IsString()
  @IsOptional()
  en?: string
}

class UpdateFoodDetailDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateFoodNameDto)
  foodName?: UpdateFoodNameDto

  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number

  @IsString()
  @IsOptional()
  unit?: string

  @IsString()
  @IsOptional()
  portion?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateFoodNutritionDto)
  nutrition?: UpdateFoodNutritionDto

  @IsObject()
  @IsOptional()
  @Type(() => UpdateVitaminMineralDetailDto)
  micronutrients?: Record<string, UpdateVitaminMineralDetailDto>
}

export class UpdateFoodLogDto {
  @IsString()
  @IsOptional()
  @IsEnum(['breakfast', 'lunch', 'dinner', 'snack', 'other'])
  mealType?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateFoodDetailDto)
  food?: UpdateFoodDetailDto

  @IsString()
  @IsOptional()
  imageUrl?: string

  @IsString()
  @IsOptional()
  imageAlt?: string

  @IsOptional()
  @IsDateString()
  clientTimestamp?: string
}

// DTO สำหรับการสร้าง Food Log ใหม่
export class CreateFoodLogDto {
  @IsString()
  @IsNotEmpty()
  lineUserId: string

  @IsString()
  @IsEnum(['breakfast', 'lunch', 'dinner', 'snack', 'other'])
  mealType: string

  @ValidateNested()
  @Type(() => UpdateFoodDetailDto)
  food: UpdateFoodDetailDto

  @IsString()
  @IsOptional()
  imageUrl?: string

  @IsString()
  @IsOptional()
  imageAlt?: string

  @IsOptional()
  @IsDateString()
  clientTimestamp?: string

  @IsString()
  @IsOptional()
  timezone?: string
}
