import {
  Controller,
  NotImplementedException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { OrderService } from './order.service';
import {
  ChangeOrderStatusDto,
  CreateOrderDto,
  OrderPaginationDto,
  PaidOrderDto,
} from './dto';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @MessagePattern('createOrder')
  async create(@Payload() createOrderDto: CreateOrderDto) {
    const order = await this.orderService.create(createOrderDto);
    const paymentSession = await this.orderService.createPaymentSession(order);

    return { order, paymentSession };
  }

  @MessagePattern('findAllOrder')
  findAll(@Payload() orderPaginationDto: OrderPaginationDto) {
    return this.orderService.findAll(orderPaginationDto);
  }

  @MessagePattern('findOneOrder')
  findOne(@Payload('id', ParseUUIDPipe) id: string) {
    return this.orderService.findOne(id);
  }

  @MessagePattern('changeOrderStatus')
  changeOrderStatus(@Payload() changeOrderStatusDto: ChangeOrderStatusDto) {
    return this.orderService.changeOrderStatus(changeOrderStatusDto);
  }

  @EventPattern('payment.succeeded')
  paidOrder(@Payload() paidOrderDto: PaidOrderDto) {
    return this.orderService.paidOrder(paidOrderDto);
  }
}
