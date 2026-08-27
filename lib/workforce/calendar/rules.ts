export type PublishedRevision = {
  shiftId: string;
  publicationPublishedAt: Date;
  revisionNumber: number;
  revisionStatus: "DRAFT" | "PUBLISHED" | "CANCELLED";
  businessDate: Date;
  startAt: Date;
  endAt: Date;
  branchName: string;
  branchTimezone: string | null;
};

export function latestPublishedRevisions(rows: PublishedRevision[]) {
  const latest = new Map<string, PublishedRevision>();
  for (const row of [...rows].sort((a,b)=>b.publicationPublishedAt.getTime()-a.publicationPublishedAt.getTime() || b.revisionNumber-a.revisionNumber)) if (!latest.has(row.shiftId)) latest.set(row.shiftId,row);
  return [...latest.values()].sort((a,b)=>a.startAt.getTime()-b.startAt.getTime());
}

export function calendarStatus(row: Pick<PublishedRevision,"revisionStatus"|"revisionNumber">) {
  return row.revisionStatus === "CANCELLED" ? "CANCELLED" as const : row.revisionNumber > 1 ? "CHANGED" as const : "NEW" as const;
}

export function staysOnBusinessDate(row: Pick<PublishedRevision,"businessDate">) { return row.businessDate.toISOString().slice(0,10); }
