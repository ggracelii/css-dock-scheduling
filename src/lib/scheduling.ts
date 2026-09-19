import type { Berth, Reservation, Vessel } from "../types";
import { datesOverlap } from "./dates";

export interface AssignmentAssessment {
  berth: Berth;
  available: boolean;
  fits: boolean | null;
  conflicts: Reservation[];
  vesselConflicts: Reservation[];
  spareFeet: number | null;
  recommended: boolean;
}

export const findConflicts = (
  reservations: Reservation[],
  candidate: Pick<Reservation, "berthId" | "startDate" | "endDate"> & {
    id?: string;
  },
) =>
  reservations.filter(
    (reservation) =>
      reservation.berthId === candidate.berthId &&
      reservation.id !== candidate.id &&
      datesOverlap(
        reservation.startDate,
        reservation.endDate,
        candidate.startDate,
        candidate.endDate,
      ),
  );

export const findVesselConflicts = (
  reservations: Reservation[],
  candidate: Pick<Reservation, "startDate" | "endDate"> & {
    id?: string;
    vesselId?: string;
  },
) => {
  if (!candidate.vesselId) return [];
  return reservations.filter(
    (reservation) =>
      reservation.type === "vessel" &&
      reservation.vesselId === candidate.vesselId &&
      reservation.id !== candidate.id &&
      datesOverlap(
        reservation.startDate,
        reservation.endDate,
        candidate.startDate,
        candidate.endDate,
      ),
  );
};

export const vesselFitsBerth = (vessel: Vessel | undefined, berth: Berth) => {
  if (!vessel || vessel.lengthFt === null || berth.maxVesselLengthFt === null)
    return null;
  return vessel.lengthFt <= berth.maxVesselLengthFt;
};

export const recommendBerths = (
  berths: Berth[],
  reservations: Reservation[],
  vessel: Vessel | undefined,
  startDate: string,
  endDate: string,
  editingId?: string,
): AssignmentAssessment[] => {
  const assessed = berths.map((berth) => {
    const conflicts = findConflicts(reservations, {
      id: editingId,
      berthId: berth.id,
      startDate,
      endDate,
    });
    const fits = vesselFitsBerth(vessel, berth);
    const vesselConflicts = findVesselConflicts(reservations, {
      id: editingId,
      vesselId: vessel?.id,
      startDate,
      endDate,
    });
    const spareFeet =
      vessel?.lengthFt != null && berth.maxVesselLengthFt != null
        ? berth.maxVesselLengthFt - vessel.lengthFt
        : null;
    return {
      berth,
      available: conflicts.length === 0 && vesselConflicts.length === 0,
      fits,
      conflicts,
      vesselConflicts,
      spareFeet,
      recommended: false,
    };
  });

  const best = assessed
    .filter((item) => item.available && item.fits !== false)
    .sort((a, b) => {
      if (a.fits === true && b.fits !== true) return -1;
      if (b.fits === true && a.fits !== true) return 1;
      return (a.spareFeet ?? Number.MAX_SAFE_INTEGER) -
        (b.spareFeet ?? Number.MAX_SAFE_INTEGER);
    })[0];
  if (best) best.recommended = true;
  return assessed;
};
