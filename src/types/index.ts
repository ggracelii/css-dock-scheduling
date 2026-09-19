export type ReservationType = "vessel" | "event" | "closure";
export type ImportConfidence = "high" | "medium" | "low";

export interface SourceReference {
  sheet: string;
  cell?: string;
  range?: string;
  rawValue: string;
}

export interface Berth {
  id: string;
  name: string;
  maxVesselLengthFt: number | null;
  category?: string;
  sourceLabels: string[];
}

export interface VesselDimensionSource {
  valueFt: number;
  source: "name" | "loa-field" | "manual";
  sourceReference?: SourceReference;
}

export interface VesselContact {
  id: string;
  type: "email" | "phone";
  value: string;
}

export interface Vessel {
  id: string;
  name: string;
  lengthFt: number | null;
  lengthSources: VesselDimensionSource[];
  aliases: string[];
  operator?: string;
  contacts?: VesselContact[];
  notes?: string[];
}

export interface Reservation {
  id: string;
  type: ReservationType;
  title: string;
  vesselId?: string;
  berthId: string;
  startDate: string;
  endDate: string;
  notes?: string[];
  source?: SourceReference;
  importConfidence?: ImportConfidence;
  origin: "imported" | "created";
  modifiedSinceImport?: boolean;
  status?: "confirmed" | "tentative";
}

export type ValidationIssueType =
  | "BERTH_CONFLICT"
  | "VESSEL_TOO_LONG"
  | "MISSING_DATA"
  | "INVALID_DATE_RANGE"
  | "UNKNOWN_VESSEL_LENGTH"
  | "VESSEL_LENGTH_CONFLICT"
  | "UNMATCHED_VESSEL"
  | "AMBIGUOUS_ENTRY"
  | "SUMMARY_MISMATCH";

export interface ValidationIssue {
  id: string;
  category: "schedule" | "capacity" | "import" | "reference-data";
  type: ValidationIssueType;
  severity: "info" | "warning" | "error";
  message: string;
  reservationIds?: string[];
  vesselId?: string;
  berthId?: string;
  sourceReferences?: SourceReference[];
  year?: number;
  confidence?: ImportConfidence;
}

export interface ImportReport {
  sourceFile: string;
  scheduleYears: { first: number; last: number };
  annualSheetsParsed: number;
  reservationCount: number;
  vesselCount: number;
  berthCount: number;
  annotationCount: number;
  typeCounts: Record<ReservationType, number>;
  confidenceCounts: Record<ImportConfidence, number>;
  issueCounts: Record<string, number>;
  summaryComparisons: Array<{
    resource: string;
    year: number;
    parsedDays: number;
    legacyDays: number;
    difference: number;
    exact: boolean;
  }>;
  generatedAt: string;
  assumptions: string[];
}

export interface Annotation {
  id: string;
  text: string;
  source: SourceReference;
  confidence: ImportConfidence;
}
