import dayjs from 'dayjs';
import * as fs from 'fs';
import * as path from 'path';
import { ColorScheme } from './colors';
import { ProcessedEvent } from '../engine/dates';
import { DailyWeather } from '../engine/weather';
import { DailyMoon } from '../engine/moon';

function getBase64Image(imagePath: string, configDir: string): string {
    const emptyPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    if (!imagePath) return emptyPixel;
    try {
        const absPath = path.resolve(configDir, imagePath);
        if (!fs.existsSync(absPath)) return emptyPixel;
        const ext = path.extname(absPath).toLowerCase().replace('.', '') || 'png';
        const data = fs.readFileSync(absPath).toString('base64');
        return `data:image/${ext};base64,${data}`;
    } catch (e) {
        return emptyPixel;
    }
}

export function renderCalendarHtml(
    year: number,
    month: number,
    events: ProcessedEvent[],
    colors: ColorScheme,
    layout: 'vertical' | 'ultrawide' | 'normal',
    artPath: string | null,
    showMonthLabel: boolean,
    configDir: string,
    simulatedToday?: dayjs.Dayjs,
    fonts?: { default: string; 'month-label'?: string | null; day?: string | null; label?: string | null },
    dailyWeather?: Map<string, DailyWeather>,
    dailyMoon?: Map<string, DailyMoon>,
    bottomBuffer: number = 60
): string {
    const today = (simulatedToday || dayjs()).startOf('day');
    const startOfMonth = dayjs().year(year).month(month - 1).startOf('month');
    const endOfMonth = startOfMonth.endOf('month');
    
    // Calendar Grid
    const startDayOfWeek = startOfMonth.day(); // 0 is Sunday
    const daysInMonth = endOfMonth.date();
    
    const firstDayOfCalendar = startOfMonth.startOf('week');
    const lastDayOfCalendar = endOfMonth.endOf('week');
    
    let daysHtml = '';
    let currentDay = firstDayOfCalendar;
    
    while (currentDay.isSameOrBefore(lastDayOfCalendar, 'day')) {
        const dateStr = currentDay.format('YYYY-MM-DD');
        const isPast = currentDay.isBefore(today, 'day');
        const isToday = currentDay.isSame(today, 'day');
        const isOtherMonth = currentDay.month() !== month - 1;
        const dateNum = currentDay.date();
        
        const dayClasses = ['day', isPast ? 'past' : '', isOtherMonth ? 'other-month' : '', isToday ? 'today' : ''];
        
        // Find events for this day
        const dayEvents = events.filter(e => e.date === dateStr);
        
        const paydays = dayEvents.filter(e => e.type === 'payday');
        const largeEvents = dayEvents.filter(e => e.size === 'large' && e.type !== 'payday');
        const topLabels = dayEvents.filter(e => e.type === 'holiday' || e.type === 'birthday' || e.type === 'anniversary');
        
        const flowEvents = dayEvents.filter(e => e.type !== 'payday' && e.size !== 'large' && e.type !== 'holiday' && e.type !== 'birthday' && e.type !== 'anniversary').sort((a, b) => {
            const timeA = a.time || '00:00';
            const timeB = b.time || '00:00';
            if (timeA < timeB) return -1;
            if (timeA > timeB) return 1;
            return 0;
        });

        let paydayHtml = '';
        for (const pd of paydays) {
            paydayHtml += `<div class="small-label payday ${pd.class || ''}">${pd.label}</div>`;
        }
        let topLabelHtml = '';
        if (topLabels.length > 0) {
            topLabelHtml += `<div class="top-labels-container">`;
            for (const ev of topLabels) {
                if (ev.image) {
                    const b64 = getBase64Image(ev.image, configDir);
                    const sizeClass = ev.size === 'medium' ? 'medium-icon' : 'small-icon';
                    topLabelHtml += `<img src="${b64}" class="${sizeClass} ${ev.class || ''}" title="${ev.label}" />`;
                } else {
                    topLabelHtml += `<div class="small-label ${ev.type} ${ev.class || ''}">${ev.label}</div>`;
                }
            }
            topLabelHtml += `</div>`;
        }

        const weather = dailyWeather?.get(dateStr);
        const moon = dailyMoon?.get(dateStr);

        let weatherHtml = '';
        if (weather) {
            weatherHtml = `<div class="weather-info"><i class="wi ${weather.iconClass}"></i> <span class="temp">${weather.maxTemp}&deg;/${weather.minTemp}&deg;</span></div>`;
        }
        let moonHtml = '';
        if (moon) {
            moonHtml = `<div class="moon-info" title="Moon phase"><i class="wi ${moon.iconClass}"></i></div>`;
        }

        const topRowHtml = `
            <div class="day-top-row">
                <div class="date-left-group">
                    <div class="date-number">${dateNum}</div>
                    ${topLabelHtml}
                </div>
                <div class="top-right-group">
                    <div class="astro-weather-group">
                        ${moonHtml}
                        ${weatherHtml}
                    </div>
                    <div class="paydays-container">${paydayHtml}</div>
                </div>
            </div>
        `;
        
        let largeEventHtml = '';
        let largeEventTime = '00:00';
        if (largeEvents.length > 0) {
            const ev = largeEvents[0];
            if (ev) {
                largeEventTime = ev.time || '00:00';
                if (ev.image) {
                    const b64 = getBase64Image(ev.image, configDir);
                    largeEventHtml = `<div class="large-event"><img class="large-event-img ${ev.class || ''}" src="${b64}" /></div>`;
                } else {
                    largeEventHtml = `<div class="large-event"><span class="large-label ${ev.class || ''}">${ev.label}</span></div>`;
                }
            }
        }
        
        const eventsBefore = [];
        const eventsAfter = [];
        for (const ev of flowEvents) {
            const isLate = (ev.time || '00:00') >= largeEventTime;
            if (largeEvents.length === 0 || isLate) {
                eventsAfter.push(ev);
            } else {
                eventsBefore.push(ev);
            }
        }
        
        const renderEventFlow = (arr: ProcessedEvent[]) => {
            let html = '';
            for (const ev of arr) {
                if (ev.image) {
                    const b64 = getBase64Image(ev.image, configDir);
                    const sizeClass = ev.size === 'medium' ? 'medium-icon' : 'small-icon';
                    html += `<img src="${b64}" class="${sizeClass} ${ev.class || ''}" title="${ev.label}" />`;
                } else {
                    html += `<div class="small-label ${ev.type} ${ev.class || ''}">${ev.label}</div>`;
                }
            }
            return html;
        };

        const topEventsHtml = eventsBefore.length > 0 ? `<div class="events-before">${renderEventFlow(eventsBefore)}</div>` : '';
        const bottomRightHtml = eventsAfter.length > 0 ? `<div class="bottom-right-events">${renderEventFlow(eventsAfter)}</div>` : '';

        const bottomRowHtml = `
            <div class="day-bottom-row">
                ${bottomRightHtml}
            </div>
        `;
        
        const xMark = isPast ? `<div class="cross-out"></div>` : '';
        
        daysHtml += `<div class="${dayClasses.join(' ').trim()}">
            ${topRowHtml}
            ${topEventsHtml}
            ${largeEventHtml}
            ${bottomRowHtml}
            ${xMark}
        </div>`;
        
        currentDay = currentDay.add(1, 'day');
    }
    
    // Container Layouts
    let wrapClass = '';
    let artHtml = '';
    if (layout === 'vertical' && artPath) {
        wrapClass = 'layout-vertical';
        artHtml = `<div class="art-container" style="background: ${colors.artBg};"><img class="art-img" style="object-position: bottom center;" src="${getBase64Image(artPath, configDir)}" /></div>`;
    } else if (layout === 'ultrawide' && artPath) {
        wrapClass = 'layout-ultrawide';
        artHtml = `<div class="art-container"><img class="art-img" style="object-position: center center;" src="${getBase64Image(artPath, configDir)}" /></div>`;
    } else {
        wrapClass = 'layout-normal';
    }

    const monthLabelHtml = showMonthLabel 
        ? `<div class="month-heading">${startOfMonth.format('MMMM YYYY')}</div>`
        : '';
        
    const defaultFontStr = "'Helvetica Neue', Helvetica, Arial, sans-serif";
    const defaultFont = fonts?.default || defaultFontStr;
    const titleFont = fonts?.['month-label'] || defaultFont;
    const dayFont = fonts?.day || defaultFont;
    const labelFont = fonts?.label || defaultFont;
    
    let fontTags = '';
    if (fonts) {
        const fetchFonts = Array.from(new Set([defaultFont, titleFont, dayFont, labelFont]))
            .filter(f => f !== defaultFontStr);
        if (fetchFonts.length > 0) {
            const fontFamilies = fetchFonts.map(f => {
                const base = f.replace(/ /g, '+');
                if (base.includes(':')) return base;
                // Safely brute-force 400 and 700 weights into the v1 structural block
                return `${base}:400,700`;
            }).join('|');
            fontTags = `<link rel="preconnect" href="https://fonts.googleapis.com">\n` +
                       `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n` +
                       `<link href="https://fonts.googleapis.com/css?family=${fontFamilies}&display=swap" rel="stylesheet">`;
        }
    }

    return `<!DOCTYPE html>
<html>
<head>
${fontTags}
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/weather-icons/2.0.12/css/weather-icons.min.css">
<style>
    :root {
        --primary: ${colors.primary};
        --primaryText: ${colors.primaryText};
        --secondary: ${colors.secondary};
        --secondaryText: ${colors.secondaryText};
        --background: ${colors.background};
        --text: ${colors.text};
        --muted: ${colors.muted};
        --x-color: ${colors.xColor};
        --bottom-buffer: ${bottomBuffer}px;
    }
    body {
        margin: 0; padding: 0;
        font-family: ${fonts ? `'${defaultFont}', sans-serif` : defaultFontStr};
        background: var(--background);
        color: var(--text);
        box-sizing: border-box;
        overflow: hidden;
    }
    .layout-normal { font-size: 0.85rem; }
    .layout-normal .calendar-container { padding: 25px 25px calc(25px + var(--bottom-buffer, 0px)) 25px; }
    .layout-normal .month-heading { font-size: 2.2rem; margin-bottom: 10px; text-shadow: 2px 4px 10px rgba(0,0,0,0.8); }
    .layout-normal .weekday-header { font-size: 1rem; padding: 5px 0; }
    .layout-normal .date-number { font-size: 1.2rem; }
    .layout-normal .day { padding: 8px; }
    .layout-normal .small-icon { max-width: 30px; max-height: 30px; }
    .layout-normal .medium-icon { max-width: 50px; max-height: 50px; }
    .wrapper {
        display: flex;
        width: 100vw;
        height: 100vh;
    }
    /* Layouts */
    .layout-vertical { flex-direction: column; }
    .layout-ultrawide { flex-direction: row; }
    .layout-normal { flex-direction: column; justify-content: center; }
    
    .art-container {
        flex: 1;
        display: flex;
        overflow: hidden;
    }
    .art-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
    .calendar-container {
        flex: 1;
        padding: 40px 40px calc(40px + var(--bottom-buffer, 0px)) 40px;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }
    .calendar-table {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        border-radius: 24px;
        box-shadow: 10px 10px 15px rgba(0,0,0,0.7);
    }
    .month-heading {
        font-family: ${fonts ? `'${titleFont}', sans-serif` : defaultFontStr};
        font-size: 3rem;
        font-weight: bold;
        margin-bottom: 20px;
        color: var(--primary);
        flex-shrink: 0;
        text-shadow: 2px 4px 10px rgba(0,0,0,0.7);
    }
    .weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0;
        flex-shrink: 0;
        margin-bottom: 0;
    }
    .grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        /* 5 or 6 rows dynamically based on days */
        grid-auto-rows: 1fr;
        gap: 0;
        flex: 1;
        min-height: 0;
    }
    .weekday-header {
        font-family: ${fonts ? `'${dayFont}', sans-serif` : defaultFontStr};
        text-align: center;
        font-weight: bold;
        font-size: 1.2rem;
        padding: 8px 0;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #ffffff;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .weekday-header:first-child { border-top-left-radius: 24px; }
    .weekday-header:last-child { border-top-right-radius: 24px; }
    .day {
        position: relative;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 10px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        min-height: 0;
        color: #ffffff;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .day.today {
        border-color: var(--primary);
        box-shadow: 0 0 15px var(--primary), inset 0 0 10px rgba(0,0,0,0.5);
        z-index: 20;
    }
    .day:nth-last-child(7) { border-bottom-left-radius: 24px; }
    .day:last-child { border-bottom-right-radius: 24px; }
    .day.other-month {
        opacity: 0.9;
    }
    .day.other-month .date-number {
        color: rgba(255, 255, 255, 0.3);
    }
    .date-number {
        font-family: ${fonts ? `'${dayFont}', sans-serif` : defaultFontStr};
        font-size: 1.5rem;
        font-weight: bold;
        opacity: 0.8;
    }
    .day.today .date-number {
        color: var(--primary);
        font-weight: 900;
        opacity: 1;
        text-shadow: 0 2px 4px rgba(0,0,0,0.8);
    }
    .day-top-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        z-index: 5;
        position: relative;
    }
    .date-left-group {
        display: flex;
        align-items: flex-start;
        gap: 6px;
    }
    .top-labels-container {
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: flex-start;
    }
    .top-right-group {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
    }
    .astro-weather-group {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
    }
    .moon-info {
        color: #e0e0e0;
        font-size: 1.1rem;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    }
    .weather-info {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #f2c94c;
        font-size: 0.9rem;
        font-weight: bold;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    }
    .weather-info i.wi {
        font-size: 1.1rem;
    }
    .weather-info .temp {
        font-family: ${fonts ? `'${labelFont}', sans-serif` : defaultFontStr};
        color: rgba(255,255,255,0.9);
        font-size: 0.75rem;
    }
    .paydays-container {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
    }
    .large-event {
        position: absolute;
        top: 10px; left: 10px; right: 10px; bottom: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        z-index: 1;
    }
    .large-event-img {
        max-width: 100%;
        height: auto;
        flex-shrink: 0;
    }
    .large-label {
        font-family: ${fonts ? `'${labelFont}', sans-serif` : defaultFontStr};
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0,0,0,0.6);
        color: white;
        text-align: center;
        padding: 4px;
        font-size: 0.9rem;
        border-radius: 4px;
        width: 100%;
        z-index: 2;
    }
    .events-before {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        z-index: 5;
        position: relative;
        margin-top: 6px;
    }
    .day-bottom-row {
        display: flex;
        justify-content: flex-end;
        align-items: flex-end;
        margin-top: auto;
        z-index: 5;
        position: relative;
        width: 100%;
    }
    .bottom-right-events {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        justify-content: flex-end;
    }
    .small-icon {
        max-width: 40px;
        max-height: 40px;
        width: auto;
        height: auto;
        object-fit: contain;
        border-radius: 6px;
    }
    .medium-icon {
        max-width: 75px;
        max-height: 75px;
        width: auto;
        height: auto;
        object-fit: contain;
        border-radius: 6px;
    }
    .small-label {
        font-family: ${fonts ? `'${labelFont}', sans-serif` : defaultFontStr};
        font-size: 0.75rem;
        padding: 4px 6px;
        border-radius: 4px;
        background: var(--secondary);
        color: var(--secondaryText);
        max-width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: inline-block;
        width: max-content;
    }
    .small-label.payday { background: #28a745; color: #ffffff; }
    .small-label.holiday { background: #17a2b8; color: #ffffff; }
    .small-label.work-holiday, .large-label.work-holiday { background: #28a745; color: #ffffff; }
    .cross-out {
        position: absolute;
        top: 15px; left: 15px; right: 15px; bottom: 15px;
        background: linear-gradient(to top left,
            rgba(0,0,0,0) 0%,
            rgba(0,0,0,0) calc(50% - 12px),
            var(--x-color) 50%,
            rgba(0,0,0,0) calc(50% + 12px),
            rgba(0,0,0,0) 100%),
        linear-gradient(to top right,
            rgba(0,0,0,0) 0%,
            rgba(0,0,0,0) calc(50% - 12px),
            var(--x-color) 50%,
            rgba(0,0,0,0) calc(50% + 12px),
            rgba(0,0,0,0) 100%);
        pointer-events: none;
        z-index: 10;
        opacity: 0.8;
    }
</style>
</head>
<body style="${(layout === 'normal' && artPath) ? `background-image: url('${getBase64Image(artPath, configDir)}'); background-size: cover; background-position: center;` : ''}">
    <div class="wrapper ${wrapClass}">
        ${artHtml}
        <div class="calendar-container">
            ${monthLabelHtml}
            <div class="calendar-table">
                <div class="weekdays">
                    <div class="weekday-header">Sun</div>
                    <div class="weekday-header">Mon</div>
                    <div class="weekday-header">Tue</div>
                    <div class="weekday-header">Wed</div>
                    <div class="weekday-header">Thu</div>
                    <div class="weekday-header">Fri</div>
                    <div class="weekday-header">Sat</div>
                </div>
                <div class="grid">
                    ${daysHtml}
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
}
