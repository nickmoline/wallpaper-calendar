import ical from 'node-ical';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);
import { ProcessedEvent } from './dates';

export async function fetchHolidays(icalConfig: Record<string, string> | undefined, year: number, month: number): Promise<ProcessedEvent[]> {
    if (!icalConfig) return [];
    
    const events: ProcessedEvent[] = [];
    
    for (const [label, url] of Object.entries(icalConfig)) {
        try {
            const data = await ical.async.fromURL(url);
            for (const k in data) {
                if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
                const ev = data[k] as any;
                if (ev && ev.type === 'VEVENT') {
                    // node-ical handles recurrences mostly, but for simplicity we rely on the returned dates.
                    // If it's a recurring event, we might need to use its `.rrule`.
                    // To keep it simple, we check if the start date falls within our month.
                    // This is naive and might not catch long-running recurring events. But we'll do our best.
                    
                    const d = dayjs(ev.start);
                    const startOfMonth = dayjs().year(year).month(month - 1).startOf('month');
                    const endOfMonth = startOfMonth.endOf('month');
                    const calendarStart = startOfMonth.startOf('week');
                    const calendarEnd = endOfMonth.endOf('week');
                    
                    if (d.isBetween(calendarStart, calendarEnd, 'day', '[]')) {
                        events.push({
                            date: d.format('YYYY-MM-DD'),
                            label: typeof ev.summary === 'string' ? ev.summary : (ev.summary as any)?.val || 'Holiday',
                            size: 'small', // holidays are usually small text on calendar
                            type: 'holiday'
                        });
                    }
                }
            }
        } catch (e) {
            console.error(`Failed to fetch ICS feed ${label}: ${url}`, e);
        }
    }
    
    return events;
}
