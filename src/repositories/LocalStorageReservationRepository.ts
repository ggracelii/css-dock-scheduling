import seedReservations from "../data/generated/reservations.json";
import type { Reservation } from "../types";

const STORAGE_KEY = "whoi-dock-manager.reservations.v1";

export class LocalStorageReservationRepository {
  list(): Reservation[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Reservation[]) : (seedReservations as Reservation[]);
    } catch {
      return seedReservations as Reservation[];
    }
  }

  save(reservations: Reservation[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
  }

  reset(): Reservation[] {
    localStorage.removeItem(STORAGE_KEY);
    return seedReservations as Reservation[];
  }
}
