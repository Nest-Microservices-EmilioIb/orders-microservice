import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaClient } from '@prisma/client';
import { RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';

@Injectable()
export class OrderService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('OrdersService');

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  create(createOrderDto: CreateOrderDto) {
    return this.order.create({ data: createOrderDto });
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const { status, limit, page } = orderPaginationDto;

    const totalRows = await this.order.count({
      where: {
        status,
      },
    });

    const data = await this.order.findMany({
      skip: (page! - 1) * limit!,
      take: limit,
      where: {
        status,
      },
    });

    return {
      data: data,
      meta: {
        total: totalRows,
        page: page,
        lastPage: Math.ceil(totalRows / limit!),
      },
    };
  }

  async findOne(id: string) {
    const order = await this.order.findFirst({ where: { id } });

    if (!order)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order with id ${id} not found`,
      });

    return order;
  }

  async changeOrderStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;

    const order = await this.findOne(id);

    if (status === order.status) return order;

    return await this.order.update({
      where: { id },
      data: { status },
    });
  }
}
