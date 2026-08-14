import { Module } from '@nestjs/common';
import { BridgeClient } from './bridge-client';
import { RecaudoBridgeService } from './recaudo-bridge.service';

@Module({
  providers: [BridgeClient, RecaudoBridgeService],
  exports: [BridgeClient, RecaudoBridgeService],
})
export class BridgeModule {}
