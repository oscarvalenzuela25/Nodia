import { Module } from '@nestjs/common';
import { RentalPropertyModule } from '../rental-property/rental-property.module.js';
import { RentalCollaboratorModule } from '../rental-collaborator/rental-collaborator.module.js';
import { RentalCancellationPolicyModule } from '../rental-cancellation-policy/rental-cancellation-policy.module.js';
import { RentalReservationModule } from '../rental-reservation/rental-reservation.module.js';
import { RentalPaymentModule } from '../rental-payment/rental-payment.module.js';
import { RentalExpenseModule } from '../rental-expense/rental-expense.module.js';
import { RentalBlockModule } from '../rental-block/rental-block.module.js';
import { RentalTurnoverModule } from '../rental-turnover/rental-turnover.module.js';
import { RentalCalendarModule } from '../rental-calendar/rental-calendar.module.js';
import { RentalOverviewModule } from '../rental-overview/rental-overview.module.js';
@Module({
  imports: [
    RentalPropertyModule,
    RentalCollaboratorModule,
    RentalCancellationPolicyModule,
    RentalReservationModule,
    RentalPaymentModule,
    RentalExpenseModule,
    RentalBlockModule,
    RentalTurnoverModule,
    RentalCalendarModule,
    RentalOverviewModule,
  ],
  exports: [
    RentalPropertyModule,
    RentalCollaboratorModule,
    RentalCancellationPolicyModule,
    RentalReservationModule,
    RentalPaymentModule,
    RentalExpenseModule,
    RentalBlockModule,
    RentalTurnoverModule,
    RentalCalendarModule,
    RentalOverviewModule,
  ],
})
export class RentalModule {}
