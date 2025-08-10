import { Module, Scope } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './entities/user.entity';
import { Connection } from 'mongoose';
import { TenantDatabaseModule } from 'src/tenant-database/tenant-database.module';

@Module({
  imports: [
    TenantDatabaseModule,
    // MongooseModule.forFeature([{ name: 'User', schema: UserSchema } ]),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: 'UserModel',
      scope: Scope.REQUEST,
      inject: ['TENANT_CONNECTION'],
      useFactory: (conn: Connection) => conn.model(User.name, UserSchema),
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
