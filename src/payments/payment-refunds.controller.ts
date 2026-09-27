import {
  Body,
  Controller,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { PaymentRefundService } from './payment-refund.service';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import {
  RefundOrderDto,
  RefundOrderParamDto,
} from './shared/dto/refund-order.dto';

@Controller('payments')
export class PaymentRefundsController {
  constructor(private readonly paymentRefundService: PaymentRefundService) {}

  /* ================================================ */
  /*  REFUND ORDER - Admin (REFUND_ORDER)              */
  /* ================================================ */
  @Post('orders/:orderId/refund')
  @RequirePermission(Permissions.REFUND_ORDER)
  @UseGuards(AuthGuard, PermissionsGuard)
  refundOrder(
    @Param() { orderId }: RefundOrderParamDto,
    @Body() body: RefundOrderDto,
    @Request() req: { user: JwtPayload },
  ) {
    return this.paymentRefundService.refundOrder(orderId, body, {
      id: req.user.user_id,
      email: req.user.email,
    });
  }
}
