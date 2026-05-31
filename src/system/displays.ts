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
$code = @"
using System;
using System.Runtime.InteropServices;

public class WinScreens {
    [ComImport] [Guid("C2CF3110-460E-4fc1-B9D0-8A1C0C9CC4BD")] public class DesktopWallpaperClass { }
    [ComImport] [Guid("B92B56A9-8B55-4E14-9A89-0199BBB6F93B")] [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IDesktopWallpaper {
        void SetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitorID, [MarshalAs(UnmanagedType.LPWStr)] string wallpaper);
        [return: MarshalAs(UnmanagedType.LPWStr)] string GetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitorID);
        [return: MarshalAs(UnmanagedType.LPWStr)] string GetMonitorDevicePathAt(uint monitorIndex);
        uint GetMonitorDevicePathCount();
        void GetMonitorRECT([MarshalAs(UnmanagedType.LPWStr)] string monitorID, out RECT displayRect);
    }
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    public static string GetDisplays() {
        var w = (IDesktopWallpaper)new DesktopWallpaperClass();
        uint count = w.GetMonitorDevicePathCount();
        string json = "[";
        for (uint i = 0; i < count; i++) {
            string id = w.GetMonitorDevicePathAt(i);
            RECT rect;
            w.GetMonitorRECT(id, out rect);
            int width = Math.Abs(rect.Right - rect.Left);
            int height = Math.Abs(rect.Bottom - rect.Top);
            json += "{\\"index\\":" + i + ",\\"width\\":" + width + ",\\"height\\":" + height + "}";
            if (i < count - 1) json += ",";
        }
        json += "]";
        return json;
    }
}
"@
Add-Type -TypeDefinition $code
[WinScreens]::GetDisplays()
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
