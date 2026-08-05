import { getMyScheduleForWeeks } from "@/app/actions/schedule";
import { getMyOpenShift } from "@/app/actions/timeclock";
import CalendarView from "./CalendarView";

export default async function CalendarPage() {
  const [result, openShift] = await Promise.all([
    getMyScheduleForWeeks(3),
    getMyOpenShift(),
  ]);

  const shifts = "success" in result && result.success ? result.shifts : [];

  const serializedShifts = shifts.map((shift) => ({
    id: shift.id,
    date: new Date(shift.date).toISOString(),
    startTime: shift.startTime,
    endTime: shift.endTime,
    notes: shift.notes,
    branch: shift.branch,
  }));

  const serializedOpenShift = openShift
    ? {
        id: openShift.id,
        clockIn: openShift.clockIn.toISOString(),
        branch: openShift.branch,
      }
    : null;

  return (
    <CalendarView
      shifts={serializedShifts}
      openShift={serializedOpenShift}
    />
  );
}
