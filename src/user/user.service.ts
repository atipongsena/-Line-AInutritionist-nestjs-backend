import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { User, UserDocument } from '../schemas/user.schema'
import {
  UserProfileDto,
  CreateUserProfileDto,
  UpdateUserProfileDto,
} from './user.interface'
import {
  Gender,
  ActivityLevel,
  DietType,
  PregnancyLactationStatus,
} from '@ai-nutritionist/shared-types'

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name)

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  private mapUserDocumentToDto(userDoc: UserDocument): UserProfileDto {
    if (!userDoc.createdAt || !userDoc.updatedAt) {
      this.logger.warn(
        `User document ${userDoc.lineUserId} is missing timestamps unexpectedly.`,
      )
    }
    return {
      lineUserId: userDoc.lineUserId,
      displayName: userDoc.displayName,
      pictureUrl: userDoc.pictureUrl,
      language: userDoc.language,
      goal: userDoc.goal,
      gender: userDoc.gender as Gender,
      age: userDoc.age,
      weightKg: userDoc.weightKg,
      heightCm: userDoc.heightCm,
      activityLevel: userDoc.activityLevel as ActivityLevel,
      dietType: userDoc.dietType as DietType,
      healthConditions: userDoc.healthConditions,
      foodAllergies: userDoc.foodAllergies,
      isActive: userDoc.isActive,
      lastActiveAt: userDoc.lastActiveAt,
      createdAt: userDoc.createdAt!,
      updatedAt: userDoc.updatedAt!,
      ethicalFoodConsiderations: userDoc.ethicalFoodConsiderations,
      pregnancyLactationStatus:
        userDoc.pregnancyLactationStatus as PregnancyLactationStatus,
      preferredCuisine: userDoc.preferredCuisine,
      preferredFlavorProfiles: userDoc.preferredFlavorProfiles,
    }
  }

  async getOrCreateUserProfile(
    createDto: CreateUserProfileDto,
  ): Promise<UserProfileDto> {
    const { lineUserId, displayName, pictureUrl, language } = createDto
    this.logger.log(
      `Getting or creating profile for ${lineUserId}, displayName: ${displayName}`,
    )
    let user = await this.userModel.findOne({ lineUserId }).exec()
    if (user) {
      this.logger.log(`User ${lineUserId} found. Updating lastActiveAt.`)
      user.lastActiveAt = new Date()
      if (displayName !== undefined && user.displayName !== displayName) {
        user.displayName = displayName
      }
      if (pictureUrl !== undefined && user.pictureUrl !== pictureUrl) {
        user.pictureUrl = pictureUrl
      }
      if (language !== undefined && user.language !== language) {
        user.language = language
      }
      if (!user.isActive) {
        user.isActive = true
      }
      user = await user.save()
      return this.mapUserDocumentToDto(user)
    }

    this.logger.log(
      `User ${lineUserId} not found. Creating new profile. DisplayName: ${displayName || 'N/A'}`,
    )
    const newUser = new this.userModel({
      lineUserId,
      displayName: displayName || 'User',
      pictureUrl: pictureUrl,
      language: language || 'th',
      isActive: true,
      lastActiveAt: new Date(),
      goal: 'general_health',
    })
    const savedUser = await newUser.save()
    return this.mapUserDocumentToDto(savedUser)
  }

  async getUserDocumentByLineId(
    lineUserId: string,
  ): Promise<UserDocument | null> {
    this.logger.log(`Getting user document for ${lineUserId}`)
    const user = await this.userModel.findOne({ lineUserId }).exec()
    if (!user) {
      this.logger.warn(`User document for ${lineUserId} not found.`)
      return null
    }
    return user
  }

  async getUserProfile(lineUserId: string): Promise<UserProfileDto | null> {
    this.logger.log(`Getting profile for ${lineUserId}`)
    const user = await this.userModel
      .findOne({ lineUserId, isActive: true })
      .exec()
    if (!user) {
      this.logger.warn(`User ${lineUserId} not found or inactive.`)
      return null
    }
    return this.mapUserDocumentToDto(user)
  }

  async updateUserProfile(
    lineUserId: string,
    updateDto: UpdateUserProfileDto,
  ): Promise<UserProfileDto> {
    this.logger.log(`Updating profile for ${lineUserId}`)
    const user = await this.userModel
      .findOneAndUpdate(
        { lineUserId },
        { ...updateDto, lastActiveAt: new Date() },
        { new: true, runValidators: true },
      )
      .exec()

    if (!user) {
      this.logger.error(`User ${lineUserId} not found for update.`)
      throw new NotFoundException(`User with ID ${lineUserId} not found.`)
    }
    this.logger.log(`Profile updated for ${lineUserId}`)
    return this.mapUserDocumentToDto(user)
  }

  async setUserLanguage(
    lineUserId: string,
    language: 'en' | 'th',
  ): Promise<UserProfileDto> {
    this.logger.log(`Setting language to ${language} for user ${lineUserId}`)
    return this.updateUserProfile(lineUserId, { language })
  }

  async setUserInactive(lineUserId: string): Promise<UserProfileDto> {
    this.logger.log(`Setting user ${lineUserId} to inactive.`)
    const user = await this.userModel
      .findOneAndUpdate(
        { lineUserId },
        { isActive: false, lastActiveAt: new Date() },
        { new: true },
      )
      .exec()

    if (!user) {
      this.logger.warn(
        `User ${lineUserId} not found when trying to set inactive.`,
      )
      throw new NotFoundException(`User with ID ${lineUserId} not found.`)
    }
    this.logger.log(`User ${lineUserId} successfully set to inactive.`)
    return this.mapUserDocumentToDto(user)
  }
}
