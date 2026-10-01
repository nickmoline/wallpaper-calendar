import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { Vibrant } from 'node-vibrant/node';

export interface ColorScheme {
    primary: string;
    primaryText: string;
    secondary: string;
    secondaryText: string;
    background: string;
    artBg: string;
    xColor: string;
    text: string;
    muted: string;
}

function getBase64Image(imagePath: string): string {
    const ext = path.extname(imagePath).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const data = fs.readFileSync(imagePath).toString('base64');
    return `data:${mime};base64,${data}`;
}

export async function extractColorScheme(imagePath: string, layout: 'vertical' | 'ultrawide' | 'normal' | '4k-normal'): Promise<ColorScheme> {
    const browser = await puppeteer.launch({ headless: true });
    
    let topColor = '#ffffff';
    let bottomColor = '#ffffff';
    let rightColor = '#ffffff';
    
    let primary = '#1a73e8';
    let secondary = '#0d47a1';
    let xColor = '#ff4444';
    let palette: any = null;

    try {
        const vibrant = new (Vibrant as any)(imagePath);
        palette = await vibrant.getPalette();
    } catch(e) {
        console.error("Vibrant parsing failed", e);
    }

    try {
        const page = await browser.newPage();
        const b64 = getBase64Image(imagePath);
        
        await page.setContent(`
            <html><body>
            <img id="img" src="${b64}" />
            <canvas id="canvas"></canvas>
            </body></html>
        `);
        
        const edges = await page.evaluate(() => {
            return new Promise<any>((resolve) => {
                const img = document.getElementById('img') as HTMLImageElement;
                const process = () => {
                    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d')!;
                    ctx.drawImage(img, 0, 0);
                    
                    const getColor = (x: number, y: number, w: number, h: number) => {
                        const imageData = ctx.getImageData(x, y, w, h).data;
                        const counts: Record<string, number> = {};
                        let maxCount = 0;
                        let bestColor = {r: 0, g: 0, b: 0};
                        
                        for (let i = 0; i < imageData.length; i += 4) {
                            const rData = imageData[i];
                            if (rData === undefined) continue;
                            const r = Math.floor(rData / 10) * 10;
                            const g = Math.floor((imageData[i+1] || 0) / 10) * 10;
                            const b = Math.floor((imageData[i+2] || 0) / 10) * 10;
                            
                            const key = r + ',' + g + ',' + b;
                            counts[key] = (counts[key] || 0) + 1;
                            if (counts[key] > maxCount) {
                                maxCount = counts[key];
                                bestColor = {r: rData as number, g: imageData[i+1] as number, b: imageData[i+2] as number};
                            }
                        }
                        if (maxCount === 0) bestColor = {r: imageData[0]||0, g: imageData[1]||0, b: imageData[2]||0};
                        
                        const toHex = (c: number) => c.toString(16).padStart(2, '0');
                        return '#' + toHex(bestColor.r) + toHex(bestColor.g) + toHex(bestColor.b);
                    };
                    
                    const t = getColor(0, 0, img.width, Math.max(1, Math.floor(img.height * 0.02)));
                    const b = getColor(0, img.height - Math.max(1, Math.floor(img.height * 0.02)), img.width, Math.max(1, Math.floor(img.height * 0.02)));
                    const r = getColor(img.width - Math.max(1, Math.floor(img.width * 0.02)), 0, Math.max(1, Math.floor(img.width * 0.02)), img.height);
                    
                    resolve({ topColor: t, bottomColor: b, rightColor: r });
                };
                
                if (img.complete) process(); else img.onload = process;
            });
        });
        
        topColor = edges.topColor;
        bottomColor = edges.bottomColor;
        rightColor = edges.rightColor;
    } catch(e) {
        console.error("Puppeteer evaluation failed", e);
    } finally {
        await browser.close();
    }
    
    let background = bottomColor;
    let artBg = topColor;
    let lumaRef = bottomColor;
    
    if (layout === 'ultrawide') {
        background = `linear-gradient(to bottom, ${topColor}, ${bottomColor})`;
        artBg = `transparent`;
        lumaRef = rightColor;
    }
    
    const hexToRgb = (hex: string) => {
        const h = hex.replace('#', '');
        return {
            r: parseInt(h.substring(0, 2), 16),
            g: parseInt(h.substring(2, 4), 16),
            b: parseInt(h.substring(4, 6), 16)
        };
    };
    const bgRgb = hexToRgb(lumaRef);
    const luma = 0.2126 * bgRgb.r + 0.7152 * bgRgb.g + 0.0722 * bgRgb.b;
    
    let text = '#ffffff';
    let muted = '#eeeeee';
    
    if (luma > 128) {
        text = '#111111';
        muted = '#333333';
    } else {
        text = '#eeeeee';
        muted = '#cccccc';
    }
    
    if (palette) {
        const getLuma = (hex: string) => {
            const h = hex.replace('#', '');
            if (h.length < 6) return 0;
            const r = parseInt(h.substring(0, 2), 16) / 255;
            const g = parseInt(h.substring(2, 4), 16) / 255;
            const b = parseInt(h.substring(4, 6), 16) / 255;
            const f = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const getContrast = (hex1: string, hex2: string) => {
            const l1 = getLuma(hex1);
            const l2 = getLuma(hex2);
            return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        };
        
        const headingBgColor = layout === 'vertical' ? bottomColor : topColor;
        
        const choices = [
            palette.Vibrant, palette.LightVibrant, palette.DarkVibrant,
            palette.Muted, palette.LightMuted, palette.DarkMuted
        ].filter(p => p !== null && p !== undefined);
            
        let bestContrast = -1;
        let chosenPrimary = primary;
        
        for (const p of choices) {
            const ratio = getContrast(p.hex, headingBgColor);
            if (ratio > bestContrast) {
                bestContrast = ratio;
                chosenPrimary = p.hex;
            }
        }
        primary = bestContrast >= 3.0 ? chosenPrimary : text;
        
        let bestDayContrast = -1;
        let chosenSecondary = secondary;
        for (const p of choices) {
            const ratio = getContrast(p.hex, '#333333'); 
            if (ratio > bestDayContrast && p.hex !== primary) {
                bestDayContrast = ratio;
                chosenSecondary = p.hex;
            }
        }
        secondary = bestDayContrast >= 2.0 ? chosenSecondary : muted;

        let bestXContrast = -1;
        let chosenX = xColor;
        for (const p of choices) {
            const ratio = getContrast(p.hex, '#333333');
            if (ratio > bestXContrast && p.hex !== primary && p.hex !== secondary) {
                bestXContrast = ratio;
                chosenX = p.hex;
            }
        }
        xColor = bestXContrast >= 2.0 ? chosenX : text;
    }

    const getLumaLocal = (hex: string) => {
        const h = hex.replace('#', '');
        if (h.length < 6) return 0;
        const r = parseInt(h.substring(0, 2), 16) / 255;
        const g = parseInt(h.substring(2, 4), 16) / 255;
        const b = parseInt(h.substring(4, 6), 16) / 255;
        const f = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };

    const primaryText = getLumaLocal(primary) > 0.179 ? '#111111' : '#ffffff';
    const secondaryText = getLumaLocal(secondary) > 0.179 ? '#111111' : '#ffffff';

    return {
        primary,
        primaryText,
        secondary,
        secondaryText,
        background,
        artBg,
        xColor,
        text,
        muted
    };
}
