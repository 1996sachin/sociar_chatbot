import { forwardRef, Module } from '@nestjs/common';
import { MessageService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageSchema } from './entities/message.entity';
import { UsersModule } from 'src/users/users.module';
import { ConversationsModule } from 'src/conversations/conversations.module';
import { ConversationParticipantModule } from 'src/conversation-participant/conversation-participant.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Message', schema: MessageSchema }]),
    UsersModule,
    forwardRef(() => ConversationsModule),
    ConversationParticipantModule,
  ],
  controllers: [MessagesController],
  providers: [MessageService],
  exports: [MongooseModule, MessageService],
})
export class MessagesModule { }
