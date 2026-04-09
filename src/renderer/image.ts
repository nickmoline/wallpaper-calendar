import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

export async function createCalendarImage(html: string, width: number, height: number, outputPath: string): Promise<string> {
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width, height, deviceScaleFactor: 2 });
        // Instead of waiting for non-existent network calls, explicitly wait for the synchronous load
        await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
        
        // Wait specifically for custom web fonts to finish discharging into V8
        await page.evaluateHandle('document.fonts.ready');
        
        // Take an explicit screenshot of exactly the viewport bounds
        await page.screenshot({ path: outputPath });
        return outputPath;
    } finally {
        await browser.close();
    }
}
