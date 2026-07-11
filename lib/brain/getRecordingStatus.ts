import { getActiveProcesses } from "./data/getActiveProcesses";

export type RecordingStatus = {
  id: string;
  label: string;
  lastRecordedAt: Date;
  minutesSinceLastRecord: number;
  isOverdue: boolean;
};

const HOURLY_LIMIT_MINUTES = 60;

function minutesSince(date: Date) {
  return (Date.now() - date.getTime()) / (1000 * 60);
}

export async function getRecordingStatus() {
  const { cookings, fermentations } = await getActiveProcesses();

  const cooking: RecordingStatus[] = cookings.map((c) => {
    const last = c.events[0]?.createdAt ?? c.startedAt;
    const minutes = minutesSince(last);
    return {
      id: c.id,
      label: c.equipment.name,
      lastRecordedAt: last,
      minutesSinceLastRecord: minutes,
      isOverdue: minutes > HOURLY_LIMIT_MINUTES,
    };
  });

  const fermentation: RecordingStatus[] = fermentations.map((f) => {
    const last = f.readings[0]?.createdAt ?? f.startedAt;
    const minutes = minutesSince(last);
    return {
      id: f.id,
      label: f.tank,
      lastRecordedAt: last,
      minutesSinceLastRecord: minutes,
      isOverdue: minutes > HOURLY_LIMIT_MINUTES,
    };
  });

  return { cooking, fermentation };
}
