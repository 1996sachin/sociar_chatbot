/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessageService } from 'src/messages/messages.service';
import { ConversationsService } from 'src/conversations/conversations.service';
import { ConversationParticipantService } from 'src/conversation-participant/conversation-participant.service';
import { UsersService } from 'src/users/users.service';
import { Model, Types } from 'mongoose';
import { ModuleRef, ContextIdFactory } from '@nestjs/core';
import { Scope } from '@nestjs/common';
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
  seenMessageDto,
} from './chat.validator';
import { SocketExceptionFilter } from 'src/common/helpers/handlers/socket.filter';
import { CustomLogger } from 'src/config/custom.logger';
import { ChatService } from './chat.service';
import { MessageStatus } from 'src/messages/entities/message.entity';
import { SocketEvents, SocketPayloads } from 'src/common/constants/socket-events';
import { SocketStore } from 'src/common/socket/socket.store';
import { TenantServiceFactory } from 'src/tenant-database/tenant-database.service';

const logger = new CustomLogger('Chat Gateway');

@UseFilters(new SocketExceptionFilter())
@WebSocketGateway(Number(process.env.PORT!), {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayDisconnect, OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly socketStore: SocketStore,
    // private readonly userService: UsersService,
    // private readonly chatService: ChatService,
    // private readonly conversationService: ConversationsService,
    // private readonly messageService: MessageService,
    // private readonly conversationPService: ConversationParticipantService,
    private readonly tenantServiceFactory: TenantServiceFactory,
  ) {}

  async handleConnection(client: Socket) {
    const tenantId = client.handshake.headers['x-tenant-id'];
    console.log(`New socket for tenant ${tenantId}`);
    const { userService } =
      await this.tenantServiceFactory.getServicesForTenant(tenantId as string);
    console.log('userService', userService);
    const users = await userService.findAll({});
    console.log('users', users);
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    // Remove user from online pool
    logger.debug(`[disconnected] ${client.id}`);
    // this.socketStore.remove(client.id);
  }

  @SubscribeMessage('init')
  async init(
    @MessageBody(
      new ZodValidationPipe(
        initializeChatSchema,
        (error) => new WsException({
          event: SocketEvents.ERROR,
          data: { error: error.format() } as SocketPayloads[SocketEvents.ERROR]['data'],
        }),
      ),
    )
    data: InitializeChatDto,
    @ConnectedSocket() client: Socket,
  ) {
    logger.debug(`[connected] socket: ${client.id}, userId: ${data.userId}`);

    const tenant = client.handshake.headers['x-tenant-id'];
    console.log('tenant', tenant);

    // console.log('this.socket', this.socketStore);
    // console.log('userService', this.userService);
    // console.log('this.conversationService', this.conversationService);
    /* if (this.socketStore.has(client.id)) this.socketStore.remove(client.id);
    this.socketStore.add(data.userId, client.id, client);
    await this.userService.saveIfNotExists({ userId: data.userId });

    // deliver msg after init
    const conversationInfos = await this.conversationPService
      .getRepository()
      .aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userDetails',
          },
        },
        { $unwind: '$userDetails' },
        {
          $group: {
            _id: '$conversation',
            userDetails: { $push: '$userDetails' },
            userIds: { $addToSet: '$userDetails.userId' },
          },
        },
        { $match: { userIds: data.userId } },
        {
          $project: {
            _id: 0,
            conversation: '$_id',
            userDetails: 1,
            userIds: 1,
          },
        },
      ]);
    const conversations = conversationInfos.map(
      (conversationInfo) => conversationInfo.conversation,
    );

    const latestMessages = await this.messageService.getRepository().aggregate([
      {
        $match: {
          conversation: {
            $in: conversations,
          },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: '$conversation',
          latestMessage: { $first: '$$ROOT' },
        },
      },
      {
        $lookup: {
          from: 'users',
          foreignField: '_id',
          localField: 'latestMessage.sender',
          as: 'user',
        },
      },
      { $unwind: '$user' },
    ]);

    const notOurMessages = latestMessages
      .filter((messages) => messages.user.userId !== data.userId)
      .map((message) => message._id);

    await this.messageService
      .getRepository()
      .updateMany(
        { conversation: { $in: notOurMessages } },
        { $set: { messageStatus: MessageStatus.DELIVERED } },
      ); */
  }

  /* @SubscribeMessage('createConversation')
  async createConversation(
    @MessageBody(
      new ZodValidationPipe(
        createConversationSchema,
        (error) => new WsException({
          event: SocketEvents.ERROR,
          data: { error: error.format() } as SocketPayloads[SocketEvents.ERROR]['data']
        }),
      ),
    )
    data: CreateConversationDto,
    @ConnectedSocket() client: Socket,
  ) {

    const userId = this.socketStore.getUserFromSocket(client.id);
    if (!userId) {
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Initiate socket connection' },
      };
    }

    const { participants } = data;
    const allParticipants = [
      ...participants.map((parti) => parti.toString()),
      ...(participants.includes(userId) ? [] : [userId]),
    ];
    if (allParticipants.length < 2)
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Invalid participants' } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

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
        event: SocketEvents.CONVERSATION_INFO,
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
      event: SocketEvents.CONVERSATION_INFO,
      data: { conversationId: conversation.id },
    };
  }

  @SubscribeMessage('sendMessage')
  async sendMessage(
    @MessageBody(
      new ZodValidationPipe(
        sendMessageSchema,
        (error) => new WsException({
          event: SocketEvents.ERROR,
          data: { error: error.format() } as SocketPayloads[SocketEvents.ERROR]['data']
        }),
      ),
    )
    data: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    // Get userId from socket
    const userId = this.socketStore.getUserFromSocket(client.id);
    if (!userId)
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Initiate socket connection' } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

    const { conversationId, message } = data;

    // Check If conversationId exists
    const conversation = await this.conversationService.find(conversationId);
    if (!conversation)
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Invalid conversation' } as SocketPayloads[SocketEvents.ERROR]['data']
        ,
      };

    // Get participants & Check If user is part of conversation
    const participants =
      await this.conversationPService.getParticipantsUserDetails(
        conversationId,
      );
    if (!participants)
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Invalid conversation' } as SocketPayloads[SocketEvents.ERROR]['data']
      };

    // Code for making seen if user directly sends message without seen
    const lastMessage = await this.messageService
      .getRepository()
      .findOne({ conversation: new Types.ObjectId(conversationId) })
      .sort({ createdAt: -1 })
      .lean();

    if (lastMessage && !lastMessage.seenBy.includes(userId)) {
      // for removing the previous seen status in the message after pushing a new message
      await this.messageService.changeMessageStatus(conversationId, userId);

      const payload: SocketPayloads[SocketEvents.STATUS_UPDATE] = {
        conversationId: conversationId,
        group: conversation.participants.length > 2 ? true : false,
        messageId: lastMessage?._id as string,
        messageStatus: MessageStatus.SEEN,
        seenBy: [...lastMessage?.seenBy, userId],
      }

      this.chatService.emitToFilteredSocket(
        SocketEvents.STATUS_UPDATE,
        participants,
        userId,
        payload
      );
    }

    const user = await this.userService.findWhere({ userId });
    const messageInfo = await this.messageService.save({
      conversation: new Types.ObjectId(conversationId),
      content: message, // Crypt
      messageStatus: MessageStatus.SENT,
      sender: new Types.ObjectId(user[0].id),
      seenBy: [userId],
    });
    await this.conversationService.update(conversationId, {
      lastMessage: message,
    });

    // Seen & pull
    await this.messageService.seenMessage(conversationId, userId);

    // If the user is in online "notify" that user with message

    const payload: SocketPayloads[SocketEvents.MESSAGE] = {
      message: data.message,
      createdAt: (messageInfo as any).createdAt,
      new: conversation.lastMessage ? false : true,
      group: conversation.participants.length > 2 ? true : false,
      conversationId: conversationId,
      userId: userId,
      participants: participants.map(
        (participant) => participant.userDetail[0].userId,
      ),

    }

    const emittedSockets = this.chatService.emitToFilteredSocket(
      SocketEvents.MESSAGE,
      participants,
      userId,
      payload
    );

    if (emittedSockets <= 0) return;

    const changed = await this.messageService.getRepository().findByIdAndUpdate(
      {
        _id: messageInfo._id,
      },
      {
        $set: { messageStatus: MessageStatus.DELIVERED },
      },
      { new: true },
    );
    const payloadd: SocketPayloads[SocketEvents.STATUS_UPDATE] = {
      conversationId: conversationId,
      group: conversation.participants.length > 2 ? true : false,
      messageStatus: MessageStatus.DELIVERED,

    }
    this.chatService.emitToSocket(SocketEvents.STATUS_UPDATE, participants, payloadd);
  }

  @SubscribeMessage('seenMessage')
  async seenMessage(
    @MessageBody() data: seenMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.socketStore.getUserFromSocket(client.id);
    if (!userId)
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Initiate socket connection' } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

    const { conversationId } = data;

    // Check If conversationId exists
    const conversation = await this.conversationService.find(conversationId);
    if (!conversation)
      return {
        event: SocketEvents.ERROR,
        data: { message: 'No any conversation with such id found' } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

    // Get participants of conversation
    const participants = await this.conversationPService.getParticipantsExcludingSelf(conversationId, userId)

    if (!participants)
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Invalid conversation' } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

    // using the seen logic from the message service
    const updatedMessage = await this.messageService.seenMessage(
      conversation._id as string,
      userId,
    );
    await this.messageService.changeMessageStatus(
      conversation._id as string,
      userId,
    );

    const messages = await this.messageService
      .getRepository()
      .find({ conversation: conversation._id })
      .sort({ createdAt: -1 })
      .lean();

    const payload: SocketPayloads[SocketEvents.STATUS_UPDATE] = {
      conversationId: conversationId,
      messageId: messages[0]._id as string,
      group: conversation.participants.length > 2 ? true : false,
      messageStatus: MessageStatus.SEEN,
      seenBy: updatedMessage!.seenBy,

    }

    this.chatService.emitToSocket(SocketEvents.STATUS_UPDATE, participants, payload);
  }

}
