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

interface InitializeChat {
  userId: string;
}

interface CreateConversation {
  userId: string;
  participants: string[];
}

interface SendMessage {
  conversationId: string;
  message: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  temp: { convo1: string[] } = { convo1: [] };
  constructor(private readonly socketStore: SocketStore) {}

  handleDisconnect(@ConnectedSocket() client: Socket) {
    // Remove user from online pool
    console.log('disconnected', client.id);
    this.socketStore.remove(client.id);
  }

  @SubscribeMessage('init')
  init(
    @MessageBody() data: InitializeChat,
    @ConnectedSocket() client: Socket,
  ): any {
    console.log('connected', client.id, data.userId);
    this.socketStore.add(data.userId, client.id, client);
    // Add user to db
    return;
  }

  @SubscribeMessage('createConversation')
  createConversation(@MessageBody() data: CreateConversation): any {
    // Make conversation in db with participants[]
    this.temp['convo1'] = [data.userId, ...data.participants];
    console.log(this.temp);
    const conversation = 'convo1';
    // Send conversationId
    return {
      event: 'conversationInfo',
      data: { conversationId: conversation },
    };
  }

  @SubscribeMessage('sendMessage')
  sendMessage(
    @MessageBody() data: SendMessage,
    @ConnectedSocket() client: Socket,
  ) {
    // Add message to db

    // If the user is in online "notify" that user with message
    const participants = this.temp[`${data.conversationId}`];
    participants
      .map((participant: any) => this.socketStore.getFromUser(participant))
      .filter((socketParticipant) => socketParticipant.id !== client.id)
      .forEach((socket) => socket.emit('message', data.message));
  }

  // For Testing Purpose
  @SubscribeMessage('test')
  test(@MessageBody() data: number): any {
    const sock = this.socketStore.getAll();
    console.log('log', sock);
    return { event: 'notify', data: 'Your id' };
  }

  @SubscribeMessage('getOne')
  getOne(@MessageBody() data: number, @ConnectedSocket() client: Socket): any {
    // const sock = this.socketStore.get();
    // console.log('log', sock);
    return { event: 'notify', data: 'Your id' };
  }
}
