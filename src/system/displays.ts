import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const execAsync = promisify(exec);

export interface DisplayLayout {
    index: number; // 0-based
    width: number;
    height: number;
    layout: 'vertical' | 'ultrawide' | 'normal';
}

export async function getActiveDisplays(): Promise<DisplayLayout[]> {
    if (os.platform() === 'win32') {
        const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens
$results = @()
foreach ($s in $screens) {
    $results += @{
        index = $results.Count
        width = $s.Bounds.Width
        height = $s.Bounds.Height
    }
}
$results | ConvertTo-Json -Compress
        `;
        const tmpFile = path.join(os.tmpdir(), 'desktop-cal-getScreens.ps1');
        fs.writeFileSync(tmpFile, psScript);
        
        const { stdout } = await execAsync(`powershell -ExecutionPolicy Bypass -File ${tmpFile}`);
        const screens = JSON.parse(stdout.trim());
        const results: DisplayLayout[] = [];
        
        for (const screen of screens) {
            const ratio = screen.width / screen.height;
            let layout: 'vertical' | 'ultrawide' | 'normal' = 'normal';
            if (ratio <= 1.2) layout = 'vertical';
            else if (ratio >= 2.0) layout = 'ultrawide';
            
            results.push({
                index: screen.index,
                width: screen.width,
                height: screen.height,
                layout
            });
        }
        return results.length === 0 ? [{ index: 0, width: 1920, height: 1080, layout: 'normal' }] : results;
    }

    // MacOS Strategy Fallback
    const getScreensScript = `
ObjC.import('AppKit');
var screens = $.NSScreen.screens;
var results = [];
for (var i = 0; i < screens.count; i++) {
    var s = screens.objectAtIndex(i);
    var f = s.frame;
    results.push({
        index: i,
        width: f.size.width,
        height: f.size.height
    });
}
JSON.stringify(results);
    `;
    
    const tmpFile = path.join(os.tmpdir(), 'desktop-cal-getScreens.js');
    fs.writeFileSync(tmpFile, getScreensScript);
    
    const { stdout } = await execAsync(`osascript -l JavaScript ${tmpFile}`);
    const screens = JSON.parse(stdout);
    const results: DisplayLayout[] = [];
    
    for (const screen of screens) {
        const ratio = screen.width / screen.height;
        let layout: 'vertical' | 'ultrawide' | 'normal' = 'normal';
        
        if (ratio <= 1.2) {
            layout = 'vertical';
        } else if (ratio >= 2.0) {
            layout = 'ultrawide';
        }
        
        results.push({
            index: screen.index,
            width: screen.width,
            height: screen.height,
            layout
        });
    }
    
    // If empty fallback to standard 1080p normal
    if (results.length === 0) {
        results.push({ index: 0, width: 1920, height: 1080, layout: 'normal' });
    }
    
    return results;
}
