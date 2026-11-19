import { z } from 'zod';
export const CURRENCY_CODES = [
  'USD',
  'EUR',
  'GBP',
  'NZD',
  'AUD',
  'CAD',
  'CHF',
  'JPY',
  'CNY',
  'HKD',
  'SGD',
  'INR',
  'AED',
  'SAR',
  'QAR',
  'KWD',
  'BHD',
  'OMR',
  'ZAR',
  'KRW',
  'MYR',
  'THB',
  'IDR',
  'PHP',
  'VND',
  'PKR',
  'BDT',
  'NPR',
  'LKR',
  'TRY',
] as const;
export const pairSchema = z
  .string()
  .regex(/^[A-Z]{3}\/[A-Z]{3}$/)
  .refine((pair) => {
    const [base, quote] = pair.split('/');
    return (
      base !== quote &&
      CURRENCY_CODES.some((c) => c === base) &&
      CURRENCY_CODES.some((c) => c === quote)
    );
  }, 'Choose two different supported currencies');
export const PAIRS = [
  'NZD/INR',
  'AUD/INR',
  'USD/INR',
  'NZD/USD',
  'USD/NZD',
  'GBP/INR',
  'EUR/INR',
  'CAD/INR',
] as const;
export const alertSchema = z
  .object({
    pair: pairSchema,
    targetRate: z.number().finite().positive().max(1000000),
    condition: z.enum(['gte', 'lte']),
    immediate: z.boolean().default(false),
    channel: z.enum(['email', 'push']).optional(),
    rateSource: z.enum(['daily', 'intraday']).optional(),
  })
  .strict();
export type AlertInput = z.infer<typeof alertSchema>;
export const transferPlanSchema = z
  .object({
    pair: pairSchema,
    amount: z.number().positive().max(1e12),
    targetRate: z.number().positive().max(1e6),
    alertId: z
      .string()
      .regex(/^[\w-]{1,128}$/)
      .nullable(),
  })
  .strict();
export type TransferPlanInput = z.infer<typeof transferPlanSchema>;
export type TransferPlan = TransferPlanInput & { id: string; updatedAt: number };
export type Alert = AlertInput & {
  id: string;
  userId: string;
  baseCurrency: string;
  quoteCurrency: string;
  status: 'active' | 'paused' | 'processing' | 'completed';
  generation: number;
  createdAt: number;
  updatedAt: number;
  triggeredAt?: number;
  triggeredRate?: number;
  observation?: Rate;
  notificationStatus?: string;
};
export type Rate = {
  kind?: 'intraday';
  currencyPair: string;
  rate: number;
  provider: string;
  providerTimestamp: string;
  fetchedAt: number;
};
export type Notice = {
  id: string;
  alertId?: string;
  notificationType?: 'digest' | 'email' | 'push';
  status: string;
  attempts: number;
  createdAt: number;
  sentAt?: number;
  errorMessage?: string;
};
export const matches = (rate: number, target: number, condition: 'gte' | 'lte') =>
  condition === 'gte' ? rate >= target : rate <= target;
export const fresh = (r: Rate, now = Date.now()) =>
  r.fetchedAt <= now &&
  Date.parse(r.providerTimestamp) <= now &&
  (r.kind === 'intraday'
    ? now - r.fetchedAt < 45 * 60000 && now - Date.parse(r.providerTimestamp) < 65 * 60000
    : now - r.fetchedAt < 20 * 60000 && now - Date.parse(r.providerTimestamp) < 5 * 86400000);
