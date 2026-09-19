import seedReservations from "../data/generated/reservations.json";
import { recentReservations } from "../data/recentReservations";
import type { Reservation } from "../types";

const STORAGE_KEY = "whoi-dock-manager.reservations.v1";
const RECENT_SEED_VERSION_KEY = "whoi-dock-manager.recent-seed-version";
const RECENT_SEED_VERSION = "2026-09-expanded";
const completeSeed = [...(seedReservations as Reservation[]), ...recentReservations];

export class LocalStorageReservationRepository {
  list(): Reservation[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return completeSeed;
      const reservations = JSON.parse(stored) as Reservation[];
      if (localStorage.getItem(RECENT_SEED_VERSION_KEY) === RECENT_SEED_VERSION) return reservations;
      const existingIds = new Set(reservations.map((item) => item.id));
      const migrated = [...reservations, ...recentReservations.filter((item) => !existingIds.has(item.id))];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.setItem(RECENT_SEED_VERSION_KEY, RECENT_SEED_VERSION);
      return migrated;
    } catch {
      return completeSeed;
    }
  }

  save(reservations: Reservation[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
  }

  reset(): Reservation[] {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(RECENT_SEED_VERSION_KEY, RECENT_SEED_VERSION);
    return completeSeed;
  }
}
