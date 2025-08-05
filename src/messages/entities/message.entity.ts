import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversation: Types.ObjectId;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true, enum: MessageStatus })
  messageStatus: MessageStatus;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
