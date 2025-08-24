import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/common/service/base.service';
import { User, UserDocument } from './entities/user.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class UsersService extends BaseService<UserDocument> {
  constructor(
    @InjectModel(User.name)
    private readonly UserModel: Model<UserDocument>,
  ) {
    super(UserModel);
  }
  async addNewUsers(allParticipants: string[], userInfo: { userId: string }[]) {
    // Find participants not already in userInfo
    const newUsers = allParticipants.filter(
      (participant) => !userInfo.some((user) => user.userId === participant),
    );

    if (newUsers.length === 0) {
      return [];
    }

    const newUserInfo = await this.saveMany(
      newUsers.map((newUserId) => ({
        userId: newUserId,
      })),
    );

    return newUserInfo;
  }
}
