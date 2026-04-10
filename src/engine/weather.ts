import { WeatherConfig, EventConfig } from '../config';

export interface DailyWeather {
    date: string; // YYYY-MM-DD
    minTemp: number;
    maxTemp: number;
    iconClass: string;
}

function mapWmoToWeatherIcon(code: number): string {
    // Open-Meteo uses WMO Weather interpretation codes
    if (code === 0) return 'wi-day-sunny';
    if (code === 1) return 'wi-day-sunny-overcast';
    if (code === 2) return 'wi-day-cloudy';
    if (code === 3) return 'wi-cloudy';
    if (code === 45 || code === 48) return 'wi-fog';
    if (code >= 51 && code <= 57) return 'wi-sprinkle';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'wi-rain';
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'wi-snow';
    if (code >= 95) return 'wi-thunderstorm';
    
    return 'wi-cloudy';
}

export async function fetchWeather(config?: WeatherConfig): Promise<Map<string, DailyWeather>> {
    const weatherMap = new Map<string, DailyWeather>();
    if (!config || !config.lat || !config.lon) {
        return weatherMap;
    }

    const { lat, lon, units = 'imperial' } = config;
    const tempUnit = units === 'imperial' ? 'fahrenheit' : 'celsius';
    
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=${tempUnit}&forecast_days=10`;
        const res = await fetch(url);
        if (!res.ok) {
            console.error('Failed to fetch weather from Open-Meteo:', res.statusText);
            return weatherMap;
        }

        const data = await res.json();
        if (data && data.daily) {
            const tempMax = data.daily.temperature_2m_max;
            const tempMin = data.daily.temperature_2m_min;
            const code = data.daily.weather_code;
            
            for (let i = 0; i < data.daily.time.length; i++) {
                const dateStr = data.daily.time[i];
                weatherMap.set(dateStr, {
                    date: dateStr,
                    minTemp: Math.round(tempMin[i]),
                    maxTemp: Math.round(tempMax[i]),
                    iconClass: mapWmoToWeatherIcon(code[i])
                });
            }
        }
    } catch (e) {
        console.error('Error fetching weather data:', e);
    }
    return weatherMap;
}

export async function geocode(location: string): Promise<{ lat: number; lon: number } | null> {
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&format=json`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.results && data.results.length > 0) {
            return {
                lat: data.results[0].latitude,
                lon: data.results[0].longitude
            };
        }
    } catch (e) {
        console.error('Failed to geocode location:', location, e);
    }
    return null;
}

export async function overlayEventWeather(
    dailyWeather: Map<string, DailyWeather>,
    events: EventConfig[],
    units: 'standard' | 'metric' | 'imperial'
): Promise<void> {
    const geoCache = new Map<string, { lat: number; lon: number }>();
    const weatherCache = new Map<string, Map<string, DailyWeather>>();

    for (const ev of events) {
        if (ev.location && ev.date && dailyWeather.has(ev.date)) {
            // Geocode location
            let coords = geoCache.get(ev.location);
            if (!coords) {
                const result = await geocode(ev.location);
                if (result) {
                    coords = result;
                    geoCache.set(ev.location, coords);
                }
            }

            if (coords) {
                const coordKey = `${coords.lat},${coords.lon}`;
                let wMap = weatherCache.get(coordKey);
                if (!wMap) {
                    wMap = await fetchWeather({ lat: coords.lat, lon: coords.lon, units });
                    weatherCache.set(coordKey, wMap);
                }

                const specificWeather = wMap.get(ev.date);
                if (specificWeather) {
                    dailyWeather.set(ev.date, specificWeather);
                }
            }
        }
    }
}
