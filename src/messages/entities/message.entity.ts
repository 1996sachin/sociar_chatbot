import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

export type MessageDocument = Message & Document;

@Schema()
export class Message {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'conversations' }] })
  conversation: Types.ObjectId[];

  @Prop({ required: true })
  message: string;

  @Prop({
    type: String,
    enum: MessageStatus,
    required: true,
  })
  status: MessageStatus;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
