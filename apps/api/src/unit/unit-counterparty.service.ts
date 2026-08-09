import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UnitClient } from './unit-client';
import { UnitCounterparty } from './unit.schemas';

@Injectable()
export class UnitCounterpartyService {
  constructor(
    private readonly unit: UnitClient,
    @InjectModel(UnitCounterparty.name)
    private readonly counterparties: Model<UnitCounterparty>,
  ) {}

  listForUser(userId: string) {
    return this.counterparties.find({ userId, active: true }).sort({
      createdAt: -1,
    });
  }

  async getActive(userId: string, unitCounterpartyId?: string) {
    if (unitCounterpartyId) {
      return this.counterparties.findOne({
        userId,
        unitCounterpartyId,
        active: true,
      });
    }
    return this.counterparties.findOne({ userId, active: true }).sort({
      createdAt: -1,
    });
  }

  /**
   * Creates a Unit counterparty from Plaid processor token (preferred)
   * or sandbox routing/account numbers.
   */
  async createForUser(input: {
    userId: string;
    unitCustomerId: string;
    name: string;
    processorToken?: string;
    routingNumber?: string;
    accountNumber?: string;
    accountType?: 'Checking' | 'Savings';
    verifyName?: boolean;
  }) {
    if (!this.unit.configured) {
      const stubId = `sandbox-cp-${input.userId}-${Date.now()}`;
      return this.counterparties.create({
        userId: input.userId,
        unitCounterpartyId: stubId,
        name: input.name,
        bank: 'Sandbox Bank',
        accountType: input.accountType ?? 'Checking',
        accountNumberMask: '0001',
        routingNumberMask: '0114',
        verificationMethod: input.processorToken ? 'Plaid' : 'Manual',
        active: true,
      });
    }

    // Unit requires `type` (Person|Business|Unknown). Omit permissions so Unit
    // applies its default; CreditAndDebit is only allowed for Unit-org accounts.
    const attributes: Record<string, unknown> = {
      name: input.name.trim().slice(0, 50),
      type: 'Person',
      tags: { tecnowalletUserId: input.userId },
    };
    if (input.processorToken) {
      attributes.plaidProcessorToken = input.processorToken;
      attributes.verifyName = input.verifyName ?? true;
    } else {
      attributes.routingNumber = input.routingNumber;
      attributes.accountNumber = input.accountNumber;
      attributes.accountType = input.accountType ?? 'Checking';
    }

    const doc = await this.unit.post(
      '/counterparties',
      {
        data: {
          type: 'achCounterparty',
          attributes,
          relationships: {
            customer: {
              data: { type: 'customer', id: input.unitCustomerId },
            },
          },
        },
      },
      `cp-${input.userId}-${Date.now()}`,
    );
    const resource = this.unit.single(doc);
    const attrs = resource.attributes ?? {};
    return this.counterparties.create({
      userId: input.userId,
      unitCounterpartyId: resource.id,
      name: String(attrs.name ?? input.name),
      bank: typeof attrs.bank === 'string' ? attrs.bank : undefined,
      accountType:
        typeof attrs.accountType === 'string' ? attrs.accountType : undefined,
      accountNumberMask:
        typeof attrs.accountNumber === 'string'
          ? String(attrs.accountNumber).slice(-4)
          : undefined,
      routingNumberMask:
        typeof attrs.routingNumber === 'string'
          ? String(attrs.routingNumber).slice(-4)
          : undefined,
      verificationMethod: input.processorToken ? 'Plaid' : 'Manual',
      active: true,
    });
  }
}
