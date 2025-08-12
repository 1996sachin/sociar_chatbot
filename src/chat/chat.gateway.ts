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
  seenMessageDto,
  addParticipantsDto,
} from './chat.validator';
import { SocketExceptionFilter } from 'src/common/helpers/handlers/socket.filter';
import { CustomLogger } from 'src/config/custom.logger';
import { ChatService } from './chat.service';
import { MessageStatus } from 'src/messages/entities/message.entity';

const logger = new CustomLogger('Chat Gateway');

@UseFilters(new SocketExceptionFilter())
@WebSocketGateway(Number(process.env.PORT!), {
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
    private readonly chatService: ChatService,
    private readonly conversationService: ConversationsService,
    private readonly messageService: MessageService,
    private readonly conversationPService: ConversationParticipantService,
  ) { }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    // Remove user from online pool
    logger.debug(`[disconnected] ${client.id}`);
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
    logger.debug(`[connected] socket: ${client.id}, userId: ${data.userId}`);
    this.socketStore.remove(client.id);
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
    const conversation = await this.conversationService.find(conversationId);
    if (!conversation)
      return {
        event: 'error',
        data: { message: 'Invalid conversation' },
      };

    // Get participants & Check If user is part of conversation
    const participants =
      await this.conversationPService.getParticipantsUserDetails(
        conversationId,
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
      messageStatus: MessageStatus.SENT,
      sender: new Types.ObjectId(user[0].id),
      seenBy: [userId],
    });

    await this.conversationService.update(conversationId, {
      lastMessage: message,
    });

    // If the user is in online "notify" that user with message
    const emittedSockets = this.chatService.emitToFilteredSocket(
      'message',
      participants,
      userId,
      {
        message: data.message,
        createdAt: (messageInfo as any).createdAt,
        new: conversation.lastMessage ? false : true,
        group: participants.length > 2 ? true : false,
        conversationId: conversationId,
        userId: userId,
      },
    );

    if (emittedSockets <= 0) return;

    await this.messageService.updateWhere(
      {
        conversation: new Types.ObjectId(conversationId),
      },
      {
        messageStatus: MessageStatus.DELIVERED,
      },
    );
    this.chatService.emitToSocket('statusUpdate', participants, {
      conversationId: conversationId,
      messageStatus: MessageStatus.DELIVERED,
    });
  }

  @SubscribeMessage('seenMessage')
  async seenMessage(
    @MessageBody() data: seenMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.socketStore.getUserFromSocket(client.id);
    if (!userId)
      return {
        event: 'error',
        data: { message: 'Initiate socket connection' },
      };

    const { conversationId } = data;

    // Check If conversationId exists
    const conversation = await this.conversationService.find(conversationId);
    if (!conversation)
      return {
        event: 'error',
        data: { message: 'No any conversation with such id found' },
      };

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
        {
          $sort: { createdAt: -1 },
        },
      ]);

    if (!participants)
      return {
        event: 'error',
        data: { message: 'Invalid conversation' },
      };

    const messages = await this.messageService
      .getRepository()
      .find({ conversation: conversation._id })
      .sort({ createdAt: -1 })
      .lean();

    await this.messageService.getRepository().updateMany(
      {
        conversation: conversation._id,
        _id: { $ne: messages[0]._id },
      },
      { $pull: { seenBy: userId } },
    );

    const updatedMessage = await this.messageService
      .getRepository()
      .findOneAndUpdate(
        {
          _id: messages[0]._id,
        },
        {
          $addToSet: { seenBy: userId },
        },
        { new: true },
      );

    this.chatService.emitToSocket('statusUpdate', participants, {
      conversationId: conversationId,
      messageId: messages[0]._id,
      seenBy: updatedMessage!.seenBy,
    });
  }

  @SubscribeMessage('addParticipants')
  async addParticipants(
    @MessageBody() data: addParticipantsDto,
    @ConnectedSocket() client: Socket,
  ) {
    const currentUser = this.socketStore.getUserFromSocket(client.id);
    if (!currentUser) {
      return {
        event: 'error',
        data: { message: 'Initiate socket connection' },
      };
    }

    const { participantId, conversationId } = data;

    const currentUserDetails = await this.userService.getRepository().findOne({
      userId: currentUser,
    });

    if (!currentUserDetails) {
      return {
        event: 'warning',
        message: 'No such user found',
      };
    }

    // Check If conversationId exists
    const conversation = await this.conversationService
      .getRepository()
      .findById(conversationId);
    if (!conversation)
      return {
        event: 'error',
        data: { message: 'No any conversation with such id found' },
      };

    // finding mongoose userId of the user
    const participantDetails = await this.userService.getRepository().findOne({
      userId: participantId,
    });

    if (!participantDetails) {
      return {
        event: "warning",
        message: "no such user found"
      }
    }

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
            'userDetail.userId': { $ne: participantId },
          },
        },
      ]);

    if (!participants || participants.length === 0) {
      return {
        event: 'error',
        data: { message: 'Invalid conversation' },
      };
    }

    // if group adding the new participant
    if (participants.length > 2) {
      const participantPartOfConv = await this.conversationPService.findWhere({
        conversation: new Types.ObjectId(conversationId),
        user: participantDetails._id,
      });

      if (participantPartOfConv.length !== 0) {
        return {
          event: 'warning',
          message: 'participant is already part of this conversation',
        };
      }

      const newParticipant = await this.conversationPService.save({
        conversation: new Types.ObjectId(conversationId),
        user: participantDetails._id,
      });

      await this.conversationService.getRepository().updateOne(
        { _id: conversationId },
        {
          $addToSet: { participants: newParticipant._id },
        },
      );

      await this.messageService.save({
        conversation: new Types.ObjectId(conversationId),
        sender: currentUserDetails._id,
        content: `{${currentUser}} added {${participantDetails.userId}} to the conversation`,
        messageType: 'log',
        messageStatus: 'delivered',
      });
    } else {

      // creating a new conversation if personal msg
      const newConversation = await this.conversationService.getRepository().create({
      })

      if (!newConversation) {
        return {
          event: 'warning',
          message: "something went wrong while creating the conversation"
        }
      }

      const oldParticipants = participants.map((p) => ({
        _id: new Types.ObjectId(),
        conversation: new Types.ObjectId(String(newConversation._id)),
        user: p.user
      }))

      if (!oldParticipants.some(p => p.user.equals(participantDetails._id))) {
        oldParticipants.push({
          _id: new Types.ObjectId(),
          conversation: new Types.ObjectId(String(newConversation._id)),
          user: new Types.ObjectId(String(participantDetails._id)),
        })
      }

      await this.conversationPService.getRepository().insertMany(oldParticipants)

      await this.conversationService.getRepository().updateOne({
        _id: newConversation._id
      }, {
        $set: { participants: oldParticipants.map(x => x._id) }
      })

      await this.messageService.save({
        conversation: new Types.ObjectId(String(newConversation._id)),
        sender: currentUserDetails._id,
        content: `{${currentUser}} added {${participantDetails.userId}} to the conversation`,
        messageType: 'log',
        messageStatus: 'delivered',
      });

    }
  }
}
