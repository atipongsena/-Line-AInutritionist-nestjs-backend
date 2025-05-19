import {
  SharedUserProfileDto,
  SharedCreateUserProfileDto,
  SharedUpdateUserProfileDto,
} from '@ai-nutritionist/shared-types'

// Use type exports for direct aliasing if desired, or simply import and use Shared types directly elsewhere.
export type UserProfileDto = SharedUserProfileDto
export type CreateUserProfileDto = SharedCreateUserProfileDto
export type UpdateUserProfileDto = SharedUpdateUserProfileDto

// If you had other interfaces specific to the backend user module, they would remain here.
