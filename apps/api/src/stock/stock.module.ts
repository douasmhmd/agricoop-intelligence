import { Module } from '@nestjs/common';
import { LotsController, StockController } from './lots.controller';
import { LotsService } from './lots.service';

@Module({
  controllers: [LotsController, StockController],
  providers: [LotsService],
  exports: [LotsService],
})
export class StockModule {}
