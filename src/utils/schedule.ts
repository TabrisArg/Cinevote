import { RepeatingSchedule } from "../types";

/**
 * Validates if the selected start date falls on one of the chosen days of the week.
 */
export function validateStartDate(startDateStr: string, selectedDays: number[]): boolean {
  if (!startDateStr || !selectedDays || selectedDays.length === 0) return false;
  const datePart = startDateStr.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  return selectedDays.includes(dayOfWeek);
}

/**
 * Calculates the next `limit` upcoming occurrences for a repeating viewing schedule.
 */
export function calculateUpcomingOccurrences(schedule: RepeatingSchedule, limit: number = 3): Date[] {
  const { selectedDays, frequencyValue, frequencyUnit, startDate } = schedule;
  if (!selectedDays || selectedDays.length === 0 || !startDate) return [];

  const datePart = startDate.split("T")[0];
  const [sYear, sMonth, sDay] = datePart.split("-").map(Number);
  const startLocal = new Date(sYear, sMonth - 1, sDay);
  
  // Parse hours and minutes from starting date if present to preserve exact time
  let hours = 0;
  let minutes = 0;
  if (startDate.includes("T")) {
    const timePart = startDate.split("T")[1];
    const [h, m] = timePart.split(":").map(Number);
    if (!isNaN(h)) hours = h;
    if (!isNaN(m)) minutes = m;
  }
  startLocal.setHours(hours, minutes, 0, 0);

  const now = new Date();
  const occurrences: Date[] = [];
  let current = new Date(startLocal);

  // We want to loop forward day by day.
  // To avoid infinite loops, we cap the number of evaluated days to 2000.
  let daysEvaluated = 0;
  while (occurrences.length < limit && daysEvaluated < 2000) {
    const dayOfWeek = current.getDay();
    
    // Check if the current day is one of the selected days
    if (selectedDays.includes(dayOfWeek)) {
      // Now check frequency match relative to the start date
      let isMatch = false;
      
      if (frequencyUnit === "weeks") {
        const msDiff = current.getTime() - startLocal.getTime();
        const daysDiff = Math.round(msDiff / (1000 * 60 * 60 * 24));
        const weeksDiff = Math.floor(daysDiff / 7);
        if (weeksDiff % frequencyValue === 0) {
          isMatch = true;
        }
      } else if (frequencyUnit === "months") {
        const monthsDiff = (current.getFullYear() - startLocal.getFullYear()) * 12 + (current.getMonth() - startLocal.getMonth());
        if (monthsDiff % frequencyValue === 0) {
          isMatch = true;
        }
      } else if (frequencyUnit === "years") {
        const yearsDiff = current.getFullYear() - startLocal.getFullYear();
        if (yearsDiff % frequencyValue === 0) {
          isMatch = true;
        }
      }

      if (isMatch && current.getTime() > now.getTime()) {
        occurrences.push(new Date(current));
      }
    }
    
    current.setDate(current.getDate() + 1);
    daysEvaluated++;
  }

  return occurrences;
}

/**
 * Formats a RepeatingSchedule into a human-readable description.
 */
export function formatRepeatingSchedule(schedule: RepeatingSchedule): string {
  const { selectedDays, frequencyValue, frequencyUnit } = schedule;
  const daysNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const sortedDays = [...selectedDays].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)); // Sort Mon-Sun
  const daysStr = sortedDays.map(d => daysNames[d]).join(", ");
  
  const unitStr = frequencyValue === 1 
    ? frequencyUnit.slice(0, -1) // e.g. "week" instead of "weeks"
    : frequencyUnit;
  
  const freqStr = frequencyValue === 1 
    ? `Every ${unitStr}` 
    : `Every ${frequencyValue} ${unitStr}`;
    
  return `${freqStr} on ${daysStr}`;
}
