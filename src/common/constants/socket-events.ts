import {
  MessageStatus,
  MessageTypes,
} from 'src/messages/entities/message.entity';

export enum SocketEvents {
  STATUS_UPDATE = 'statusUpdate',
  ERROR = 'error',
  WARNING = 'warning',
  LOG_MESSAGE = 'logMessage',
  CONVERSATION_INFO = 'conversationInfo',
  MESSAGE = 'message',
}

export interface SocketPayloads {
  [SocketEvents.ERROR]: {
    data: {};
  };
  [SocketEvents.LOG_MESSAGE]: {
    conversationId: string;
    createdAt: string;
    group: boolean;
    message: string;
    messageType: MessageTypes;
    new: boolean;
    userId: string;
    name: string;
    participants: string[];
    createdBy: string;
    // messageStatus: MessageStatus;
  };
  [SocketEvents.WARNING]: {
    message: string;
  };
  [SocketEvents.STATUS_UPDATE]: {
    conversationId: string;
    group: boolean;
    messageId?: string;
    messageStatus: MessageStatus;
    seenBy?: string[];
  };
  [SocketEvents.CONVERSATION_INFO]: {
    data: any;
  };
  [SocketEvents.MESSAGE]: {
    message: string;
    createdAt: any;
    new: boolean;
    group: boolean;
    conversationId: string;
    userId: string;
    participants: string[];
    messageType: MessageTypes.TEXT;
    createdBy: string;
  };
}
