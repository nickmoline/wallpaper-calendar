import * as fs from 'fs';
import * as path from 'path';

export interface PaydayConfig {
    label: string;
    schedule: string; // 'weekly', 'bi-weekly', 'twice-monthly-15th-last', 'twice-monthly-1st-15th', 'monthly'
    weekday?: string;
    example?: string;
}

export interface RecurringOtherEvent {
    label: string;
    weekday?: string; // used for weekly
    time?: string;
    schedule: string;
    image?: string;
    size?: 'small' | 'medium' | 'large';
    class?: string;
    skips?: string[];
}

export interface EventConfig {
    date?: string;
    start?: string;
    end?: string;
    bridge_weekend?: boolean;
    weekend_adjust?: boolean;
    label: string;
    time?: string;
    image?: string;
    size?: 'small' | 'medium' | 'large';
    class?: string;
}

export interface FontConfig {
    default: string;
    'month-label'?: string | null;
    day?: string | null;
    label?: string | null;
}

export interface CalendarConfig {
    'month-label'?: boolean;
    fonts?: FontConfig;
    paydays?: PaydayConfig[];
    'recurring-events'?: {
        birthdays?: Record<string, string>;
        anniversaries?: Record<string, string>;
        other?: RecurringOtherEvent[];
    };
    events?: EventConfig[];
    holidays?: EventConfig[];
    ical?: Record<string, string>;
}

export function loadConfig(configPath: string): CalendarConfig {
    try {
        const fullPath = path.resolve(configPath);
        const data = fs.readFileSync(fullPath, 'utf8');
        return JSON.parse(data) as CalendarConfig;
    } catch (e) {
        console.error(`Failed to load config from ${configPath}`, e);
        return {};
    }
}
