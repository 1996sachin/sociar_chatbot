// import { Injectable, PipeTransform } from '@nestjs/common';
// import { WsException } from '@nestjs/websockets';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import { ChatDocument, Conversation } from 'src/conversations/entities/conversation.entity';
// import { addParticipantsDto, leaveConversationSchema } from 'src/chat/chat.validator';
// import { User } from 'src/users/entities/user.entity';
//
// @Injectable()
// export class LeaveConversationValidationPipe implements PipeTransform {
//   constructor(
//     @InjectModel(Conversation.name) private readonly ConversationModel: Model<ChatDocument>,
//     @InjectModel(User.name) private readonly UserModel: Model<ChatDocument>,
//   ) { }
//
//   async transform(value: any): Promise<addParticipantsDto> {
//     const schema = leaveConversationSchema(this.ConversationModel);
//
//     const parsed = await schema.safeParseAsync(value);
//     if (!parsed.success) {
//       throw new WsException({
//         event: 'error',
//         data: parsed.error,
//       });
//     }
//
//     return parsed.data;
//   }
// }
