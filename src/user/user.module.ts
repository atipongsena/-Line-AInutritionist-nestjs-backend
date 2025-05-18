import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { UserService } from './user.service'
import { User, UserSchema } from '../schemas/user.schema'
// Import UserController if you create it later
// import { UserController } from './user.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  // Add UserController here if you have one: controllers: [UserController],
  providers: [UserService],
  exports: [UserService], // Export UserService so other modules like LineModule can use it
})
export class UserModule {}
