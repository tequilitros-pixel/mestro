export type MigrationClassification =
  | "SAFE_AUTO_MIGRATION"
  | "AUTO_MIGRATION_WITH_NULL_UNKNOWN"
  | "REQUIRES_REVIEW"
  | "ARCHIVE_ONLY"
  | "DO_NOT_MIGRATE";

export type DataQualityCategory =
  | "DERIVABLE"
  | "MISSING_DATA"
  | "AMBIGUOUS_DATA"
  | "CONFLICTING_DATA"
  | "SAFE_TO_MIGRATE"
  | "MANUAL_REVIEW_REQUIRED"
  | "UNRECOVERABLE_HISTORICAL_DETAIL";

export type BridgeIssue = {
  category: DataQualityCategory;
  field: string;
  detail: string;
};

export type BridgeResult<T> = {
  candidate: T | null;
  classification: MigrationClassification;
  issues: BridgeIssue[];
};

export type DifferenceCategory =
  | "EXPECTED"
  | "LEGACY_LIMITATION"
  | "NEW_MODEL_BUG"
  | "MAPPING_BUG"
  | "POLICY_DIFFERENCE"
  | "UNKNOWN";
