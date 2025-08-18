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
import { MessageStatus } from 'src/messages/entities/message.entity';
import {
  SocketEvents,
  SocketPayloads,
} from 'src/common/constants/socket-events';
import { TenantDatabaseInterceptor } from 'src/tenant-database/tenant-database.interceptor';

const logger = new CustomLogger('Chat Gateway');

@UseFilters(new SocketExceptionFilter())
@WebSocketGateway(Number(process.env.PORT!), {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
@UseInterceptors(TenantDatabaseInterceptor)
export class ChatGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleDisconnect(@ConnectedSocket() client: Socket) {
    // Remove user from online pool
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
      await ConversationParticipantService.getRepository().aggregate([
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

    const latestMessages = await MessageService.getRepository().aggregate([
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
        data: {
          message: 'Invalid participants',
        } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

    //Check if participants exists
    const userInfo = await UsersService.findWhere({
      userId: { $in: allParticipants },
    });

    const allUserInfo = [...userInfo];
    if (allParticipants.length !== userInfo.length) {
      const addNewUsers = await UsersService.addNewUsers(
        allParticipants,
        userInfo,
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

    const conversation = await ConversationsService.save({});

    const conversationParticipant =
      await ConversationParticipantService.saveMany(
        allUserInfo.map((participant) => ({
          conversation: new Types.ObjectId(conversation.id),
          user: participant._id,
        })),
      );

    // Update in conversation with participants
    await ConversationsService.update(conversation.id, {
      participants: conversationParticipant,
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
    } = client.data.tenantServices;

    // Get userId from socket
    const userId = SocketStore.getUserFromSocket(client.id);
    if (!userId)
      return {
        event: SocketEvents.ERROR,
        data: {
          message: 'Initiate socket connection',
        } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

    const { conversationId, message } = data;

    // Check If conversationId exists
    const conversation = await ConversationsService.find(conversationId);
    if (!conversation)
      return {
        event: SocketEvents.ERROR,
        data: {
          message: 'Invalid conversation',
        } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

    // Get participants & Check If user is part of conversation
    const participants =
      await ConversationParticipantService.getParticipantsUserDetails(
        conversationId,
      );
    if (!participants)
      return {
        event: SocketEvents.ERROR,
        data: {
          message: 'Invalid conversation',
        } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

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

      SocketStore.emitToFilteredSocket(
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
      lastMessage: message,
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
      participants: participants.map(
        (participant) => participant.userDetail[0].userId,
      ),
    };

    console.log('SocketStore', SocketStore);
    const emittedSockets = SocketStore.emitToFilteredSocket(
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
    SocketStore.emitToSocket(
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
    } = client.data.tenantServices;

    const userId = SocketStore.getUserFromSocket(client.id);
    if (!userId)
      return {
        event: SocketEvents.ERROR,
        data: {
          message: 'Initiate socket connection',
        } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

    const { conversationId } = data;

    // Check If conversationId exists
    const conversation = await ConversationsService.find(conversationId);
    if (!conversation)
      return {
        event: SocketEvents.ERROR,
        data: {
          message: 'No any conversation with such id found',
        } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

    // Get participants of conversation
    const participants =
      await ConversationParticipantService.getParticipantsExcludingSelf(
        conversationId,
        userId,
      );

    if (!participants)
      return {
        event: SocketEvents.ERROR,
        data: {
          message: 'Invalid conversation',
        } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

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

    SocketStore.emitToSocket(SocketEvents.STATUS_UPDATE, participants, payload);
  }
}
