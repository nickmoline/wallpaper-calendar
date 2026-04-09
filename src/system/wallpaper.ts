import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const execAsync = promisify(exec);

export async function setWallpaper(desktopIndex: number, imagePath: string): Promise<void> {
    if (os.platform() === 'win32') {
        const psScript = `
$code = @"
using System;
using System.Runtime.InteropServices;
public class WinWallpaper {
    [ComImport] [Guid("C2CF3110-460E-4fc1-B9D0-8A1C0C9CC4BD")] public class DesktopWallpaperClass { }
    [ComImport] [Guid("B92B56A9-8B55-4E14-9A89-0199BBB6F93B")] [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IDesktopWallpaper {
        void SetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitorID, [MarshalAs(UnmanagedType.LPWStr)] string wallpaper);
        [return: MarshalAs(UnmanagedType.LPWStr)] string GetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitorID);
        [return: MarshalAs(UnmanagedType.LPWStr)] string GetMonitorDevicePathAt(uint monitorIndex);
    }
    public static void Set(int monitorIndex, string path) {
        var w = (IDesktopWallpaper)new DesktopWallpaperClass();
        string id = w.GetMonitorDevicePathAt((uint)monitorIndex);
        w.SetWallpaper(id, path);
    }
}
"@
Add-Type -TypeDefinition $code
[WinWallpaper]::Set(${desktopIndex}, "${imagePath}")
        `;
        const tmpFile = path.join(os.tmpdir(), `desktop-cal-setWallpaper-${desktopIndex}.ps1`);
        fs.writeFileSync(tmpFile, psScript);
        
        try {
            await execAsync(`powershell -ExecutionPolicy Bypass -File ${tmpFile}`);
            console.log(`Successfully set Windows wallpaper on screen ${desktopIndex} to ${imagePath}`);
        } catch (e) {
            console.error(`Failed to set Windows wallpaper for screen ${desktopIndex}`, e);
        }
        return;
    }

    const setScript = `
ObjC.import('AppKit');
var workspace = $.NSWorkspace.sharedWorkspace;
var screens = $.NSScreen.screens;
var screen = screens.objectAtIndex(${desktopIndex});
var url = $.NSURL.fileURLWithPath("${imagePath}");
var opt = $.NSDictionary.alloc.init;
workspace.setDesktopImageURLForScreenOptionsError(url, screen, opt, $());
    `;
    
    const tmpFile = path.join(os.tmpdir(), `desktop-cal-setWallpaper-${desktopIndex}.js`);
    fs.writeFileSync(tmpFile, setScript);
    
    try {
        await execAsync(`osascript -l JavaScript ${tmpFile}`);
        console.log(`Successfully set wallpaper on screen ${desktopIndex} to ${imagePath}`);
    } catch (e) {
        console.error(`Failed to set wallpaper using JXA for screen ${desktopIndex}`, e);
    }
}
