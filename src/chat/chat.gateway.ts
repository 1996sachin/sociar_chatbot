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
import { Types } from 'mongoose';
import { UseFilters, UseInterceptors } from '@nestjs/common';
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
import {
  MessageStatus,
  MessageTypes,
} from 'src/messages/entities/message.entity';
import {
  SocketEvents,
  SocketPayloads,
} from 'src/common/constants/socket-events';
import { TenantDatabaseInterceptor } from 'src/tenant-database/tenant-database.interceptor';
import { ConversationType } from 'src/conversations/entities/conversation.entity';

const logger = new CustomLogger('Chat Gateway');

@UseFilters(new SocketExceptionFilter())
@WebSocketGateway({
  port: Number(process.env.PORT),
  cors: {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: '*',
  },
})
@UseInterceptors(TenantDatabaseInterceptor)
export class ChatGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleDisconnect(@ConnectedSocket() client: Socket) {
    // Remove user from online pool
    if (
      !client.data?.tenantServices ||
      !client.data?.tenantServices?.SocketStore
    )
      return;
    const { SocketStore } = client.data.tenantServices;
    logger.debug(`[disconnected] ${client.id}`);
    SocketStore.remove(client.id);
  }

  @SubscribeMessage('init')
  async init(
    @MessageBody(
      new ZodValidationPipe(
        initializeChatSchema,
        (error) =>
          new WsException({
            event: SocketEvents.ERROR,
            data: {
              error: error.format(),
            } as SocketPayloads[SocketEvents.ERROR]['data'],
          }),
      ),
    )
    data: InitializeChatDto,
    @ConnectedSocket() client: Socket,
  ) {
    const {
      MessageService,
      ConversationParticipantService,
      SocketStore,
      UsersService,
    } = client.data.tenantServices;

    logger.debug(`[connected] socket: ${client.id}, userId: ${data.userId}`);

    SocketStore.remove(client.id);
    SocketStore.add(data.userId, client.id, client);
    await UsersService.saveIfNotExists({ userId: data.userId });

    // deliver msg after init
    const conversationInfos =
      await ConversationParticipantService.conversationsOfUser(data.userId);
    const conversations = conversationInfos.map(
      (conversationInfo) => conversationInfo.conversation,
    );

    const latestMessages =
      await MessageService.getLastMessageOfConversations(conversations);

    const notOurMessages = latestMessages
      .filter((messages) => messages.user.userId !== data.userId)
      .map((message) => message._id);

    await MessageService.getRepository().updateMany(
      { conversation: { $in: notOurMessages } },
      { $set: { messageStatus: MessageStatus.DELIVERED } },
    );
  }

  @SubscribeMessage('createConversation')
  async createConversation(
    @MessageBody(
      new ZodValidationPipe(
        createConversationSchema,
        (error) =>
          new WsException({
            event: SocketEvents.ERROR,
            data: {
              error: error.format(),
            } as SocketPayloads[SocketEvents.ERROR]['data'],
          }),
      ),
    )
    data: CreateConversationDto,
    @ConnectedSocket() client: Socket,
  ) {
    const {
      SocketStore,
      UsersService,
      ConversationParticipantService,
      ConversationsService,
    } = client.data.tenantServices;

    const userId = SocketStore.getUserFromSocket(client.id);
    if (!userId) throw new WsException('Initiate socket connection');

    const { participants } = data;
    const allParticipants = [
      ...participants.map((parti) => parti.toString()),
      ...(participants.includes(userId) ? [] : [userId]),
    ];
    if (allParticipants.length < 2)
      throw new WsException('Invalid participants');

    //Check if participants exists
    const usersInfo = await UsersService.findWhere({
      userId: { $in: allParticipants },
    });

    const allUserInfo = [...usersInfo];
    if (allParticipants.length !== usersInfo.length) {
      const addNewUsers = await UsersService.addNewUsers(
        allParticipants,
        usersInfo,
      );
      allUserInfo.push(...(addNewUsers as any[]));
    }

    //Validate If conversation of same participants exists
    const conversationParticipants =
      await ConversationParticipantService.getPastConversation(allParticipants);
    if (conversationParticipants.length > 0)
      return {
        event: SocketEvents.CONVERSATION_INFO,
        data: { conversationId: conversationParticipants[0].conversation },
      };

    const userInfo = await UsersService.findWhere({ userId });
    const conversation = await ConversationsService.save({
      createdBy: userInfo[0]._id,
      conversationType:
        allParticipants.length > 2
          ? ConversationType.GROUP
          : ConversationType.PRIVATE,
    });

    const conversationParticipant =
      await ConversationParticipantService.saveMany(
        allUserInfo.map((participant) => ({
          conversation: new Types.ObjectId(conversation.id),
          user: participant._id,
        })),
      );

    // Update in conversation with participants
    await ConversationsService.update(conversation.id, {
      $addToSet: {
        participants: conversationParticipant,
      },
    });

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
        (error) =>
          new WsException({
            event: SocketEvents.ERROR,
            data: {
              error: error.format(),
            } as SocketPayloads[SocketEvents.ERROR]['data'],
          }),
      ),
    )
    data: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const {
      UsersService,
      MessageService,
      ConversationParticipantService,
      SocketStore,
      ConversationsService,
      SocketService,
    } = client.data.tenantServices;

    // Get userId from socket
    const userId = SocketStore.getUserFromSocket(client.id);
    if (!userId) throw new WsException('Initiate socket connection');

    const { conversationId, message } = data;

    // Check If conversationId exists
    const conversation = await ConversationsService.find(conversationId);
    if (!conversation) throw new WsException('Invalid conversation');

    // Get participants & Check If user is part of conversation
    const participants =
      await ConversationParticipantService.getParticipantsUserDetails(
        conversationId,
      );
    if (!participants) throw new WsException('Invalid conversation');

    const partOfConversation = participants.find(
      (participant) => participant.userDetail[0].userId === userId,
    );
    if (!partOfConversation) throw new WsException('Invalid conversation');

    // Code for making seen if user directly sends message without seen
    const lastMessage = await MessageService.getRepository()
      .findOne({ conversation: new Types.ObjectId(conversationId) })
      .sort({ createdAt: -1 })
      .lean();

    if (lastMessage && !lastMessage.seenBy.includes(userId)) {
      // for removing the previous seen status in the message after pushing a new message
      await MessageService.changeMessageStatus(conversationId, userId);

      const payload: SocketPayloads[SocketEvents.STATUS_UPDATE] = {
        conversationId: conversationId,
        group: conversation.participants.length > 2 ? true : false,
        messageId: lastMessage?._id as string,
        messageStatus: MessageStatus.SEEN,
        seenBy: [...lastMessage?.seenBy, userId],
      };

      SocketService.emitToFilteredSocket(
        SocketEvents.STATUS_UPDATE,
        participants,
        userId,
        payload,
      );
    }

    const user = await UsersService.findWhere({ userId });
    const messageInfo = await MessageService.save({
      conversation: new Types.ObjectId(conversationId),
      content: message, // Crypt
      messageStatus: MessageStatus.SENT,
      sender: new Types.ObjectId(user[0].id),
      seenBy: [userId],
    });
    await ConversationsService.update(conversationId, {
      $set: {
        lastMessage: message,
      },
    });

    // Seen & pull
    await MessageService.seenMessage(conversationId, userId);

    // If the user is in online "notify" that user with message

    const payload: SocketPayloads[SocketEvents.MESSAGE] = {
      message: data.message,
      createdAt: (messageInfo as any).createdAt,
      new: conversation.lastMessage ? false : true,
      group: conversation.participants.length > 2 ? true : false,
      conversationId: conversationId,
      userId: userId,
      messageType: MessageTypes.TEXT,
      participants: participants.map(
        (participant) => participant.userDetail[0].userId,
      ),
    };

    const emittedSockets = SocketService.emitToFilteredSocket(
      SocketEvents.MESSAGE,
      participants,
      userId,
      payload,
    );

    if (emittedSockets <= 0) return;

    const changed = await MessageService.getRepository().findByIdAndUpdate(
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
    };
    SocketService.emitToSocket(
      SocketEvents.STATUS_UPDATE,
      participants,
      payloadd,
    );
  }

  @SubscribeMessage('seenMessage')
  async seenMessage(
    @MessageBody() data: seenMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const {
      MessageService,
      ConversationParticipantService,
      SocketStore,
      ConversationsService,
      SocketService,
    } = client.data.tenantServices;

    const userId = SocketStore.getUserFromSocket(client.id);
    if (!userId) throw new WsException('Initiate socket connection');

    const { conversationId } = data;

    // Check If conversationId exists
    const conversation = await ConversationsService.find(conversationId);
    if (!conversation)
      throw new WsException('No any conversation with such id found');

    // Get participants of conversation
    const participants =
      await ConversationParticipantService.getParticipantsExcludingSelf(
        conversationId,
        userId,
      );

    if (!participants) throw new WsException('Invalid conversation');

    // using the seen logic from the message service
    const updatedMessage = await MessageService.seenMessage(
      conversation._id as string,
      userId,
    );
    await MessageService.changeMessageStatus(
      conversation._id as string,
      userId,
    );

    const messages = await MessageService.getRepository()
      .find({ conversation: conversation._id })
      .sort({ createdAt: -1 })
      .lean();

    const payload: SocketPayloads[SocketEvents.STATUS_UPDATE] = {
      conversationId: conversationId,
      messageId: messages[0]._id as string,
      group: conversation.participants.length > 2 ? true : false,
      messageStatus: MessageStatus.SEEN,
      seenBy: updatedMessage!.seenBy,
    };

    SocketService.emitToSocket(
      SocketEvents.STATUS_UPDATE,
      participants,
      payload,
    );
  }
}
