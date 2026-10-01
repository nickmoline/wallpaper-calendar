import * as fs from 'fs';
import * as path from 'path';

export function findMonthArt(baseDir: string, year: number, month: number, layout: string): string | null {
    const artDir = path.join(baseDir, 'month-art');
    if (!fs.existsSync(artDir)) return null;
    
    const files = fs.readdirSync(artDir);
    const mm = String(month).padStart(2, '0');
    const yyyyMm = `${year}-${mm}`;
    
    if (layout === '4k-normal') {
        const normal4kMatch = files.find(f => f.startsWith(`${yyyyMm}-`) && (f.includes('-4k-normal') || f.includes('-4k'))) ||
                              files.find(f => f.startsWith(`${mm}-`) && (f.includes('-4k-normal') || f.includes('-4k')));
        if (normal4kMatch) return path.join(artDir, normal4kMatch);
    }
    
    if (layout === 'normal' || layout === '4k-normal') {
        const normalMatch = files.find(f => f.startsWith(`${yyyyMm}-`) && f.includes('-normal')) || 
                            files.find(f => f.startsWith(`${mm}-`) && f.includes('-normal'));
        if (normalMatch) return path.join(artDir, normalMatch);
    }
    
    let match = files.find(f => f.startsWith(`${yyyyMm}-`) && !f.includes('-normal') && !f.includes('-4k'));
    if (match) return path.join(artDir, match);
    
    match = files.find(f => f.startsWith(`${mm}-`) && !f.includes('-normal') && !f.includes('-4k'));
    if (match) return path.join(artDir, match);
    
    return null;
}
