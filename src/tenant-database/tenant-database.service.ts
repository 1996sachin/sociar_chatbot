import { Injectable } from '@nestjs/common';
import { ContextId, ContextIdFactory, ModuleRef } from '@nestjs/core';
import { Connection } from 'mongoose';
import { ConversationParticipantService } from 'src/conversation-participant/conversation-participant.service';
import { ConversationsService } from 'src/conversations/conversations.service';
import {
  Message,
  MessageDocument,
  MessageSchema,
} from 'src/messages/entities/message.entity';
import { MessageService } from 'src/messages/messages.service';
import { User, UserDocument, UserSchema } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';

@Injectable()
@Injectable()
export class TenantServiceFactory {
  private serviceCache = new Map<
    string,
    {
      usersService: UsersService;
      messageService: MessageService;
      // etc…
    }
  >();
  constructor(private readonly moduleRef: ModuleRef) {}

  async getServicesForTenant(tenantId: string) {
    // if (this.serviceCache.has(tenantId)) {
    //   return this.serviceCache.get(tenantId);
    // }

    const contextId = ContextIdFactory.create();
    this.moduleRef.registerRequestByContextId({ tenantId }, contextId);
    const userService = await this.moduleRef.resolve(UsersService, contextId, {
      strict: false,
    });

    const services = { userService };
    // this.serviceCache.set(tenantId, services);
    return services;
  }
}
