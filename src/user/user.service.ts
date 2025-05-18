import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { User, UserDocument } from '../schemas/user.schema'
import {
  UserProfileDto,
  CreateUserProfileDto,
  UpdateUserProfileDto,
} from './user.interface'

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
      gender: userDoc.gender as UserProfileDto['gender'], // Cast to ensure type compatibility
      age: userDoc.age,
      weightKg: userDoc.weightKg,
      heightCm: userDoc.heightCm,
      activityLevel: userDoc.activityLevel as UserProfileDto['activityLevel'], // Cast
      dietType: userDoc.dietType as UserProfileDto['dietType'], // Cast
      healthConditions: userDoc.healthConditions,
      foodAllergies: userDoc.foodAllergies,
      foodRestrictions: userDoc.foodRestrictions,
      isActive: userDoc.isActive,
      lastActiveAt: userDoc.lastActiveAt,
      createdAt: userDoc.createdAt!,
      updatedAt: userDoc.updatedAt!,
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
      // Optionally update display name and picture URL if they have changed
      if (displayName && user.displayName !== displayName) {
        user.displayName = displayName
      }
      if (pictureUrl && user.pictureUrl !== pictureUrl) {
        user.pictureUrl = pictureUrl
      }
      // If language is provided in DTO and different from stored, update it.
      if (language && user.language !== language) {
        user.language = language
      }
      // Ensure isActive is true for a user being fetched/created, unless specifically handled elsewhere
      if (!user.isActive) {
        user.isActive = true
      }
      user = await user.save()
      return this.mapUserDocumentToDto(user)
    }

    this.logger.log(
      `User ${lineUserId} not found. Creating new profile. DisplayName: ${createDto.displayName || 'N/A'}`,
    )
    const newUser = new this.userModel({
      lineUserId,
      displayName: createDto.displayName || 'User', // Default display name if not provided
      pictureUrl,
      language: createDto.language || 'th', // Default to Thai
      isActive: true,
      lastActiveAt: new Date(),
      // Initialize other fields with defaults if necessary
      goal: 'general_health', // Default goal
    })
    const savedUser = await newUser.save()
    return this.mapUserDocumentToDto(savedUser)
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
        { isActive: false, lastActiveAt: new Date() }, // Set isActive to false
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
