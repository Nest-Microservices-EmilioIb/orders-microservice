import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { PrismaClient } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { NATS_SERVICE } from 'src/config';
import {
  CreateOrderDto,
  OrderPaginationDto,
  ChangeOrderStatusDto,
  PaidOrderDto,
} from './dto';
import { OrderWithProducts } from './interfaces/order-with-productt.interface';

@Injectable()
export class OrderService extends PrismaClient implements OnModuleInit {
  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {
    super();
  }

  private readonly logger = new Logger('OrdersService');

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      const productIds = createOrderDto.items.map((item) => item.productId);

      const products: any[] = await firstValueFrom(
        this.client.send({ cmd: 'validate_products' }, productIds),
      );

      let totalAmount = 0;
      let totalItems = 0;

      const productItemsInsert = createOrderDto.items.map((orderItem) => {
        const productDb = products.find(
          (product) => product.id === orderItem.productId,
        );

        orderItem.price = productDb.price;

        totalAmount += orderItem.price * orderItem.quantity;
        totalItems += orderItem.quantity;

        return {
          productId: orderItem.productId,
          price: orderItem.price,
          quantity: orderItem.quantity,
        };
      });

      const order = await this.order.create({
        data: {
          totalAmount: totalAmount,
          totalItems: totalItems,
          OrderItem: {
            createMany: {
              data: productItemsInsert,
            },
          },
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true,
            },
          },
        },
      });

      return {
        ...order,
        OrderItem: order.OrderItem.map((orderItem) => ({
          ...orderItem,
          name: products.find((product) => product.id === orderItem.productId)
            .name,
        })),
      };
    } catch (error) {
      throw new RpcException(error);
    }
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
    const order = await this.order.findFirst({
      where: { id },
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true,
          },
        },
      },
    });

    if (!order)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order with id ${id} not found`,
      });

    const productIds = order.OrderItem.map((orderItem) => orderItem.productId);

    const productsDb: any[] = await firstValueFrom(
      this.client.send({ cmd: 'validate_products' }, productIds),
    );

    return {
      ...order,
      OrderItem: order.OrderItem.map((orderItem) => ({
        ...orderItem,
        name: productsDb.find((product) => product.id === orderItem.productId)
          .name,
      })),
    };
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

  async createPaymentSession(order: OrderWithProducts) {
    const { cancel_url, success_url, url } = await firstValueFrom(
      this.client.send('create.payment.session', {
        orderId: order.id,
        currency: 'usd',
        items: order.OrderItem.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      }),
    );

    return { cancelUrl: cancel_url, successUrl: success_url, paymentUrl: url };
  }

  async paidOrder(paidOrderDto: PaidOrderDto) {
    const order = await this.order.update({
      where: { id: paidOrderDto.orderId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paid: true,
        stripeChargeId: paidOrderDto.stripePaymentId,

        // Relation
        OrderReceipt: {
          create: { receiptUrl: paidOrderDto.receiptUrl },
        },
      },
    });

    return order;
  }
}
