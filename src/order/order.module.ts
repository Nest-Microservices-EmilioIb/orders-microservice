import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { envs } from '../config/envs';
import { PRODUCT_SERVICE } from 'src/config';
import { env } from 'process';

@Module({
  controllers: [OrderController],
  providers: [OrderService],
  imports: [
    ClientsModule.register([
      {
        name: PRODUCT_SERVICE,
        transport: Transport.TCP,
        options: {
          host: envs.productsMicroserviceHost,
          port: envs.productsMicroservicePort,
        },
      },
    ]),
  ],
})
export class OrderModule {}
