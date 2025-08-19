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
import { ConversationsService } from 'src/conversations/conversations.service';
import { ConversationParticipantService } from 'src/conversation-participant/conversation-participant.service';
import { UsersService } from 'src/users/users.service';
import { Types } from 'mongoose';
import { UseFilters } from '@nestjs/common';

import { SocketExceptionFilter } from 'src/common/helpers/handlers/socket.filter';
import { MessageStatus, MessageTypes } from 'src/messages/entities/message.entity';
import { Conversation } from 'src/conversations/entities/conversation.entity';
import { ValidationWithModelPipe } from 'src/common/helpers/validation-helper';
import { type leaveConversationDto, leaveConversationSchema, type removeParticipantDto, removeParticipantSchema, renameConversationSchema, type addParticipantsDto, type renameConversationDto, initializeChatSchema, type InitializeChatDto } from 'src/chat/chat.validator';
import { ChatService } from 'src/chat/chat.service';
import { MessageService } from 'src/messages/messages.service';
import { SocketEvents, SocketPayloads } from 'src/common/constants/socket-events';
import { SocketStore } from 'src/common/socket/socket.store';


@UseFilters(new SocketExceptionFilter())
@WebSocketGateway(Number(process.env.PORT), {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class ConversationsGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    public readonly socketStore: SocketStore,
    private readonly userService: UsersService,
    private readonly chatService: ChatService,
    private readonly conversationService: ConversationsService,
    private readonly messageService: MessageService,
    private readonly conversationPService: ConversationParticipantService,
  ) {
  }

  @SubscribeMessage('addParticipants')
  async addParticipants(
    @MessageBody() // AddParticipantsValidationPipe
    data: addParticipantsDto,
    @ConnectedSocket() client: Socket,
  ) {

    const currentUser = this.socketStore.getUserFromSocket(client.id);

    if (!currentUser) {
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Initiate socket connection' } as SocketPayloads[SocketEvents.ERROR]['data']
        ,
      };
    }

    const { participantId, conversationId } = data;

    const currentUserDetails = await this.userService.getRepository().findOne({
      userId: currentUser,
    });

    if (!currentUserDetails) {
      return {
        event: SocketEvents.WARNING,
        message: 'No such user found' as SocketPayloads[SocketEvents.WARNING]['message'],
      };
    }

    // Check If conversationId exists
    const conversation = await this.conversationService
      .getRepository()
      .findById(conversationId);
    if (!conversation)
      return {
        event: SocketEvents.ERROR,
        data: { message: 'No any conversation with such id found' } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

    // finding mongoose userId of the user

    const allParticipants = [
      ...participantId,
    ]

    const partDetails = await Promise.all(
      allParticipants.map(x => {
        return this.userService.getRepository().findOne({
          userId: x
        })
      })
    )

    // Get participants of conversation
    const participants = await this.conversationPService.getParticipantsExcludingSelf(conversationId, participantId)

    if (!participants || participants.length === 0) {
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Invalid conversation' } as SocketPayloads[SocketEvents.ERROR]['data'],
      };
    }

    // if group adding the new participant
    if (conversation.conversationType === 'group') {
      for (const participantDetails of partDetails) {
        if (!participantDetails) continue; // skip invalid user

        const participantPartOfConv = await this.conversationPService.findWhere({
          conversation: new Types.ObjectId(conversationId),
          user: participantDetails._id,
        });

        if (participantPartOfConv.length !== 0) continue; // skip if already part

        const newParticipant = await this.conversationPService.save({
          conversation: new Types.ObjectId(conversationId),
          user: participantDetails._id,
        });

        await this.conversationService.getRepository().updateOne(
          { _id: conversationId },
          { $addToSet: { participants: newParticipant._id } },
        );

        const logMsg = await this.messageService.save({
          conversation: new Types.ObjectId(conversationId),
          sender: currentUserDetails._id,
          content: `{${currentUser}} added {${participantDetails.userId}} to the conversation`,
          messageType: MessageTypes.LOG,
          messageStatus: MessageStatus.DELIVERED,
        });

        await this.conversationService.updateWhere(
          { _id: new Types.ObjectId(conversationId) },
          { lastMessage: logMsg.content },
        );
      }
    }
    else {
      // creating a new conversation if personal msg
      const newConversation = await this.conversationService
        .getRepository()
        .create({
          createdBy: currentUserDetails._id,
          conversationType: 'group',
        });

      if (!newConversation) {
        return {
          event: SocketEvents.WARNING,
          message: 'something went wrong while creating the conversation' as SocketPayloads[SocketEvents.WARNING]['message'],
        };
      }

      // map old participants
      const oldParticipants = participants.map((p) => ({
        _id: new Types.ObjectId(),
        conversation: new Types.ObjectId(String(newConversation._id)),
        user: p.user,
      }));

      // loop through all valid participants and add if not already included
      for (const participantDetails of partDetails) {
        if (!participantDetails) continue; // skip invalid users

        if (!oldParticipants.some((p) => p.user.equals(participantDetails._id))) {
          oldParticipants.push({
            _id: new Types.ObjectId(),
            conversation: new Types.ObjectId(String(newConversation._id)),
            user: new Types.ObjectId(String(participantDetails._id)),
          });
        }
      }

      await this.conversationPService
        .getRepository()
        .insertMany(oldParticipants);

      await this.conversationService.getRepository().updateOne(
        { _id: newConversation._id },
        { $set: { participants: oldParticipants.map((x) => x._id) } },
      );

      // save logs for each participant added
      for (const participantDetails of partDetails) {
        if (!participantDetails) continue;

        await this.messageService.save({
          conversation: new Types.ObjectId(String(newConversation._id)),
          sender: currentUserDetails._id,
          content: `{${currentUser}} added {${participantDetails.userId}} to the conversation`,
          messageType: MessageTypes.LOG,
          messageStatus: MessageStatus.DELIVERED,
        });
      }

    }
  }

  @SubscribeMessage('leaveConversation')
  async leaveConversation(
    @MessageBody(
      ValidationWithModelPipe(Conversation.name, leaveConversationSchema)
    )
    data: leaveConversationDto,
    @ConnectedSocket() client: Socket
  ) {
    const currentUser = this.socketStore.getUserFromSocket(client.id)
    if (!currentUser) {
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Initiate socket connection' } as SocketPayloads[SocketEvents.ERROR]['data']
      }
    }

    const { conversationId } = data

    const participants = await this.conversationPService.getParticipantsUserDetails(
      conversationId
    )

    if (!participants) {
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Invalid conversation' } as SocketPayloads[SocketEvents.ERROR]['data']
      }
    }

    // using the service to leave the conversation
    await this.conversationService.leaveConversation(conversationId, currentUser)

    const lastMessage = await this.messageService.getLastMessage(conversationId)

    const payload = {
      conversationId: conversationId,
      group: participants.length > 2 ? true : false,
      messageId: lastMessage[0]._id,
      message: lastMessage[0].content,
      messageStatus: MessageStatus.SEEN,
      userId: currentUser,
      messageType: lastMessage[0].messageType

    }

    this.chatService.emitToFilteredSocket(SocketEvents.LOG_MESSAGE, participants, currentUser as string, payload as SocketPayloads[SocketEvents.LOG_MESSAGE]);

  }

  // socket event for admin to remove the conversation participants 
  @SubscribeMessage('removeParticipant')
  async removeParticipant(
    @MessageBody(
      ValidationWithModelPipe(Conversation.name, removeParticipantSchema)
    ) data: removeParticipantDto,
    @ConnectedSocket() client: Socket
  ) {

    const { participantId, conversationId } = data

    const currentUser = this.socketStore.getUserFromSocket(client.id)
    if (!currentUser) {
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Initiate socket connection' }
      }
    }

    const participants =
      await this.conversationPService.getParticipantsUserDetails(
        conversationId,
      );
    if (!participants)
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Invalid conversation' } as SocketPayloads[SocketEvents.ERROR]['data'],
      };

    await this.conversationService.removeParticipant(conversationId, currentUser, participantId)

    const lastMessage = await this.messageService.getLastMessage(conversationId)

    const payload: SocketPayloads[SocketEvents.LOG_MESSAGE] = {
      conversationId: conversationId,
      group: participants.length > 2 ? true : false,
      messageId: lastMessage[0]._id,
      message: lastMessage[0].content,
      messageStatus: MessageStatus.SEEN,
      userId: currentUser,
      messageType: lastMessage[0].messageType

    }

    this.chatService.emitToFilteredSocket(SocketEvents.LOG_MESSAGE, participants, currentUser as string, payload)
  }

  @SubscribeMessage('renameConversation')
  async renameConversation(
    @MessageBody(
      ValidationWithModelPipe(Conversation.name, renameConversationSchema)
    ) data: renameConversationDto,
    @ConnectedSocket() client: Socket
  ) {

    const { name, conversationId } = data

    const currentUser = this.socketStore.getUserFromSocket(client.id)
    if (!currentUser) {
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Initiate socket connection' } as SocketPayloads[SocketEvents.ERROR]['data']
      }
    }

    const participants = await this.conversationPService.getParticipantsUserDetails(
      conversationId
    )

    if (!participants) {
      return {
        event: SocketEvents.ERROR,
        data: { message: 'Invalid conversation' } as SocketPayloads[SocketEvents.ERROR]['data']
      }
    }

    await this.conversationService.renameConversation(conversationId, currentUser, name)

    const lastMessage = await this.messageService.getLastMessage(conversationId)

    const payload: SocketPayloads[SocketEvents.LOG_MESSAGE] = {
      conversationId: conversationId,
      group: participants.length > 2 ? true : false,
      messageId: lastMessage[0]._id,
      message: lastMessage[0].content,
      messageStatus: MessageStatus.SEEN,
      userId: currentUser,
      messageType: lastMessage[0].messageType

    }

    this.chatService.emitToFilteredSocket(SocketEvents.LOG_MESSAGE, participants, currentUser as string, payload)

  }
  conversationgat
}
