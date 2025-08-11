/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketStore } from './socket.store';
import { MessageService } from 'src/messages/messages.service';
import { ConversationsService } from 'src/conversations/conversations.service';
import { ConversationParticipantService } from 'src/conversation-participant/conversation-participant.service';
import { UsersService } from 'src/users/users.service';
import { Types } from 'mongoose';
import { UseFilters } from '@nestjs/common';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import {
  createConversationSchema,
  initializeChatSchema,
  sendMessageSchema,
} from './chat.validator';
import type {
  InitializeChatDto,
  CreateConversationDto,
  SendMessageDto,
} from './chat.validator';
import { SocketExceptionFilter } from 'src/common/helpers/handlers/socket.filter';
import { CustomLogger } from 'src/config/custom.logger';

const logger = new CustomLogger('Chat Gateway');



@UseFilters(new SocketExceptionFilter())
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly socketStore: SocketStore,
    private readonly userService: UsersService,
    private readonly conversationService: ConversationsService,
    private readonly messageService: MessageService,
    private readonly conversationPService: ConversationParticipantService,
  ) { }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    // Remove user from online pool
    console.log('disconnected', client.id);
    logger.debug(`${client.id} has disconnected from the socket server`);
    this.socketStore.remove(client.id);
  }

  @SubscribeMessage('init')
  async init(
    @MessageBody(
      new ZodValidationPipe(
        initializeChatSchema,
        (error) => new WsException({ event: 'error', data: error }),
      ),
    )
    data: InitializeChatDto,
    @ConnectedSocket() client: Socket,
  ) {
    this.socketStore.remove(client.id);
    console.log('connected', client.id, data.userId);
    logger.debug(
      `${client.id} has connected to the socket server and their userId is ${data.userId}`,
    );
    this.socketStore.add(data.userId, client.id, client);
    await this.userService.saveIfNotExists({ userId: data.userId });
  }

  @SubscribeMessage('createConversation')
  async createConversation(
    @MessageBody(
      new ZodValidationPipe(
        createConversationSchema,
        (error) => new WsException({ event: 'error', data: error }),
      ),
    )
    data: CreateConversationDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.socketStore.getUserFromSocket(client.id);
    if (!userId) {
      return {
        event: 'error',
        data: { message: 'Initiate socket connection' },
      };
    }

    const { participants } = data;
    const allParticipants = [
      ...participants.map((parti) => parti.toString()),
      userId,
    ];

    //Check if participants exists
    const userInfo = await this.userService.findWhere({
      userId: { $in: allParticipants },
    });

    const allUserInfo = [...userInfo];
    if (allParticipants.length !== userInfo.length) {
      const addNewUsers = await this.userService.addNewUsers(
        allParticipants,
        userInfo,
      );
      allUserInfo.push(...(addNewUsers as any[]));
    }

    //Validate If conversation of same participants exists
    const conversationParticipants =
      await this.conversationPService.getPastConversation(allParticipants);
    if (conversationParticipants.length > 0)
      return {
        event: 'conversationInfo',
        data: { conversationId: conversationParticipants[0].conversation },
      };

    const conversation = await this.conversationService.save({});

    const conversationParticipant = await this.conversationPService.saveMany(
      allUserInfo.map((participant) => ({
        conversation: new Types.ObjectId(conversation.id),
        user: participant._id,
      })),
    );

    // Update in conversation with participants
    await this.conversationService.update(conversation.id, {
      participants: conversationParticipant,
    });

    // Send conversationId
    return {
      event: 'conversationInfo',
      data: { conversationId: conversation.id },
    };
  }

  @SubscribeMessage('sendMessage')
  async sendMessage(
    @MessageBody(
      new ZodValidationPipe(
        sendMessageSchema,
        (error) => new WsException({ event: 'error', data: error }),
      ),
    )
    data: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    // Get userId from socket
    const userId = this.socketStore.getUserFromSocket(client.id);
    if (!userId)
      return {
        event: 'error',
        data: { message: 'Initiate socket connection' },
      };

    const { conversationId, message } = data;

    // Check If conversationId exists
    const conversation = await this.conversationService
      .getRepository()
      .findById(conversationId);
    if (!conversation)
      return {
        event: 'error',
        data: { message: 'Invalid conversation' },
      };

    // Get participants & Check If user is part of conversation
    const participants =
      await this.conversationPService.getParticipantsExcludingSelf(
        conversationId,
        userId,
      );
    if (!participants)
      return {
        event: 'error',
        data: { message: 'Invalid conversation' },
      };

    const user = await this.userService.findWhere({ userId });
    const messageInfo = await this.messageService.save({
      conversation: new Types.ObjectId(conversationId),
      content: message, // Crypt
      messageStatus: 'sent',
      sender: new Types.ObjectId(user[0].id),
    });

    await this.conversationService.update(conversationId, {
      lastMessage: message,
    });

    const sendMessage = {
      message: data.message,
      createdAt: (messageInfo as any).createdAt,
      new: conversation.lastMessage ? false : true,
      conversationId: conversationId,
      userId: userId,
    };

    // If the user is in online "notify" that user with message
    participants
      .filter(
        (participant) =>
          ![userId, undefined].includes(participant.userDetail[0].userId),
      )
      .map((participant) =>
        this.socketStore.getFromUser(participant.userDetail[0].userId),
      )
      .forEach((socket) => {
        if (socket) socket.emit('message', sendMessage);
      });
  }

  @SubscribeMessage('seenMessage')
  async seenMessage(
    @MessageBody() data: SeenMessage,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.socketStore.getUserFromSocket(client.id);
    if (!userId)
      return {
        event: 'error',
        data: { message: 'Initiate socket connection' },
      };

    const { conversationId } = data;

    // Check conversationId type
    if (!Types.ObjectId.isValid(conversationId))
      return {
        event: 'error',
        data: { message: 'Conversation id must be a valid object id' },
      };

    // Check If conversationId exists
    const conversation = await this.conversationService
      .getRepository()
      .findById(conversationId);
    if (!conversation)
      return {
        event: 'error',
        data: { message: 'No any conversation with such id found' },
      };

    // Check If user is part of conversation
    // Get participants of conversation
    const participants = await this.conversationPService
      .getRepository()
      .aggregate([
        {
          $match: {
            conversation: new Types.ObjectId(conversationId),
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userDetail',
          },
        },
        {
          $match: {
            'userDetail.userId': { $ne: userId },
          },
        },
      ]);

    if (!participants)
      return {
        event: 'error',
        data: { message: 'Invalid conversation' },
      };

    const messages = await this.messageService.findWhere({
      conversation: conversation._id,
    });

    await this.messageService.getRepository().updateOne(
      {
        _id: messages[0]._id,
      },
      {
        $addToSet: { seenStatus: userId },
      },
    );
  }
}
