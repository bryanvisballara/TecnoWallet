import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UnitClient } from './unit-client';
import { UnitIdentity, type UnitIdentityStatus } from './unit.schemas';

type CreateIndividualApplicationInput = {
  userId: string;
  email: string;
  fullName: string;
  phone?: string;
  ssn?: string;
  dateOfBirth?: string;
  address?: {
    street: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
};

@Injectable()
export class UnitCustomerService {
  constructor(
    private readonly unit: UnitClient,
    @InjectModel(UnitIdentity.name)
    private readonly identities: Model<UnitIdentity>,
  ) {}

  async getByUserId(userId: string) {
    return this.identities.findOne({ userId });
  }

  async upsertIdentity(userId: string, patch: Partial<UnitIdentity>) {
    return this.identities.findOneAndUpdate(
      { userId },
      { $set: patch },
      { upsert: true, new: true },
    );
  }

  /**
   * Creates an individual Application in Unit Sandbox.
   * In sandbox, minimal attributes may be accepted depending on org config.
   */
  async createIndividualApplication(input: CreateIndividualApplicationInput) {
    const existing = await this.getByUserId(input.userId);
    if (existing?.unitCustomerId && existing.status === 'approved') {
      return existing;
    }
    if (!this.unit.configured) {
      // Dev/test stub when Unit token is absent.
      return this.upsertIdentity(input.userId, {
        status: 'approved',
        unitApplicationId: `sandbox-app-${input.userId}`,
        unitCustomerId: `sandbox-customer-${input.userId}`,
      });
    }

    const [firstName, ...rest] = input.fullName.trim().split(/\s+/);
    const lastName = rest.join(' ') || firstName;
    const address = input.address ?? {
      street: '20 Ingram St',
      city: 'Forest Hills',
      state: 'NY',
      postalCode: '11375',
      country: 'US',
    };

    const doc = await this.unit.post(
      '/applications',
      {
        data: {
          type: 'individualApplication',
          attributes: {
            ssn: input.ssn ?? '000000000',
            fullName: { first: firstName, last: lastName },
            dateOfBirth: input.dateOfBirth ?? '1990-01-01',
            address,
            email: input.email,
            phone: {
              countryCode: '1',
              number: (input.phone ?? '5555550100').replace(/\D/g, ''),
            },
            // Required by Unit org KYC settings (sandbox WW TECNO).
            occupation: 'ArchitectOrEngineer',
            annualIncome: 'Between10kAnd25k',
            sourceOfIncome: 'EmploymentOrPayrollIncome',
            tags: {
              tecnowalletUserId: input.userId,
            },
          },
        },
      },
      `app-${input.userId}`,
    );
    const resource = this.unit.single(doc);
    const attrs = resource.attributes ?? {};
    const status = mapApplicationStatus(String(attrs.status ?? 'Pending'));
    const customerRel = (
      resource.relationships as
        | { customer?: { data?: { id?: string } } }
        | undefined
    )?.customer?.data?.id;

    return this.upsertIdentity(input.userId, {
      unitApplicationId: resource.id,
      unitCustomerId: customerRel,
      status,
    });
  }

  async markCustomerCreated(applicationId: string, customerId: string) {
    const identity = await this.identities.findOne({
      unitApplicationId: applicationId,
    });
    if (!identity) return null;
    identity.unitCustomerId = customerId;
    identity.status = 'approved';
    await identity.save();
    return identity;
  }

  async requireApprovedCustomerId(userId: string): Promise<string> {
    const identity = await this.getByUserId(userId);
    if (!identity?.unitCustomerId || identity.status !== 'approved') {
      throw new BadRequestException(
        'Complete Unit onboarding before funding operations',
      );
    }
    return identity.unitCustomerId;
  }
}

function mapApplicationStatus(status: string): UnitIdentityStatus {
  switch (status) {
    case 'Approved':
      return 'approved';
    case 'Denied':
      return 'denied';
    case 'Canceled':
      return 'canceled';
    case 'AwaitingDocuments':
      return 'awaitingDocuments';
    case 'Pending':
    case 'PendingReview':
      return 'pending';
    default:
      return 'pending';
  }
}

export function assertUnitConfiguredOrStub(
  configured: boolean,
  message: string,
) {
  if (!configured) {
    throw new ServiceUnavailableException(message);
  }
}
