import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/helpers/handlers/http-exception.filter';
import { GlobalLoggingInterceptor } from './common/interceptor/logger.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: '*',
  });

  const config = new DocumentBuilder()
    .setTitle('chat-app')
    .setDescription('This is a chat application for sociair')
    .setVersion('1.0')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  app.useGlobalInterceptors(new GlobalLoggingInterceptor());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
