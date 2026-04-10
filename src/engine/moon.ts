import suncalc from 'suncalc';
import dayjs from 'dayjs';

export interface DailyMoon {
    date: string;
    iconClass: string;
}

const MILESTONES = [
    { threshold: 0, icon: 'wi-moon-new' },
    { threshold: 0.125, icon: 'wi-moon-waxing-crescent-4' },
    { threshold: 0.25, icon: 'wi-moon-first-quarter' },
    { threshold: 0.375, icon: 'wi-moon-waxing-gibbous-4' },
    { threshold: 0.5, icon: 'wi-moon-full' },
    { threshold: 0.625, icon: 'wi-moon-waning-gibbous-4' },
    { threshold: 0.75, icon: 'wi-moon-third-quarter' },
    { threshold: 0.875, icon: 'wi-moon-waning-crescent-4' },
];

export function getMoonPhases(year: number, month: number): Map<string, DailyMoon> {
    const moonMap = new Map<string, DailyMoon>();
    const startOfMonth = dayjs().year(year).month(month - 1).startOf('month').startOf('week');
    const endOfMonth = dayjs().year(year).month(month - 1).endOf('month').endOf('week');
    
    let currentDay = startOfMonth;
    while (currentDay.isSameOrBefore(endOfMonth, 'day')) {
        const d1 = currentDay.toDate(); d1.setHours(0,0,0,0);
        const d2 = currentDay.add(1, 'day').toDate(); d2.setHours(0,0,0,0);
        
        const p1 = suncalc.getMoonIllumination(d1).phase;
        const p2 = suncalc.getMoonIllumination(d2).phase;
        
        let milestoneIcon: string | null = null;
        
        // Check for wrap-around (New Moon)
        if (p1 > 0.9 && p2 < 0.1) {
            milestoneIcon = 'wi-moon-new';
        } else {
            // Check if it crosses any milestone
            for (const { threshold, icon } of MILESTONES) {
                if (p1 <= threshold && p2 > threshold && threshold !== 0) {
                    milestoneIcon = icon;
                    break;
                }
            }
        }
        
        if (milestoneIcon) {
            moonMap.set(currentDay.format('YYYY-MM-DD'), {
                date: currentDay.format('YYYY-MM-DD'),
                iconClass: milestoneIcon
            });
        }
        
        currentDay = currentDay.add(1, 'day');
    }
    
    return moonMap;
}
