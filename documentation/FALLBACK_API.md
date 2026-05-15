# Fallback API Documentation

## Overview

The Fantasy F1 application uses a multi-layered data fetching strategy to ensure predictions remain available even when the primary OpenF1 API encounters issues.

## Data Source Priority

1. **Primary: OpenF1 API** (`https://api.openf1.org/v1`)
   - Official F1 data with detailed timing information
   - Includes lap times, pit stops, intervals, and comprehensive session data
   - May experience rate limits or temporary outages

2. **Fallback: Ergast F1 API** (`https://ergast.com/api/f1`)
   - Historical F1 data dating back to 1950
   - Provides race results, qualifying, and driver standings
   - More limited data compared to OpenF1 but highly reliable
   - Free, no authentication required

3. **Cache Fallback: Stale Data**
   - Up to 7 days of cached data from previous successful requests
   - Used when both APIs are unavailable

## When Fallback Activates

The Ergast API fallback automatically activates when:

- **Recent race session discovery returns no usable OpenF1 race sessions**
- **OpenF1 rate limits are exceeded** (HTTP 429) and no stale cache is available
- **OpenF1 returns server errors** (HTTP 5xx) or network failures during discovery/stat fetches
- **A discovered OpenF1 race session has no position data**, so Ergast race results are used for that session

## Implementation Details

### File Structure

```
src/services/
├── openf1DataService.js    # Main data aggregation with fallback logic
├── openF1API.js            # OpenF1 API wrapper
└── ergastAPI.js            # Ergast API wrapper (NEW)
```

### Key Functions

#### `ergastAPI.js`

```javascript
// Get recent completed races
getRecentRacesFromErgast(limit = 5)

// Get next upcoming race
getNextRaceFromErgast()

// Match a race by OpenF1 session date
getRaceForSessionDate(dateStart, { country, circuit })

// Get results for specific race
getRaceResults(year, round)

// Convert Ergast format to OpenF1-compatible format
convertErgastToOpenF1Format(ergastRace)
```

#### `openf1DataService.js` Changes

- Added `fallbackUsed` tracking flag
- New `recordFallbackUsed()` function to log when fallback is used
- Updated `getRecentRaceSessions()` to try Ergast on OpenF1 failure
- Updated `getNextRaceSession()` to try Ergast on OpenF1 failure
- Updated `buildSessionStats()` to use Ergast when OpenF1 session stats are unavailable
- Payload now includes `fallback_used` boolean field

## Data Quality Differences

### OpenF1 Data (Primary)
- ✅ Lap-by-lap timing data
- ✅ Pit stop durations
- ✅ Driver intervals/gaps
- ✅ Practice session data
- ✅ Real-time session updates
- ✅ Team colors

### Ergast Data (Fallback)
- ✅ Race finishing positions
- ✅ Grid positions
- ✅ Driver and team names
- ✅ Points scored
- ✅ Fastest lap rank
- ❌ No lap-by-lap timing
- ❌ No pit stop counts
- ❌ No interval data
- ❌ No team colors

## UI Indicators

When the Ergast fallback is used, the Predictions page displays:

```
✅ Fallback data source used:
   • Using Ergast API as fallback: OpenF1 API unavailable for recent race sessions

Data was successfully retrieved from Ergast API as a backup source.
```

This appears in the API errors summary panel in a green/emerald color scheme to indicate successful fallback rather than failure.

## Cache Strategy

### OpenF1 Cache
- **Raw API responses**: 24 hours
- **Session stats**: 7 days
- **Sessions list**: 6 hours
- **Full payload**: 4 hours

### Ergast Cache
- **All responses**: 30 minutes
- Simpler caching due to historical data being immutable
- Stored in memory (Map-based, not localStorage)

## Error Tracking

All API errors and fallback usage are tracked in the `api_errors` array included in the prediction payload:

```javascript
{
  url: 'FALLBACK',
  statusCode: 0,
  errorMessage: 'Using Ergast API as fallback: OpenF1 API unavailable',
  timestamp: '2025-05-15T19:00:00.000Z',
  context: {
    isFallback: true,
    source: 'Ergast API'
  }
}
```

## Testing Fallback

To test the fallback mechanism:

1. **Simulate OpenF1 failure**: Block `api.openf1.org` in your hosts file
2. **Generate predictions**: Click "Generate Predictions" button
3. **Verify fallback**: Check console for "Ergast fallback" messages
4. **Check UI**: Verify green "Fallback data source used" message appears

## Limitations

1. **No Practice Data**: Ergast doesn't provide FP1/FP2/FP3 results
2. **Limited Metrics**: Missing pit stops, lap times, and intervals
3. **AI Predictions**: May be less accurate without detailed timing data
4. **Historical Bias**: Ergast data only includes final race results

## Future Enhancements

Potential improvements to the fallback system:

- [ ] Add support for additional APIs (Formula1.com, RapidAPI F1)
- [ ] Implement weighted data merging (combine partial OpenF1 + Ergast)
- [ ] Add manual API selection in settings
- [ ] Cache Ergast data to localStorage for full offline support
- [ ] Fetch pit stop data from Ergast's `/pitstops` endpoint
- [ ] Use Ergast qualifying data when OpenF1 unavailable

## Related Files

- `src/services/openf1DataService.js` - Main data service with fallback logic
- `src/services/ergastAPI.js` - Ergast API implementation
- `src/pages/Predictions.jsx` - UI components showing fallback status
- `documentation/ARCHITECTURE.md` - Overall system architecture

## Resources

- [OpenF1 API Documentation](https://openf1.org/)
- [Ergast F1 API Documentation](http://ergast.com/mrd/)
- [Ergast API Terms of Use](http://ergast.com/mrd/terms/)
