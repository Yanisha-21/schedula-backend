import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // ← ADD THIS
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/', (req, res) => {
    res.json({ message: 'Schedula Backend API is running 🚀', status: 'OK' });
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
}
bootstrap();