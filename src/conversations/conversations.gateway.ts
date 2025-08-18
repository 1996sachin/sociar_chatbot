/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Types } from 'mongoose';
import { UseFilters, UseInterceptors } from '@nestjs/common';
import { SocketExceptionFilter } from 'src/common/helpers/handlers/socket.filter';
import {
  MessageStatus,
  MessageTypes,
} from 'src/messages/entities/message.entity';
import { Conversation } from 'src/conversations/entities/conversation.entity';
import { ValidationWithModelPipe } from 'src/common/helpers/validation-helper';
import {
  type leaveConversationDto,
  leaveConversationSchema,
  type removeParticipantDto,
  removeParticipantSchema,
  renameConversationSchema,
  type addParticipantsDto,
  type renameConversationDto,
} from 'src/chat/chat.validator';
import {
  SocketEvents,
  SocketPayloads,
} from 'src/common/constants/socket-events';
import { TenantDatabaseInterceptor } from 'src/tenant-database/tenant-database.interceptor';

@UseFilters(new SocketExceptionFilter())
@WebSocketGateway(Number(process.env.PORT), {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
@UseInterceptors(TenantDatabaseInterceptor)
export class ConversationsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('addParticipants')
  async addParticipants(
    @MessageBody() // AddParticipantsValidationPipe
    data: addParticipantsDto,
    @ConnectedSocket() client: Socket,
  ) {
    const {
      MessageService,
      ConversationParticipantService,
      SocketStore,
      ConversationsService,
      UsersService,
    } = client.data.tenantServices;

    const currentUser = SocketStore.getUserFromSocket(client.id);

    if (!currentUser) {
      return {
        event: SocketEvents.ERROR,
        data: {
          message: 'Initiate socket connection',
        } as SocketPayloads[SocketEvents.ERROR]['data'],
      };
    }

    const { participantId, conversationId } = data;

    const currentUserDetails = await UsersService.getRepository().findOne({
      userId: currentUser,
    });

    if (!currentUserDetails) {
      return {
        event: SocketEvents.WARNING,
        message:
          'No such user found' as SocketPayloads[SocketEvents.WARNING]['message'],
      };
    }

    // Check If conversationId exists
    const conversation =
      await ConversationsService.getRepository().findById(conversationId);
    if (!conversation)
      return {
        event: SocketEvents.ERROR,
        data: {
          message: 'No any conversation with such id found',
        } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

    // finding mongoose userId of the user
    const participantDetails = await UsersService.getRepository().findOne({
      userId: participantId,
    });

    if (!participantDetails) {
      return {
        event: SocketEvents.WARNING,
        message:
          'no such user found' as SocketPayloads[SocketEvents.MESSAGE]['message'],
      };
    }

    // Get participants of conversation
    const participants =
      await ConversationParticipantService.getParticipantsExcludingSelf(
        conversationId,
        participantId,
      );

    if (!participants || participants.length === 0) {
      return {
        event: SocketEvents.ERROR,
        data: {
          message: 'Invalid conversation',
        } as SocketPayloads[SocketEvents.ERROR]['data'],
      };
    }

    // if group adding the new participant
    if (conversation.conversationType === 'group') {
      const participantPartOfConv =
        await ConversationParticipantService.findWhere({
          conversation: new Types.ObjectId(conversationId),
          user: participantDetails._id,
        });

      if (participantPartOfConv.length !== 0) {
        return {
          event: SocketEvents.WARNING,
          message:
            'participant is already part of this conversation' as SocketPayloads[SocketEvents.WARNING]['message'],
        };
      }

      const newParticipant = await ConversationParticipantService.save({
        conversation: new Types.ObjectId(conversationId),
        user: participantDetails._id,
      });

      await ConversationsService.getRepository().updateOne(
        { _id: conversationId },
        {
          $addToSet: { participants: newParticipant._id },
        },
      );

      const logMsg = await MessageService.save({
        conversation: new Types.ObjectId(conversationId),
        sender: currentUserDetails._id,
        content: `{${currentUser}} added {${participantDetails.userId}} to the conversation`,
        messageType: MessageTypes.LOG,
        messageStatus: MessageStatus.DELIVERED,
      });

      await ConversationsService.updateWhere(
        {
          _id: new Types.ObjectId(conversationId),
        },
        {
          lastMessage: logMsg.content,
        },
      );
    } else {
      // creating a new conversation if personal msg
      const newConversation = await ConversationsService.getRepository().create(
        {
          createdBy: currentUserDetails._id,
          conversationType: 'group',
        },
      );

      if (!newConversation) {
        return {
          event: SocketEvents.WARNING,
          message:
            'something went wrong while creating the conversation' as SocketPayloads[SocketEvents.WARNING]['message'],
        };
      }

      const oldParticipants = participants.map((p) => ({
        _id: new Types.ObjectId(),
        conversation: new Types.ObjectId(String(newConversation._id)),
        user: p.user,
      }));

      if (!oldParticipants.some((p) => p.user.equals(participantDetails._id))) {
        oldParticipants.push({
          _id: new Types.ObjectId(),
          conversation: new Types.ObjectId(String(newConversation._id)),
          user: new Types.ObjectId(String(participantDetails._id)),
        });
      }

      await ConversationParticipantService.getRepository().insertMany(
        oldParticipants,
      );

      await ConversationsService.getRepository().updateOne(
        {
          _id: newConversation._id,
        },
        {
          $set: { participants: oldParticipants.map((x) => x._id) },
        },
      );

      await MessageService.save({
        conversation: new Types.ObjectId(String(newConversation._id)),
        sender: currentUserDetails._id,
        content: `{${currentUser}} added {${participantDetails.userId}} to the conversation`,
        messageType: MessageTypes.LOG,
        messageStatus: MessageStatus.DELIVERED,
      });
    }
  }

  @SubscribeMessage('leaveConversation')
  async leaveConversation(
    @MessageBody(
      ValidationWithModelPipe(Conversation.name, leaveConversationSchema),
    )
    data: leaveConversationDto,
    @ConnectedSocket() client: Socket,
  ) {
    const {
      MessageService,
      ConversationParticipantService,
      SocketStore,
      ConversationsService,
    } = client.data.tenantServices;

    const currentUser = SocketStore.getUserFromSocket(client.id);
    if (!currentUser) {
      return {
        event: SocketEvents.ERROR,
        data: {
          message: 'Initiate socket connection',
        } as SocketPayloads[SocketEvents.ERROR]['data'],
      };
    }

    const { conversationId } = data;

    const participants =
      await ConversationParticipantService.getParticipantsUserDetails(
        conversationId,
      );

    if (!participants) {
      return {
        event: SocketEvents.ERROR,
        data: {
          message: 'Invalid conversation',
        } as SocketPayloads[SocketEvents.ERROR]['data'],
      };
    }

    // using the service to leave the conversation
    await ConversationsService.leaveConversation(conversationId, currentUser);

    const lastMessage = await MessageService.getLastMessage(conversationId);

    const payload = {
      conversationId: conversationId,
      group: participants.length > 2 ? true : false,
      messageId: lastMessage[0]._id,
      message: lastMessage[0].content,
      messageStatus: MessageStatus.SEEN,
      userId: currentUser,
      messageType: lastMessage[0].messageType,
    };

    SocketStore.emitToFilteredSocket(
      SocketEvents.LOG_MESSAGE,
      participants,
      currentUser as string,
      payload as SocketPayloads[SocketEvents.LOG_MESSAGE],
    );
  }

  // socket event for admin to remove the conversation participants
  @SubscribeMessage('removeParticipant')
  async removeParticipant(
    @MessageBody(
      ValidationWithModelPipe(Conversation.name, removeParticipantSchema),
    )
    data: removeParticipantDto,
    @ConnectedSocket() client: Socket,
  ) {
    const {
      MessageService,
      ConversationParticipantService,
      SocketStore,
      ConversationsService,
    } = client.data.tenantServices;

    const { participantId, conversationId } = data;

    const currentUser = SocketStore.getUserFromSocket(client.id);
    if (!currentUser) {
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Initiate socket connection' },
      };
    }

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

    await ConversationsService.removeParticipant(
      conversationId,
      currentUser,
      participantId,
    );

    const lastMessage = await MessageService.getLastMessage(conversationId);

    const payload: SocketPayloads[SocketEvents.LOG_MESSAGE] = {
      conversationId: conversationId,
      group: participants.length > 2 ? true : false,
      messageId: lastMessage[0]._id,
      message: lastMessage[0].content,
      messageStatus: MessageStatus.SEEN,
      userId: currentUser,
      messageType: lastMessage[0].messageType,
    };

    SocketStore.emitToFilteredSocket(
      SocketEvents.LOG_MESSAGE,
      participants,
      currentUser as string,
      payload,
    );
  }

  @SubscribeMessage('renameConversation')
  async renameConversation(
    @MessageBody(
      ValidationWithModelPipe(Conversation.name, renameConversationSchema),
    )
    data: renameConversationDto,
    @ConnectedSocket() client: Socket,
  ) {
    const {
      MessageService,
      ConversationParticipantService,
      SocketStore,
      ConversationsService,
    } = client.data.tenantServices;

    const { name, conversationId } = data;

    const currentUser = SocketStore.getUserFromSocket(client.id);
    if (!currentUser) {
      return {
        event: SocketEvents.ERROR,
        data: {
          message: 'Initiate socket connection',
        } as SocketPayloads[SocketEvents.ERROR]['data'],
      };
    }

    const participants =
      await ConversationParticipantService.getParticipantsUserDetails(
        conversationId,
      );

    if (!participants) {
      return {
        event: SocketEvents.ERROR,
        data: {
          message: 'Invalid conversation',
        } as SocketPayloads[SocketEvents.ERROR]['data'],
      };
    }

    await ConversationsService.renameConversation(
      conversationId,
      currentUser,
      name,
    );

    const lastMessage = await MessageService.getLastMessage(conversationId);

    const payload: SocketPayloads[SocketEvents.LOG_MESSAGE] = {
      conversationId: conversationId,
      group: participants.length > 2 ? true : false,
      messageId: lastMessage[0]._id,
      message: lastMessage[0].content,
      messageStatus: MessageStatus.SEEN,
      userId: currentUser,
      messageType: lastMessage[0].messageType,
    };

    SocketStore.emitToFilteredSocket(
      SocketEvents.LOG_MESSAGE,
      participants,
      currentUser as string,
      payload,
    );
  }
}
