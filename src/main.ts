import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';  // ← add this

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,   // ← converts query string page/limit to numbers
      whitelist: true,   // ← strips unknown fields
    }),
  );

  await app.listen(3001);  // ← kept your port 3001
}
bootstrap();