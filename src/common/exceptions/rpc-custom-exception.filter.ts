import { Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

@Catch(RpcException)
export class RpcCustomExceptionFilter implements ExceptionFilter<RpcException> {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const rpcError = exception.getError();

    if (
      typeof rpcError === 'object' &&
      'status' in rpcError &&
      'message' in rpcError
    ) {
      const { status, message } = rpcError;
      console.log({ status, message });
      const statusClean: number = isNaN(Number(status)) ? 400 : Number(status);
      console.log(statusClean);

      return response
        .status(statusClean)
        .json({ status: statusClean, message: message });
    }

    response.status(400).json({
      status: 400,
      message: rpcError,
    });
  }
}
