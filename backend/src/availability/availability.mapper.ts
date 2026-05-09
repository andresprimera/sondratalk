import { type Availability, type Day, type Period } from './dto';
import { AvailabilityDocument } from './schemas/availability.schema';

export function toAvailability(
  doc: AvailabilityDocument | null,
): Availability {
  if (!doc) return { windows: [], isAvailableNow: false };
  return {
    windows: doc.windows.map((w) => ({
      // eslint-disable-next-line no-restricted-syntax -- Mongoose enum string → typed Period
      period: w.period as Period,
      // eslint-disable-next-line no-restricted-syntax -- Mongoose enum string → typed Day
      day: w.day as Day,
    })),
    isAvailableNow: doc.isAvailableNow,
  };
}
