#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import dayjs from 'dayjs';
import { loadConfig } from './config';
import { getEventsForMonth } from './engine/dates';
import { fetchHolidays } from './engine/ical';
import { findMonthArt } from './engine/assets';
import { extractColorScheme } from './renderer/colors';
import { renderCalendarHtml } from './renderer/html';
import { createCalendarImage } from './renderer/image';
import { fetchWeather, overlayEventWeather } from './engine/weather';
import { getMoonPhases } from './engine/moon';
import { getActiveDisplays } from './system/displays';
import { setWallpaper } from './system/wallpaper';
import { execSync } from 'child_process';

const program = new Command();

program
    .name('desktop-calendar')
    .description('Generates and sets dynamic calendar wallpapers')
    .version('1.0.0');

program.command('run')
    .description('Generate and apply the calendar wallpaper for all displays')
    .option('-y, --year <year>', 'Year to generate for (defaults to current)')
    .option('-m, --month <month>', 'Month to generate for (1-12, defaults to current)')
    .option('-c, --config <path>', 'Path to config.json', path.join(process.cwd(), 'config.json'))
    .option('-t, --today <date>', 'Simulate what "today" is (YYYY-MM-DD), overriding the current system time')
    .action(async (options) => {
        const simulatedToday = options.today ? dayjs(options.today, 'YYYY-MM-DD') : dayjs();
        const year = options.year ? Number(options.year) : simulatedToday.year();
        const month = options.month ? Number(options.month) : simulatedToday.month() + 1;
        const configPath = options.config;
        console.log(`Running desktop-calendar for ${year}-${month} with config ${configPath}`);

        const configDir = path.dirname(configPath);
        const config = loadConfig(configPath);

        const outDir = path.join(configDir, 'output');
        if (fs.existsSync(outDir)) {
            const oldFiles = fs.readdirSync(outDir);
            for (const file of oldFiles) {
                if (file.endsWith('.png')) {
                    fs.unlinkSync(path.join(outDir, file));
                }
            }
        } else {
            fs.mkdirSync(outDir);
        }

        const timestamp = dayjs().format('YYYYMMDDHHmmss');

        // 1. Process Dates & Events
        const baseEvents = getEventsForMonth(config, year, month);
        const holidays = await fetchHolidays(config.ical, year, month);
        const allEvents = [...baseEvents, ...holidays].sort((a, b) => a.date.localeCompare(b.date));

        // 1.5 Fetch Weather & Moon
        const dailyWeather = await fetchWeather(config.weather);
        await overlayEventWeather(dailyWeather, allEvents, (config.weather as any)?.units || 'imperial');
        const dailyMoon = getMoonPhases(year, month);

        // 2. Get active displays
        const displays = await getActiveDisplays();
        console.log(`Detected ${displays.length} display(s)`);

        const showLabel = config['month-label'] === true;
        const bottomBuffer = config['bottom-buffer'] !== undefined ? config['bottom-buffer'] : 60;

        // 4. Generate and Set
        for (const display of displays) {
            console.log(`Processing display ${display.index + 1} (${display.width}x${display.height}, ${display.layout})`);

            const artPath = findMonthArt(configDir, year, month, display.layout);
            let colors = { primary: '#1a73e8', primaryText: '#ffffff', secondary: '#0d47a1', secondaryText: '#ffffff', background: '#e8f0fe', text: '#333333', muted: '#f1f3f4', artBg: '#ffffff', xColor: '#ff4444' };
            if (artPath) {
                colors = await extractColorScheme(artPath, display.layout);
                console.log(`Extracted seam color for ${display.layout}:`, colors.background);
            }
            const html = renderCalendarHtml(
                year, month, allEvents, colors, display.layout, artPath, showLabel, configDir, simulatedToday, config.fonts, dailyWeather, dailyMoon, bottomBuffer
            );

            const outPath = path.join(outDir, `desktop-calendar-${display.layout}-${display.index}-${timestamp}.png`);
            await createCalendarImage(html, display.width, display.height, outPath);
            console.log(`Generated image at ${outPath}`);

            await setWallpaper(display.index, outPath);
        }

        console.log('All done!');
    });

program.command('install')
    .description('Install a scheduled task to run automatically at midnight and on boot')
    .option('-c, --config <path>', 'Path to config.json', path.join(process.cwd(), 'config.json'))
    .action((options) => {
        const configPath = path.resolve(options.config);
        const cwd = process.cwd();

        if (os.platform() === 'win32') {
            // Use powershell with WindowStyle Hidden to prevent the cmd window from flashing on boot
            const scriptStr = `npx ts-node '${path.resolve(__filename)}' run -c '${configPath}'`;
            const psWrapper = `powershell.exe -WindowStyle Hidden -Command \\"${scriptStr}\\"`;
            const taskName = 'DesktopCalendar';
            try {
                execSync(`schtasks /create /tn "${taskName}" /tr "${psWrapper}" /sc daily /st 00:00 /f`, { stdio: 'inherit' });
                // Also add a logon trigger
                execSync(`schtasks /create /tn "${taskName}_Boot" /tr "${psWrapper}" /sc onlogon /f`, { stdio: 'inherit' });
                console.log(`\nWindows Task Scheduler entries created: "${taskName}" (daily) and "${taskName}_Boot" (on logon)`);
            } catch (e) {
                console.error('Failed to create scheduled task. Try running as Administrator.', e);
            }
            return;
        }

        // macOS LaunchAgent
        const label = 'com.desktop-calendar.agent';
        const npxPath = execSync('which npx', { encoding: 'utf8' }).trim();
        const nodePath = path.dirname(npxPath);
        const plistDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
        const plistPath = path.join(plistDir, `${label}.plist`);
        const logPath = '/tmp/desktop-calendar.log';

        const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${npxPath}</string>
        <string>ts-node</string>
        <string>${path.resolve(__filename)}</string>
        <string>run</string>
        <string>-c</string>
        <string>${configPath}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${cwd}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${nodePath}:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>0</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${logPath}</string>
    <key>StandardErrorPath</key>
    <string>${logPath}</string>
</dict>
</plist>`;

        if (!fs.existsSync(plistDir)) {
            fs.mkdirSync(plistDir, { recursive: true });
        }

        // Unload existing if present
        try {
            execSync(`launchctl unload "${plistPath}" 2>/dev/null`);
        } catch (e) { /* ignore */ }

        fs.writeFileSync(plistPath, plist);
        console.log(`Created LaunchAgent at: ${plistPath}`);

        try {
            execSync(`launchctl load "${plistPath}"`);
            console.log('LaunchAgent loaded successfully!');
            console.log(`Schedule: every midnight + on login/boot`);
            console.log(`Logs: ${logPath}`);
            console.log(`\nTo uninstall: launchctl unload "${plistPath}" && rm "${plistPath}"`);
        } catch (e) {
            console.error('Failed to load LaunchAgent:', e);
            console.log(`You can manually load it with: launchctl load "${plistPath}"`);
        }
    });

program.command('uninstall')
    .description('Remove the scheduled task created by install')
    .action(() => {
        if (os.platform() === 'win32') {
            try {
                execSync('schtasks /delete /tn "DesktopCalendar" /f', { stdio: 'inherit' });
                console.log('Removed DesktopCalendar daily task.');
            } catch (e) { /* ignore if not found */ }
            try {
                execSync('schtasks /delete /tn "DesktopCalendar_Boot" /f', { stdio: 'inherit' });
                console.log('Removed DesktopCalendar_Boot logon task.');
            } catch (e) { /* ignore if not found */ }
            console.log('Windows scheduled tasks removed.');
            return;
        }

        const label = 'com.desktop-calendar.agent';
        const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);

        if (!fs.existsSync(plistPath)) {
            console.log('No LaunchAgent found. Nothing to uninstall.');
            return;
        }

        try {
            execSync(`launchctl unload "${plistPath}"`);
            console.log('LaunchAgent unloaded.');
        } catch (e) { /* ignore if already unloaded */ }

        fs.unlinkSync(plistPath);
        console.log(`Removed ${plistPath}`);
        console.log('Desktop calendar scheduled task has been uninstalled.');
    });

program.parse(process.argv);
