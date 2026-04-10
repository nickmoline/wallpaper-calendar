# Desktop Calendar Wallpaper Generator

Generates desktop wallpaper images sized for your specific monitor resolutions containing a calendar.  Automatically updates on boot and at midnight to cross out dates and move the "current" cell.

## Features

- **Multiple monitor support:** Checks every monitor's resolution and orientation and generates a matching image for it.
- **Custom fonts:** Uses the Google fonts defined in `config.json`.
- **Recurring events:** Events that repeat on a schedule.
- **iCal integration:** Imports events from iCal calendars.
- **Event images:** Images associated with events.
- **Payday tracking:** Tracks paydays, with different pay schedules
- **Holiday tracking:** Tracks holidays, including with generic rules for holidays like "third monday in January"
- **Weather Forecast:** Displays a rolling 10-day local weather forecast directly on the calendar dates (Powered completely free via Open-Meteo).
- **Moon Phases:** Tracks the lunar cycle and displays icons specifically on major quarter milestones to reduce visual clutter.

## Installation

```bash
# Copy example config
cp example-config.json config.json

# Install dependencies
npm install
```

Fill the `month-art` folder with images for your calendar art.  File syntax is as follows.
- 'MM-month.png' (e.g. `01-january.png`) for default image for a month
- 'YYYY-MM-month.png' (e.g. `2026-01-january.png`) for overriding the image for a specific month/year combination
- 'MM-month-normal.png' (e.g. `01-january-normal.png`) for overriding the image specifically for the "normal" layout (i.e. not ultrawide or vertical) where the image is used as a background instead of a header.
- 'YYYY-MM-month-normal.png' also works for doing the same thing for a specific month/year combination.

```bash

# Configure to run at Midnight and on Boot
npm run install-cron
```

## Configuration
The `config.json` file contains the following fields:

- `month-label`: Boolean flag, if true, the month and year are added as a header above the calendar, set to false if your image already includes this or you don't want it.
- `weather`: Optional object used to populate a 10-day local forecast on the calendar without any API keys. Can contain `lat` (latitude), `lon` (longitude), and `units` (e.g. "imperial" (default), "metric", or "standard").
- `paydays`: Array of paydays, each is an object and can contain a label, schedule (bi-weekly, weekly, twice-monthly-15th-last, twice-monthly-1st-15th, monthly), weekday (optional) if paid on a specific day of the week, and specifically for "bi-weekly" there's an `example` key where you put in a known payday so it can extrapolate other paydays from that date.  You can have multiple payday schedules configured if you are paid from multiple sources or want to track a significant other's payday in addition to your own.
- `fonts`: list of Google Fonts to use, you can set a `default` font, as well as override that default font for `month-label`, `day`, and `label` for event labels.
- `recurring-events`: Object containing recurring events
    - `birthdays`: List of birthdays, you can have a label and a date, the date can either be in `YYYY-MM-DD` format (in which case it will display age) or `MM-DD` format (in which case it won't display age)
    - `anniversaries`: List of anniversaries, you can have a label and a date, the date can either be in `YYYY-MM-DD` format (in which case it will display number of years) or `MM-DD` format (in which case it won't display number of years)
    - `other`: List of other recurring events, each event is an object with a `label`, `weekday`, `time`, `schedule`, `image`, and `size`.  The `time` key is optional and can be used to order the events on a day.  The `image` and `size` keys are optional and can be used to specify an image to use for the event and the size of the image.  The `size` key can be "small", "medium", or "large".  The `skips` key is optional and can be used to specify an array of dates to skip the event for.  The `skips` key can be an array of dates in the format "YYYY-MM-DD" or "MM-DD" for recurring events that happen every year.
- `events`: List of events, each event is an object with a `date`, `label`, `time`, `image`, `size`, and `location`.  The `time` key is optional and can be used to order the events on a day.  The `image` and `size` keys are optional and can be used to specify an image to use for the event and the size of the image.  The `size` key can be "small", "medium", or "large". The `location` key is optional and allows you to specify a name (e.g., "Disneyland") or coordinates; the script will geocode this and override the normal daily weather on that exact date with the remote location's weather!  Try to use this on only 1 event per day.
- `holidays`: List of Holidays, each holiday is an object with a `date`, `label`, and `class`.  The `date` can be a specific date in `YYYY-MM-DD` or `MM-DD` format or a string rule such as "<nth> <weekday> in <month>" (e.g. "third monday in january").  The `class` is a class name that will be used to style the holiday. we have a custom styling for `work-holiday` currently.
- `ical`: List of iCal calendars to import events from, each iCal calendar as an associative array with a name/label to a url, ical urls will be grabbed and parsed for dates which will be added to the calendar.

## Usage

```bash
# Generate calendar for current month
npm run start

# Generate calendar for specific date
npm run start -- -t 2026-04-05

# Configure to automatically generate calendar at Midnight and on Boot
npm run install-cron
```