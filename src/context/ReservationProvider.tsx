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
import { findConflicts, vesselFitsBerth } from "../lib/scheduling";
import type { Berth, ImportReport, Reservation, ValidationIssue, Vessel } from "../types";

interface ReservationContextValue {
  reservations: Reservation[];
  berths: Berth[];
  vessels: Vessel[];
  importedIssues: ValidationIssue[];
  report: ImportReport;
  saveReservation: (reservation: Reservation) => void;
  deleteReservation: (id: string) => void;
  reset: () => void;
}

const ReservationContext = createContext<ReservationContextValue | null>(null);

export function ReservationProvider({ children }: { children: ReactNode }) {
  const repository = useRef(new LocalStorageReservationRepository());
  const [reservations, setReservations] = useState(() => repository.current.list());
  const berths = berthsData as Berth[];
  const vessels = vesselsData as Vessel[];

  const persist = useCallback((next: Reservation[]) => {
    setReservations(next);
    repository.current.save(next);
  }, []);

  const saveReservation = useCallback(
    (reservation: Reservation) => {
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
    () => ({ reservations, berths, vessels, importedIssues: issuesData as ValidationIssue[], report: reportData as ImportReport, saveReservation, deleteReservation, reset }),
    [reservations, saveReservation, deleteReservation, reset],
  );

  return <ReservationContext.Provider value={value}>{children}</ReservationContext.Provider>;
}

export const useReservations = () => {
  const context = useContext(ReservationContext);
  if (!context) throw new Error("useReservations must be used within ReservationProvider");
  return context;
};
