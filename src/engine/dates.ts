import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isBetween from 'dayjs/plugin/isBetween';
import * as chrono from 'chrono-node';
import type { CalendarConfig, PaydayConfig, RecurringOtherEvent, EventConfig } from '../config';

dayjs.extend(isoWeek);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(isBetween);

export interface ProcessedEvent {
    date: string; // YYYY-MM-DD
    label: string;
    time?: string;
    image?: string;
    size?: 'small' | 'medium' | 'large';
    class?: string;
    type: 'event' | 'payday' | 'birthday' | 'anniversary' | 'holiday';
}

function parseWeekday(weekdayStr: string): number {
    const map: Record<string, number> = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 
        'thursday': 4, 'friday': 5, 'saturday': 6
    };
    return map[weekdayStr.toLowerCase()] ?? 0;
}

export function getEventsForMonth(config: CalendarConfig, year: number, month: number): ProcessedEvent[] {
    const events: ProcessedEvent[] = [];
    const startOfMonth = dayjs().year(year).month(month - 1).startOf('month');
    const endOfMonth = startOfMonth.endOf('month');
    const calendarStart = startOfMonth.startOf('week');
    const calendarEnd = endOfMonth.endOf('week');

    function parseLooseDate(dateStr: string, year: number): dayjs.Dayjs | null {
        let s = dateStr.toLowerCase().trim();
        
        // Check for "day after" / "day before" prefix
        let dayOffset = 0;
        if (s.startsWith('day after ')) {
            dayOffset = 1;
            s = s.slice('day after '.length);
        } else if (s.startsWith('day before ')) {
            dayOffset = -1;
            s = s.slice('day before '.length);
        }
        
        // Match Nth weekday in month
        const nthMatch = s.match(/^(first|second|third|fourth|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:in|of)\s+([a-z]+)$/);
        if (nthMatch) {
            const ordinals: Record<string, number> = { 'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'last': -1 };
            const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
            const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
            
            const ord = ordinals[nthMatch[1]!];
            const wd = weekdays.indexOf(nthMatch[2]!);
            const mo = months.findIndex(m => m.startsWith(nthMatch[3]!.slice(0,3)));
            
            if (mo !== -1 && ord !== undefined) {
                let d = dayjs().year(year).month(mo).date(1);
                while (d.day() !== wd) { d = d.add(1, 'day'); }
                
                if (ord > 0) {
                    d = d.add(ord - 1, 'week');
                } else if (ord === -1) {
                    let last = d;
                    while (last.add(1, 'week').month() === mo) { last = last.add(1, 'week'); }
                    d = last;
                }
                return d.add(dayOffset, 'day');
            }
        }
        
        // Explicit Match month day
        const mdMatch = s.match(/^([a-z]+)\s+(\d{1,2})$/);
        if (mdMatch) {
            const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
            const mo = months.findIndex(m => m.startsWith(mdMatch[1]!.slice(0,3)));
            if (mo !== -1) {
                return dayjs().year(year).month(mo).date(parseInt(mdMatch[2]!, 10)).add(dayOffset, 'day');
            }
        }
        
        // Fallback to chrono natively
        const parsed = chrono.parseDate(dateStr, new Date(year, 0, 1), { forwardDate: true });
        return parsed ? dayjs(parsed).add(dayOffset, 'day') : null;
    }

    function processLooseEvents(sourceEvents: EventConfig[], type: 'event' | 'holiday') {
        const candidateYears = [year - 1, year, year + 1];
        for (const ev of sourceEvents) {
            if (ev.start && ev.end) {
                for (const y of candidateYears) {
                    let dStart = parseLooseDate(ev.start, y);
                    let dEnd = parseLooseDate(ev.end, y);
                    if (dStart && dEnd) {
                        if (dEnd.isBefore(dStart)) dEnd = dEnd.add(1, 'year');
                        let curr = dStart;
                        while (curr.isSameOrBefore(dEnd, 'day')) {
                            if (curr.isBetween(calendarStart, calendarEnd, 'day', '[]')) {
                                events.push({ ...ev, type, date: curr.format('YYYY-MM-DD') });
                            }
                            curr = curr.add(1, 'day');
                        }
                    }
                }
            } else if (ev.date) {
                const isStrict = /^\d{4}-\d{2}-\d{2}$/.test(ev.date);
                if (isStrict) {
                    let d = dayjs(ev.date);
                    if (ev.bridge_weekend) {
                        if (d.day() === 4) d = d.add(1, 'day');
                        else if (d.day() === 2) d = d.subtract(1, 'day');
                    }
                    if (ev.weekend_adjust) {
                        if (d.day() === 6) d = d.subtract(1, 'day'); // Saturday -> Friday
                        else if (d.day() === 0) d = d.add(1, 'day'); // Sunday -> Monday
                    }
                    if (d.isBetween(calendarStart, calendarEnd, 'day', '[]')) {
                        events.push({ ...ev, type, date: d.format('YYYY-MM-DD') });
                    }
                } else {
                    for (const y of candidateYears) {
                        let d = parseLooseDate(ev.date, y);
                        if (d) {
                            if (ev.bridge_weekend) {
                                if (d.day() === 4) d = d.add(1, 'day');
                                else if (d.day() === 2) d = d.subtract(1, 'day');
                            }
                            if (ev.weekend_adjust) {
                                if (d.day() === 6) d = d.subtract(1, 'day');
                                else if (d.day() === 0) d = d.add(1, 'day');
                            }
                            if (d.isBetween(calendarStart, calendarEnd, 'day', '[]')) {
                                events.push({ ...ev, type, date: d.format('YYYY-MM-DD') });
                            }
                        }
                    }
                }
            }
        }
    }

    if (config.events) processLooseEvents(config.events, 'event');
    if (config.holidays) processLooseEvents(config.holidays, 'holiday');

    // 2. Birthdays & Anniversaries
    if (config['recurring-events']) {
        const bdays = config['recurring-events'].birthdays || {};
        for (const [name, dateStr] of Object.entries(bdays)) {
            const parsedBday = dayjs(dateStr);
            const monthDay = parsedBday.format('MM-DD');
            const hasYear = /^\d{4}-/.test(dateStr);
            let c = calendarStart;
            while (c.isSameOrBefore(calendarEnd, 'day')) {
                if (c.format('MM-DD') === monthDay) {
                    let label = `${name} 🎂`;
                    if (hasYear) {
                        const age = c.year() - parsedBday.year();
                        if (age > 0) {
                            label = `${name} 🎂 ${age}`;
                        }
                    }
                    events.push({
                        date: c.format('YYYY-MM-DD'),
                        label,
                        size: 'small',
                        type: 'birthday'
                    });
                }
                c = c.add(1, 'day');
            }
        }

        const annivs = config['recurring-events'].anniversaries || {};
        for (const [name, dateStr] of Object.entries(annivs)) {
            const parsedBaseDate = dayjs(dateStr);
            const monthDay = parsedBaseDate.format('MM-DD');
            const hasYear = /^\d{4}-/.test(dateStr);
            let c = calendarStart;
            while (c.isSameOrBefore(calendarEnd, 'day')) {
                if (c.format('MM-DD') === monthDay) {
                    let label = `${name} Anniversary`;
                    if (hasYear) {
                        const years = c.year() - parsedBaseDate.year();
                        if (years > 0) {
                            const suffix = years === 1 ? 'Year!' : 'Years!';
                            label = `${name} ${years} ${suffix}`;
                        }
                    }
                    events.push({
                        date: c.format('YYYY-MM-DD'),
                        label: label,
                        size: 'small',
                        type: 'anniversary'
                    });
                }
                c = c.add(1, 'day');
            }
        }

        // Other recurring
        const others = config['recurring-events'].other || [];
        for (const r of others) {
            if (r.schedule === 'weekly' && r.weekday) {
                const targetDay = parseWeekday(r.weekday);
                let current = calendarStart.day(targetDay);
                if (current.isBefore(calendarStart, 'day')) {
                    current = current.add(1, 'week');
                }
                while (current.isSameOrBefore(calendarEnd, 'day')) {
                    const dateStr = current.format('YYYY-MM-DD');
                    if (!r.skips?.includes(dateStr)) {
                        events.push({
                            date: dateStr,
                            label: r.label,
                            time: r.time,
                            image: r.image,
                            size: r.size,
                            class: r.class,
                            type: 'event'
                        });
                    }
                    current = current.add(1, 'week');
                }
            }
        }
    }

    // 3. Paydays
    if (config.paydays) {
        const monthsCovered: dayjs.Dayjs[] = [];
        let curM = calendarStart.startOf('month');
        while (curM.isSameOrBefore(calendarEnd, 'month')) {
            monthsCovered.push(curM);
            curM = curM.add(1, 'month').startOf('month');
        }

        for (const pd of config.paydays) {
            if (pd.schedule === 'twice-monthly-15th-last') {
                for (const m of monthsCovered) {
                    const midDay = m.date(15);
                    const lastDay = m.endOf('month').startOf('day');
                    if (midDay.isBetween(calendarStart, calendarEnd, 'day', '[]')) {
                        events.push({ date: midDay.format('YYYY-MM-DD'), label: pd.label, size: 'small', type: 'payday' });
                    }
                    if (lastDay.isBetween(calendarStart, calendarEnd, 'day', '[]')) {
                        events.push({ date: lastDay.format('YYYY-MM-DD'), label: pd.label, size: 'small', type: 'payday' });
                    }
                }
            } else if (pd.schedule === 'twice-monthly-1st-15th') {
                for (const m of monthsCovered) {
                    const firstDay = m.date(1);
                    const midDay = m.date(15);
                    if (firstDay.isBetween(calendarStart, calendarEnd, 'day', '[]')) {
                        events.push({ date: firstDay.format('YYYY-MM-DD'), label: pd.label, size: 'small', type: 'payday' });
                    }
                    if (midDay.isBetween(calendarStart, calendarEnd, 'day', '[]')) {
                        events.push({ date: midDay.format('YYYY-MM-DD'), label: pd.label, size: 'small', type: 'payday' });
                    }
                }
            } else if (pd.schedule === 'monthly' && pd.example) {
                const ex = dayjs(pd.example);
                for (const m of monthsCovered) {
                    const pdDay = m.date(ex.date());
                    if (pdDay.isBetween(calendarStart, calendarEnd, 'day', '[]')) {
                        events.push({ date: pdDay.format('YYYY-MM-DD'), label: pd.label, size: 'small', type: 'payday' });
                    }
                }
            } else if ((pd.schedule === 'bi-weekly' || pd.schedule === 'weekly') && pd.example) {
                const ex = dayjs(pd.example);
                let checkDay = calendarStart.startOf('isoWeek');
                if (checkDay.isAfter(calendarStart, 'day')) {
                    checkDay = checkDay.subtract(1, 'week');
                }
                let c = checkDay;
                while (c.isSameOrBefore(calendarEnd, 'day')) {
                    const diffDays = c.diff(ex, 'day');
                    if (pd.schedule === 'bi-weekly' && diffDays % 14 === 0 && c.isBetween(calendarStart, calendarEnd, 'day', '[]')) {
                        events.push({ date: c.format('YYYY-MM-DD'), label: pd.label, size: 'small', type: 'payday' });
                    } else if (pd.schedule === 'weekly' && diffDays % 7 === 0 && c.isBetween(calendarStart, calendarEnd, 'day', '[]')) {
                        events.push({ date: c.format('YYYY-MM-DD'), label: pd.label, size: 'small', type: 'payday' });
                    }
                    c = c.add(1, 'day');
                }
            }
        }
    }

    // Sort by date then time
    events.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const tA = a.time || '23:59';
        const tB = b.time || '23:59';
        return tA.localeCompare(tB);
    });

    return events;
}
