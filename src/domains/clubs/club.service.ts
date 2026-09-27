import { findCourts } from './club.repository'
import { findAvailableSlots } from '../reservations/reservation.repository'

export interface ClubAvailabilityCourt {
  court_id: string
  name: string
  surface: string
  is_indoor: boolean
  price_per_hour: number
}

export interface ClubAvailabilitySlot {
  start_time: string
  end_time: string
  min_price: number
  courts: ClubAvailabilityCourt[]
}

// Combines every active court's own slot availability (findAvailableSlots,
// unchanged — this never duplicates that logic) into one per-club view, so
// the client can show "what times are free" before "which court", with a
// starting price per time slot. Exact price only appears once a court is
// picked from a slot's own `courts` list.
export async function getClubAvailability(
  clubId: string,
  date: string,
): Promise<ClubAvailabilitySlot[]> {
  const courts = await findCourts(clubId)

  const slotsByRange = new Map<string, ClubAvailabilitySlot>()

  for (const court of courts) {
    const slots = await findAvailableSlots(court.id, date)

    for (const slot of slots) {
      if (!slot.available) continue

      const key = `${slot.start_time}|${slot.end_time}`
      const existing = slotsByRange.get(key)
      const courtEntry: ClubAvailabilityCourt = {
        court_id: court.id,
        name: court.name,
        surface: court.surface,
        is_indoor: court.is_indoor,
        price_per_hour: court.price_per_hour,
      }

      if (existing) {
        existing.courts.push(courtEntry)
        existing.min_price = Math.min(existing.min_price, court.price_per_hour)
      } else {
        slotsByRange.set(key, {
          start_time: slot.start_time,
          end_time: slot.end_time,
          min_price: court.price_per_hour,
          courts: [courtEntry],
        })
      }
    }
  }

  return Array.from(slotsByRange.values()).sort((a, b) => a.start_time.localeCompare(b.start_time))
}
