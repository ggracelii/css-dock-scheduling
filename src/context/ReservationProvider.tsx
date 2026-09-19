import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import berthsData from "../data/generated/berths.json";
import vesselsData from "../data/generated/vessels.json";
import issuesData from "../data/generated/validation-issues.json";
import reportData from "../data/generated/import-report.json";
import { LocalStorageReservationRepository } from "../repositories/LocalStorageReservationRepository";
import { findConflicts, findVesselConflicts, vesselFitsBerth } from "../lib/scheduling";
import { normalizeVessel } from "../lib/vessels";
import type { Berth, ImportReport, Reservation, ValidationIssue, Vessel } from "../types";

interface ReservationContextValue {
  reservations: Reservation[];
  berths: Berth[];
  vessels: Vessel[];
  importedIssues: ValidationIssue[];
  report: ImportReport;
  addVessel: (vessel: Vessel) => void;
  updateVessel: (vessel: Vessel) => void;
  updateBerth: (berth: Berth) => void;
  saveReservation: (reservation: Reservation) => void;
  deleteReservation: (id: string) => void;
  reset: () => void;
}

const ReservationContext = createContext<ReservationContextValue | null>(null);
const CUSTOM_VESSELS_KEY = "whoi-dock-manager.custom-vessels.v1";
const VESSELS_KEY = "whoi-dock-manager.vessels.v2";
const BERTHS_KEY = "whoi-dock-manager.berths.v1";

export function ReservationProvider({ children }: { children: ReactNode }) {
  const repository = useRef(new LocalStorageReservationRepository());
  const [reservations, setReservations] = useState(() => repository.current.list());
  const [berths, setBerths] = useState<Berth[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(BERTHS_KEY) ?? "null") ?? (berthsData as Berth[]);
    } catch {
      return berthsData as Berth[];
    }
  });
  const [vessels, setVessels] = useState<Vessel[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(VESSELS_KEY) ?? "null") as Vessel[] | null;
      if (stored) return stored.map(normalizeVessel);
      const custom = JSON.parse(localStorage.getItem(CUSTOM_VESSELS_KEY) ?? "[]") as Vessel[];
      return [...(vesselsData as Vessel[]), ...custom].map(normalizeVessel);
    } catch {
      return (vesselsData as Vessel[]).map(normalizeVessel);
    }
  });

  const addVessel = useCallback((vessel: Vessel) => {
    setVessels((current) => {
      const next = [...current, normalizeVessel(vessel)];
      localStorage.setItem(VESSELS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateVessel = useCallback((vessel: Vessel) => {
    setVessels((current) => {
      const next = current.map((item) => item.id === vessel.id ? normalizeVessel(vessel) : item);
      localStorage.setItem(VESSELS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateBerth = useCallback((berth: Berth) => {
    setBerths((current) => {
      const next = current.map((item) => item.id === berth.id ? berth : item);
      localStorage.setItem(BERTHS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const persist = useCallback((next: Reservation[]) => {
    setReservations(next);
    repository.current.save(next);
  }, []);

  const saveReservation = useCallback(
    (reservation: Reservation) => {
      if (findConflicts(reservations, reservation).length) throw new Error("The berth is already occupied during this date range.");
      if (reservation.type === "vessel" && findVesselConflicts(reservations, reservation).length) throw new Error("The vessel already has a booking during this date range.");
      persist([
        ...reservations.filter((item) => item.id !== reservation.id),
        reservation,
      ]);
    },
    [persist, reservations],
  );

  const deleteReservation = useCallback(
    (id: string) => persist(reservations.filter((item) => item.id !== id)),
    [persist, reservations],
  );

  const reset = useCallback(() => setReservations(repository.current.reset()), []);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool!(
        {
          name: "check_berth_availability",
          title: "Check berth availability",
          description: "Check whether a berth is free for an inclusive date range.",
          inputSchema: {
            type: "object",
            properties: {
              berthId: { type: "string" },
              startDate: { type: "string", format: "date" },
              endDate: { type: "string", format: "date" },
            },
            required: ["berthId", "startDate", "endDate"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute(input: unknown) {
            const value = input as { berthId?: string; startDate?: string; endDate?: string };
            if (!value.berthId || !value.startDate || !value.endDate || value.startDate > value.endDate)
              throw new Error("A berth and valid inclusive date range are required.");
            const conflicts = findConflicts(reservations, value as { berthId: string; startDate: string; endDate: string });
            return { available: conflicts.length === 0, conflicts: conflicts.map((item) => ({ id: item.id, title: item.title, startDate: item.startDate, endDate: item.endDate })) };
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool!(
        {
          name: "create_reservation",
          title: "Create dock reservation",
          description: "Create a conflict-free vessel, event, or closure reservation in Dock Manager.",
          inputSchema: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["vessel", "event", "closure"] },
              title: { type: "string" },
              vesselId: { type: "string" },
              berthId: { type: "string" },
              startDate: { type: "string", format: "date" },
              endDate: { type: "string", format: "date" },
            },
            required: ["type", "title", "berthId", "startDate", "endDate"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: unknown) {
            const value = input as Partial<Reservation>;
            if (!value.type || !value.title || !value.berthId || !value.startDate || !value.endDate || value.startDate > value.endDate)
              throw new Error("Type, title, berth, and a valid inclusive date range are required.");
            const berth = berths.find((item) => item.id === value.berthId);
            const vessel = vessels.find((item) => item.id === value.vesselId);
            if (!berth) throw new Error("Berth not found.");
            if (findConflicts(reservations, value as Reservation).length) throw new Error("The berth is already occupied during this date range.");
            if (value.type === "vessel" && findVesselConflicts(reservations, value as Reservation).length) throw new Error("The vessel already has a booking during this date range.");
            if (value.type === "vessel" && vesselFitsBerth(vessel, berth) === false) throw new Error("The selected vessel is too long for this berth.");
            const created: Reservation = { id: `created-${crypto.randomUUID()}`, type: value.type, title: value.title, vesselId: value.vesselId, berthId: value.berthId, startDate: value.startDate, endDate: value.endDate, origin: "created", status: "confirmed" };
            saveReservation(created);
            return { id: created.id, status: "confirmed" };
          },
        },
        { signal: lifecycle.signal },
      );
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [berths, reservations, saveReservation, vessels]);

  const value = useMemo<ReservationContextValue>(
    () => ({ reservations, berths, vessels, importedIssues: issuesData as ValidationIssue[], report: reportData as ImportReport, addVessel, updateVessel, updateBerth, saveReservation, deleteReservation, reset }),
    [reservations, berths, vessels, addVessel, updateVessel, updateBerth, saveReservation, deleteReservation, reset],
  );

  return <ReservationContext.Provider value={value}>{children}</ReservationContext.Provider>;
}

export const useReservations = () => {
  const context = useContext(ReservationContext);
  if (!context) throw new Error("useReservations must be used within ReservationProvider");
  return context;
};
