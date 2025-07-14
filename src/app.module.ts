import { Module } from '@nestjs/common';
import { OrderModule } from './order/order.module';
import { NatsModule } from './transports/nats.module';

@Module({
  imports: [OrderModule, NatsModule],
})
export class AppModule {}
