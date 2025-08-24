/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
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
      SocketService,
    } = client.data.tenantServices;

    const currentUser = SocketStore.getUserFromSocket(client.id);
    if (!currentUser) throw new WsException('Initiate socket connection');

    const { participants, conversationId } = data;

    const currentUserDetails = await UsersService.getRepository().findOne({
      userId: currentUser,
    });
    if (!currentUserDetails) throw new WsException('No such user found');

    // Check If conversationId exists
    const conversation =
      await ConversationsService.getWithCreatedBy(conversationId);
    if (!conversation)
      throw new WsException('No any conversation with such id found');
    if (conversation.conversationType !== 'group')
      throw new WsException('Cannot add participants in private conversation');

    // finding mongoose userId of the user
    const allParticipants = [...participants];

    const currentParticipants = await ConversationParticipantService.findWhere({
      conversation: conversation._id,
      user: currentUserDetails._id,
    });
    if (currentParticipants.length <= 0)
      throw new WsException('Invalid conversation');

    const participantsDetails =
      await ConversationParticipantService.getParticipantsUserDetails(
        conversationId,
      );
    if (!participants || participants.length <= 0)
      throw new WsException('Invalid conversation');

    const partOfConversation = participantsDetails.find(
      (participant) => participant.userDetail[0].userId === currentUser,
    );
    if (!partOfConversation) throw new WsException('Invalid conversation');

    const usersInfo = await UsersService.findWhere({
      userId: { $in: allParticipants },
    });
    const participantsInfo = await ConversationParticipantService.findWhere({
      conversation: conversation._id,
    });

    const newParticipantsUserInfo = usersInfo.filter((userInfo) =>
      participantsInfo.every(
        (participantInfo) =>
          participantInfo.user.toString() !== userInfo._id.toString(),
      ),
    );

    const newUserInfo: any[] = [];
    if (allParticipants.length !== usersInfo.length) {
      const addNewUsers = await UsersService.addNewUsers(
        allParticipants,
        usersInfo,
      );
      newUserInfo.push(...(addNewUsers as any[]));
    }

    const allNewParticipants = [...newUserInfo, ...newParticipantsUserInfo];
    if (allNewParticipants.length <= 0) return;

    const conversationParticipant =
      await ConversationParticipantService.saveMany(
        allNewParticipants.map((participant) => ({
          conversation: conversation._id,
          user: participant._id,
        })),
      );
    await ConversationsService.update(conversation.id, {
      $addToSet: {
        participants: conversationParticipant,
      },
    });
    const lastMsg = `{${currentUser}} added {${allNewParticipants.map((newParticipants) => newParticipants.userId)}} to the conversation`;
    const logMsg = await MessageService.save({
      conversation: new Types.ObjectId(conversationId),
      sender: currentUserDetails._id,
      content: lastMsg,
      messageType: MessageTypes.LOG,
      messageStatus: MessageStatus.DELIVERED,
    });

    await ConversationsService.update(conversationId, {
      $addToSet: {
        participants: conversationParticipant,
      },
      $set: {
        lastMessage: lastMsg,
      },
    });

    const payload: SocketPayloads[SocketEvents.LOG_MESSAGE] = {
      conversationId: conversationId,
      createdAt: logMsg.createdAt,
      group: conversation.participants.length > 2 ? true : false,
      message: logMsg.content,
      messageType: MessageTypes.LOG,
      new: true,
      userId: currentUser,
      name: conversation?.name ?? null,
      participants: [
        ...new Set([
          ...participantsDetails.map(
            (participantDetail) => participantDetail.userDetail[0].userId,
          ),
          ...participants.map((participant) => participant.toString()),
        ]),
      ],
      createdBy: conversation.createdBy.userId,
    };

    const participantsToEmit =
      await ConversationParticipantService.getParticipantsUserDetails(
        conversationId,
      );
    SocketService.emitToSocket(
      SocketEvents.LOG_MESSAGE,
      participantsToEmit,
      payload,
    );

    /* const partDetails = await Promise.all(
      allParticipants.map((x) => {
        return UsersService.getRepository().findOne({
          userId: x,
        });
      }),
    );

    // Get participants of conversation
    const participants =
      await ConversationParticipantService.getParticipantsExcludingSelf(
        conversationId,
        participantIds,
      );

    if (!participants || participants.length === 0)
      throw new WsException('Invalid conversation');

    console.log('conversation.conversationType', conversation.conversationType);
    // if group adding the new participant
    if (conversation.conversationType === 'group') {
      for (const participantDetails of partDetails) {
        console.log('participantDetails', participantDetails);
        if (!participantDetails) continue; // skip invalid user

        const participantPartOfConv =
          await ConversationParticipantService.findWhere({
            conversation: new Types.ObjectId(conversationId),
            user: participantDetails._id,
          });

        if (participantPartOfConv.length !== 0) continue; // skip if already part

        const newParticipant = await ConversationParticipantService.save({
          conversation: new Types.ObjectId(conversationId),
          user: participantDetails._id,
        });

        await ConversationsService.getRepository().updateOne(
          { _id: conversationId },
          { $addToSet: { participants: newParticipant._id } },
        );

        const logMsg = await MessageService.save({
          conversation: new Types.ObjectId(conversationId),
          sender: currentUserDetails._id,
          content: `{${currentUser}} added {${participantDetails.userId}} to the conversation`,
          messageType: MessageTypes.LOG,
          messageStatus: MessageStatus.DELIVERED,
        });
      }
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

      // map old participants
      const oldParticipants = participants.map((p) => ({
        _id: new Types.ObjectId(),
        conversation: new Types.ObjectId(String(newConversation._id)),
        user: p.user,
      }));

      // loop through all valid participants and add if not already included
      for (const participantDetails of partDetails) {
        if (!participantDetails) continue; // skip invalid users

        if (
          !oldParticipants.some((p) => p.user.equals(participantDetails._id))
        ) {
          oldParticipants.push({
            _id: new Types.ObjectId(),
            conversation: new Types.ObjectId(String(newConversation._id)),
            user: new Types.ObjectId(String(participantDetails._id)),
          });
        }
      }

      await ConversationParticipantService.getRepository().insertMany(
        oldParticipants,
      );

      await ConversationsService.getRepository().updateOne(
        { _id: newConversation._id },
        { $set: { participants: oldParticipants.map((x) => x._id) } },
      );

      // save logs for each participant added
      for (const participantDetails of partDetails) {
        if (!participantDetails) continue;

        await MessageService.save({
          conversation: new Types.ObjectId(String(newConversation._id)),
          sender: currentUserDetails._id,
          content: `{${currentUser}} added {${participantDetails.userId}} to the conversation`,
          messageType: MessageTypes.LOG,
          messageStatus: MessageStatus.DELIVERED,
        });
      }
    } */
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
      SocketService,
    } = client.data.tenantServices;

    const currentUser = SocketStore.getUserFromSocket(client.id);
    if (!currentUser) throw new WsException('Initiate socket connection');

    const { conversationId } = data;

    const participants =
      await ConversationParticipantService.getParticipantsUserDetails(
        conversationId,
      );

    if (!participants) throw new WsException('Invalid conversation');

    // using the service to leave the conversation
    const conversationLeftInfo = await ConversationsService.leaveConversation(
      conversationId,
      currentUser,
    );

    const lastMessage = await MessageService.getLastMessage(conversationId);

    const payload: SocketPayloads[SocketEvents.LOG_MESSAGE] = {
      conversationId: conversationId,
      createdAt: lastMessage[0].createdAt,
      group: participants.length > 2 ? true : false,
      message: lastMessage[0].content,
      messageType: lastMessage[0].messageType,
      new: false,
      userId: currentUser,
      name: conversationLeftInfo.conversation?.name ?? null,
      participants: participants
        .map((participantDetail) => participantDetail.userDetail[0].userId)
        .filter((item) => item !== currentUser),
      createdBy: conversationLeftInfo.conversation.createdBy.userId,
    };

    SocketService.emitToFilteredSocket(
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
      SocketService,
    } = client.data.tenantServices;

    const { participantId, conversationId } = data;

    const currentUser = SocketStore.getUserFromSocket(client.id);
    if (!currentUser) throw new WsException('Initiate socket connection');

    const participants =
      await ConversationParticipantService.getParticipantsUserDetails(
        conversationId,
      );
    if (!participants) throw new WsException('Invalid conversation');

    const removedConversationInfo =
      await ConversationsService.removeParticipant(
        conversationId,
        currentUser,
        participantId,
      );

    const lastMessage = await MessageService.getLastMessage(conversationId);

    const payload: SocketPayloads[SocketEvents.LOG_MESSAGE] = {
      conversationId: conversationId,
      createdAt: lastMessage[0].createdAt,
      group: participants.length > 2 ? true : false,
      message: lastMessage[0].content,
      messageType: lastMessage[0].messageType,
      new: false,
      userId: currentUser,
      name: removedConversationInfo.conversation?.name ?? null,
      participants: participants
        .map((participantDetail) => participantDetail.userDetail[0].userId)
        .filter((item) => item !== participantId),
      createdBy: removedConversationInfo.conversation?.createdBy.userId,
    };

    SocketService.emitToSocket(SocketEvents.LOG_MESSAGE, participants, payload);
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
      SocketService,
    } = client.data.tenantServices;

    const { name, conversationId } = data;

    const currentUser = SocketStore.getUserFromSocket(client.id);
    if (!currentUser) throw new WsException('Initiate socket connection');

    const participants =
      await ConversationParticipantService.getParticipantsUserDetails(
        conversationId,
      );

    if (!participants) throw new WsException('Invalid conversation');

    const renamedConversationInfo =
      await ConversationsService.renameConversation(
        conversationId,
        currentUser,
        name,
      );

    const lastMessage = await MessageService.getLastMessage(conversationId);

    const payload: SocketPayloads[SocketEvents.LOG_MESSAGE] = {
      conversationId: conversationId,
      createdAt: lastMessage[0].createdAt,
      group: participants.length > 2 ? true : false,
      message: lastMessage[0].content,
      messageType: lastMessage[0].messageType,
      new: false,
      userId: currentUser,
      name,
      participants: participants.map(
        (participantDetail) => participantDetail.userDetail[0].userId,
      ),
      createdBy: renamedConversationInfo.conversation?.createdBy?.userId,
    };

    SocketService.emitToSocket(SocketEvents.LOG_MESSAGE, participants, payload);
  }
}
