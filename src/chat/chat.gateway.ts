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
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketStore } from './socket.store';
import { MessageService } from 'src/messages/messages.service';
import { ConversationsService } from 'src/conversations/conversations.service';
import { ConversationParticipantService } from 'src/conversation-participant/conversation-participant.service';
import { UsersService } from 'src/users/users.service';
import { Types } from 'mongoose';
import { CustomLogger } from 'src/config/custom.logger';

const logger = new CustomLogger('Chat Gateway');

interface InitializeChat {
  userId: string;
}

interface CreateConversation {
  participants: string[];
}
interface SendMessage {
  conversationId: string;
  message: string;
}

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

  @SubscribeMessage('init') async init(
    @MessageBody() data: InitializeChat,
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
    @MessageBody() data: CreateConversation,
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
    if (participants.length > 1)
      return { event: 'error', data: { message: 'Too many participants' } };

    const allParticipants = [
      ...participants.map((parti) => parti.toString()),
      userId,
    ];
    if (participants.length <= 0)
      return {
        event: 'error',
        data: { message: 'Empty participants' },
      };

    //Check if participants exists
    const userInfo = await this.userService.findWhere({
      userId: { $in: allParticipants },
    });
    let newUserInfo;
    if (allParticipants.length !== userInfo.length) {
      const newUsers = allParticipants.filter((participant) =>
        userInfo.find((user) => user.userId !== participant),
      );
      newUserInfo = await this.userService.saveMany(
        newUsers.map((newUser) => ({
          userId: newUser,
        })),
      );
      // return {
      //   event: 'error',
      //   data: { message: 'Invalid participants' },
      // };
    }

    //Validate If conversation of same participants exists
    const conversationParticipants = await this.conversationPService
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
          $match: { 'userDetails.userId': { $in: allParticipants } },
        },
        {
          $group: {
            _id: '$conversation',
            userDetails: { $push: '$userDetails' },
            userIds: { $addToSet: '$userDetails.userId' },
          },
        },
        { $match: { $expr: { $setEquals: ['$userIds', allParticipants] } } },
        {
          $project: {
            _id: 0,
            conversation: '$_id',
            userDetails: 1,
            userIds: 1,
          },
        },
      ]);
    if (conversationParticipants.length > 0)
      return {
        event: 'conversationInfo',
        data: { conversationId: conversationParticipants[0].conversation },
      };

    const conversation = await this.conversationService.save({});

    const conversationParticipant = await this.conversationPService.saveMany(
      [...userInfo, ...(newUserInfo?.length ? newUserInfo : [])].map(
        (participant) => ({
          conversation: new Types.ObjectId(conversation.id),
          user: participant._id,
        }),
      ),
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
    @MessageBody() data: SendMessage,
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

    // Check conversationId type
    if (!Types.ObjectId.isValid(conversationId))
      return {
        event: 'error',
        data: { message: 'Invalid conversation' },
      };

    // Check If conversationId exists
    const conversation = await this.conversationService
      .getRepository()
      .findById(conversationId);
    if (!conversation)
      return {
        event: 'error',
        data: { message: 'Invalid conversation' },
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

    const user = await this.userService.findWhere({ userId });

    // Add message to db
    const messageInfo = await this.messageService.save({
      conversation: new Types.ObjectId(conversationId),
      content: message, // Crypt
      messageStatus: 'sent',
      sender: new Types.ObjectId(user[0].id),
    });

    await this.conversationService.update(conversationId, {
      lastMessage: message,
    });

    // If the user is in online "notify" that user with message
    participants
      .filter(
        (participant) =>
          ![this.socketStore.getUserFromSocket(client.id), undefined].includes(
            participant.userDetail[0].userId,
          ),
      )
      .map((participant: any) =>
        this.socketStore.getFromUser(participant.userDetail[0].userId),
      )
      .forEach((socket) => {
        if (socket)
          socket.emit('message', {
            message: data.message,
            createdAt: (messageInfo as any).createdAt,
            new: conversation.lastMessage ? false : true,
            conversationId: conversationId,
            userId: userId,
          });
      });
  }
}
