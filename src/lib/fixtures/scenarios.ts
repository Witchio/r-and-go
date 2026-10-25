import { CalendarEvent, GeoCoordinates, ScenarioPreset } from '../types';

export const CALIFORNIA_BOUNDS = {
  minLat: 32.52,
  maxLat: 42.01,
  minLng: -124.48,
  maxLng: -114.13,
};

export function isWithinCalifornia(coord?: GeoCoordinates | null): boolean {
  if (!coord) return false;
  return (
    coord.lat >= CALIFORNIA_BOUNDS.minLat &&
    coord.lat <= CALIFORNIA_BOUNDS.maxLat &&
    coord.lng >= CALIFORNIA_BOUNDS.minLng &&
    coord.lng <= CALIFORNIA_BOUNDS.maxLng
  );
}

export function clampToCalifornia(coord: GeoCoordinates): GeoCoordinates {
  if (isWithinCalifornia(coord)) return coord;
  return {
    lat: Math.max(
      CALIFORNIA_BOUNDS.minLat + 0.1,
      Math.min(CALIFORNIA_BOUNDS.maxLat - 0.1, coord.lat)
    ),
    lng: Math.max(
      CALIFORNIA_BOUNDS.minLng + 0.1,
      Math.min(CALIFORNIA_BOUNDS.maxLng - 0.1, coord.lng)
    ),
  };
}

export const SF_LOCATIONS: Record<
  string,
  {
    canonical: string;
    neighborhood: string;
    coordinates: GeoCoordinates;
  }
> = {
  'union square': {
    canonical: '333 Post St, Union Square, San Francisco, CA 94108',
    neighborhood: 'Union Square',
    coordinates: { lat: 37.7879, lng: -122.4075 },
  },
  'ferry building': {
    canonical: '1 Ferry Building, The Embarcadero, San Francisco, CA 94111',
    neighborhood: 'Embarcadero',
    coordinates: { lat: 37.7955, lng: -122.3937 },
  },
  'shack15': {
    canonical: 'SHACK15, 1 Ferry Building Suite 201, San Francisco, CA 94111',
    neighborhood: 'Embarcadero',
    coordinates: { lat: 37.7955, lng: -122.3937 },
  },
  soma: {
    canonical: '108 South Park St, SoMa, San Francisco, CA 94107',
    neighborhood: 'SoMa',
    coordinates: { lat: 37.7816, lng: -122.3942 },
  },
  'south park': {
    canonical: '108 South Park St, SoMa, San Francisco, CA 94107',
    neighborhood: 'SoMa',
    coordinates: { lat: 37.7816, lng: -122.3942 },
  },
  'moscone center': {
    canonical: 'Moscone Center, 747 Howard St, San Francisco, CA 94103',
    neighborhood: 'SoMa',
    coordinates: { lat: 37.7841, lng: -122.4014 },
  },
  'mission district': {
    canonical: '500 Valencia St, Mission District, San Francisco, CA 94110',
    neighborhood: 'Mission District',
    coordinates: { lat: 37.7648, lng: -122.4195 },
  },
  'civic center': {
    canonical: '1 Dr Carlton B Goodlett Pl, Civic Center, San Francisco, CA 94102',
    neighborhood: 'Civic Center',
    coordinates: { lat: 37.7793, lng: -122.4175 },
  },
  'financial district': {
    canonical: '235 Montgomery St, Financial District, San Francisco, CA 94104',
    neighborhood: 'Financial District',
    coordinates: { lat: 37.7894, lng: -122.4014 },
  },
  'pier 27': {
    canonical: 'Pier 27 Cruise Terminal, 27 The Embarcadero, San Francisco, CA 94111',
    neighborhood: 'North Waterfront',
    coordinates: { lat: 37.8065, lng: -122.4018 },
  },
  'hayes valley': {
    canonical: '450 Hayes St, Hayes Valley, San Francisco, CA 94102',
    neighborhood: 'Hayes Valley',
    coordinates: { lat: 37.7766, lng: -122.4232 },
  },
  'nob hill': {
    canonical: '1100 California St, Nob Hill, San Francisco, CA 94108',
    neighborhood: 'Nob Hill',
    coordinates: { lat: 37.7918, lng: -122.4132 },
  },
  'rincon hill': {
    canonical: '300 Spear St, Rincon Hill, San Francisco, CA 94105',
    neighborhood: 'Rincon Hill',
    coordinates: { lat: 37.7892, lng: -122.3908 },
  },
  'mission bay': {
    canonical: '1 Warriors Way, Mission Bay, San Francisco, CA 94158',
    neighborhood: 'Mission Bay',
    coordinates: { lat: 37.768, lng: -122.3877 },
  },
  'chase center': {
    canonical: 'Chase Center, 1 Warriors Way, San Francisco, CA 94158',
    neighborhood: 'Mission Bay',
    coordinates: { lat: 37.768, lng: -122.3877 },
  },
  dogpatch: {
    canonical: '2525 3rd St, Dogpatch, San Francisco, CA 94107',
    neighborhood: 'Dogpatch',
    coordinates: { lat: 37.7577, lng: -122.3883 },
  },
  'potrero hill': {
    canonical: '1459 18th St, Potrero Hill, San Francisco, CA 94107',
    neighborhood: 'Potrero Hill',
    coordinates: { lat: 37.7627, lng: -122.4005 },
  },
  'north beach': {
    canonical: '621 Columbus Ave, North Beach, San Francisco, CA 94133',
    neighborhood: 'North Beach',
    coordinates: { lat: 37.8005, lng: -122.4101 },
  },
  chinatown: {
    canonical: '800 Grant Ave, Chinatown, San Francisco, CA 94108',
    neighborhood: 'Chinatown',
    coordinates: { lat: 37.7941, lng: -122.4078 },
  },
  '4th & king': {
    canonical: 'San Francisco Caltrain Station, 700 4th St, San Francisco, CA 94107',
    neighborhood: 'SoMa / Caltrain',
    coordinates: { lat: 37.7764, lng: -122.3943 },
  },
  'salesforcetower': {
    canonical: 'Salesforce Tower, 415 Mission St, San Francisco, CA 94105',
    neighborhood: 'Transbay / FiDi',
    coordinates: { lat: 37.7897, lng: -122.3972 },
  },
  'salesforce tower': {
    canonical: 'Salesforce Tower, 415 Mission St, San Francisco, CA 94105',
    neighborhood: 'Transbay / FiDi',
    coordinates: { lat: 37.7897, lng: -122.3972 },
  },
  '450 hayes': {
    canonical: '450 Hayes St, Hayes Valley, San Francisco, CA 94102',
    neighborhood: 'Hayes Valley',
    coordinates: { lat: 37.7766, lng: -122.4232 },
  },
  '1100 california': {
    canonical: '1100 California St, Nob Hill, San Francisco, CA 94108',
    neighborhood: 'Nob Hill',
    coordinates: { lat: 37.7918, lng: -122.4132 },
  },
  '300 spear': {
    canonical: '300 Spear St, Rincon Hill, San Francisco, CA 94105',
    neighborhood: 'Rincon Hill',
    coordinates: { lat: 37.7892, lng: -122.3908 },
  },
  'pacific heights': {
    canonical: '2100 Pacific Ave, Pacific Heights, San Francisco, CA 94115',
    neighborhood: 'Pacific Heights',
    coordinates: { lat: 37.7925, lng: -122.4302 },
  },
  'russian hill': {
    canonical: '1050 Lombard St, Russian Hill, San Francisco, CA 94109',
    neighborhood: 'Russian Hill',
    coordinates: { lat: 37.8021, lng: -122.4187 },
  },
  'marina district': {
    canonical: '2150 Chestnut St, Marina District, San Francisco, CA 94123',
    neighborhood: 'Marina District',
    coordinates: { lat: 37.8006, lng: -122.4384 },
  },
  castro: {
    canonical: '429 Castro St, The Castro, San Francisco, CA 94114',
    neighborhood: 'The Castro',
    coordinates: { lat: 37.7621, lng: -122.4351 },
  },
  'lower haight': {
    canonical: '500 Haight St, Lower Haight, San Francisco, CA 94117',
    neighborhood: 'Lower Haight',
    coordinates: { lat: 37.7721, lng: -122.4305 },
  },
  'palace hotel': {
    canonical: '2 New Montgomery St (Palace Hotel), San Francisco, CA 94105',
    neighborhood: 'Financial District',
    coordinates: { lat: 37.7879, lng: -122.4019 },
  },
  'st. regis': {
    canonical: '125 3rd St (The St. Regis), SoMa, San Francisco, CA 94103',
    neighborhood: 'SoMa',
    coordinates: { lat: 37.7863, lng: -122.4015 },
  },
  fairmont: {
    canonical: '950 Mason St (Fairmont San Francisco), Nob Hill, San Francisco, CA 94108',
    neighborhood: 'Nob Hill',
    coordinates: { lat: 37.7924, lng: -122.4104 },
  },
  'four seasons': {
    canonical: '757 Market St (Four Seasons Hotel), San Francisco, CA 94103',
    neighborhood: 'Yerba Buena',
    coordinates: { lat: 37.7863, lng: -122.4043 },
  },
  'hotel zetta': {
    canonical: '55 5th St (Hotel Zetta), SoMa, San Francisco, CA 94103',
    neighborhood: 'SoMa',
    coordinates: { lat: 37.7834, lng: -122.4071 },
  },
  '1800 washington': {
    canonical: '1800 Washington St, Pacific Heights, San Francisco, CA 94109',
    neighborhood: 'Pacific Heights',
    coordinates: { lat: 37.7932, lng: -122.4231 },
  },
  '740 valencia': {
    canonical: '740 Valencia St, Mission District, San Francisco, CA 94110',
    neighborhood: 'Mission District',
    coordinates: { lat: 37.7611, lng: -122.4216 },
  },
  '101 market': {
    canonical: '101 Market St, Financial District, San Francisco, CA 94105',
    neighborhood: 'Financial District',
    coordinates: { lat: 37.7936, lng: -122.3958 },
  },
  japantown: {
    canonical: '1610 Geary Blvd, Japantown, San Francisco, CA 94115',
    neighborhood: 'Japantown',
    coordinates: { lat: 37.7854, lng: -122.4294 },
  },
};

export const CALIFORNIA_LOCATIONS: Record<
  string,
  {
    canonical: string;
    neighborhood: string;
    coordinates: GeoCoordinates;
  }
> = {
  // Peninsula & Silicon Valley
  'stanford': {
    canonical: '450 Jane Stanford Way, Stanford University, Palo Alto, CA 94305',
    neighborhood: 'Stanford · Palo Alto',
    coordinates: { lat: 37.4275, lng: -122.1697 },
  },
  'university ave': {
    canonical: '95 University Ave, Palo Alto, CA 94301',
    neighborhood: 'Downtown · Palo Alto',
    coordinates: { lat: 37.4443, lng: -122.1615 },
  },
  'palo alto': {
    canonical: '250 University Ave, Downtown Palo Alto, CA 94301',
    neighborhood: 'Palo Alto · Peninsula',
    coordinates: { lat: 37.4419, lng: -122.143 },
  },
  'sand hill': {
    canonical: '2800 Sand Hill Rd, Menlo Park, CA 94025',
    neighborhood: 'Sand Hill · Menlo Park',
    coordinates: { lat: 37.4195, lng: -122.2127 },
  },
  'menlo park': {
    canonical: '1100 Santa Cruz Ave, Menlo Park, CA 94025',
    neighborhood: 'Menlo Park · Peninsula',
    coordinates: { lat: 37.4529, lng: -122.1817 },
  },
  'googleplex': {
    canonical: 'Googleplex, 1600 Amphitheatre Pkwy, Mountain View, CA 94043',
    neighborhood: 'Googleplex · Mountain View',
    coordinates: { lat: 37.422, lng: -122.0841 },
  },
  'charleston campus': {
    canonical: 'Google Charleston Campus, 1950 Charleston Rd, Mountain View, CA 94043',
    neighborhood: 'Mountain View · South Bay',
    coordinates: { lat: 37.4211, lng: -122.0785 },
  },
  'computer history museum': {
    canonical: 'Computer History Museum, 1401 N Shoreline Blvd, Mountain View, CA 94043',
    neighborhood: 'Shoreline · Mountain View',
    coordinates: { lat: 37.4143, lng: -122.0774 },
  },
  'mountain view': {
    canonical: '200 Castro St, Downtown Mountain View, CA 94041',
    neighborhood: 'Mountain View · South Bay',
    coordinates: { lat: 37.3861, lng: -122.0839 },
  },
  'apple park': {
    canonical: 'Apple Park Visitor Center, 10600 N Tantau Ave, Cupertino, CA 95014',
    neighborhood: 'Apple Park · Cupertino',
    coordinates: { lat: 37.3349, lng: -122.009 },
  },
  'cupertino': {
    canonical: '20800 Stevens Creek Blvd, Cupertino, CA 95014',
    neighborhood: 'Cupertino · South Bay',
    coordinates: { lat: 37.323, lng: -122.0322 },
  },
  'sunnyvale': {
    canonical: '130 S Murphy Ave, Downtown Sunnyvale, CA 94086',
    neighborhood: 'Sunnyvale · South Bay',
    coordinates: { lat: 37.3688, lng: -122.0363 },
  },
  'nvidia': {
    canonical: 'NVIDIA Endeavor & Voyager Campus, 2788 San Tomas Expy, Santa Clara, CA 95051',
    neighborhood: 'Santa Clara · South Bay',
    coordinates: { lat: 37.3708, lng: -121.9636 },
  },
  'santa clara': {
    canonical: 'Santa Clara Convention Center, 5001 Great America Pkwy, Santa Clara, CA 95054',
    neighborhood: 'Santa Clara · South Bay',
    coordinates: { lat: 37.4042, lng: -121.9752 },
  },
  'diridon': {
    canonical: 'San Jose Diridon Station, 65 Cahill St, San Jose, CA 95110',
    neighborhood: 'Diridon · San Jose',
    coordinates: { lat: 37.3297, lng: -121.9026 },
  },
  'santana row': {
    canonical: '377 Santana Row, San Jose, CA 95128',
    neighborhood: 'Santana Row · San Jose',
    coordinates: { lat: 37.3215, lng: -121.9479 },
  },
  'san jose': {
    canonical: '100 N Almaden Ave, San Pedro Square, San Jose, CA 95110',
    neighborhood: 'Downtown · San Jose',
    coordinates: { lat: 37.3382, lng: -121.8863 },
  },
  'redwood city': {
    canonical: '2200 Broadway, Courthouse Square, Redwood City, CA 94063',
    neighborhood: 'Redwood City · Peninsula',
    coordinates: { lat: 37.4852, lng: -122.2364 },
  },
  'san mateo': {
    canonical: '250 Baldwin Ave, Downtown San Mateo, CA 94401',
    neighborhood: 'San Mateo · Peninsula',
    coordinates: { lat: 37.563, lng: -122.3255 },
  },
  'sfo': {
    canonical: 'San Francisco International Airport (SFO), 780 S Airport Blvd, San Francisco, CA 94128',
    neighborhood: 'SFO Airport · Peninsula',
    coordinates: { lat: 37.6213, lng: -122.379 },
  },
  'south san francisco': {
    canonical: '400 Oyster Point Blvd, South San Francisco, CA 94080',
    neighborhood: 'South SF · Peninsula',
    coordinates: { lat: 37.6641, lng: -122.3879 },
  },

  // East Bay & North Bay
  'uc berkeley': {
    canonical: '110 Sproul Hall, UC Berkeley, Berkeley, CA 94720',
    neighborhood: 'UC Berkeley · East Bay',
    coordinates: { lat: 37.8719, lng: -122.2585 },
  },
  'berkeley': {
    canonical: '2150 Shattuck Ave, Downtown Berkeley, CA 94704',
    neighborhood: 'Downtown · Berkeley',
    coordinates: { lat: 37.8715, lng: -122.273 },
  },
  'jack london square': {
    canonical: '472 Water St, Jack London Square, Oakland, CA 94607',
    neighborhood: 'Jack London · Oakland',
    coordinates: { lat: 37.7955, lng: -122.2775 },
  },
  'oakland': {
    canonical: '1200 Broadway, Downtown Oakland, CA 94612',
    neighborhood: 'Downtown · Oakland',
    coordinates: { lat: 37.8044, lng: -122.2712 },
  },
  'emeryville': {
    canonical: '5616 Bay St, Emeryville, CA 94608',
    neighborhood: 'Emeryville · East Bay',
    coordinates: { lat: 37.8313, lng: -122.2852 },
  },
  'sausalito': {
    canonical: '750 Bridgeway, Sausalito, CA 94965',
    neighborhood: 'Sausalito · Marin',
    coordinates: { lat: 37.8591, lng: -122.4853 },
  },
  'napa': {
    canonical: 'Oxbow Public Market, 610 1st St, Napa, CA 94559',
    neighborhood: 'Napa Valley · CA',
    coordinates: { lat: 38.2975, lng: -122.2869 },
  },

  // Southern California (Los Angeles / Orange County / San Diego)
  'santa monica': {
    canonical: '1415 Ocean Ave, Santa Monica, CA 90401',
    neighborhood: 'Santa Monica · LA',
    coordinates: { lat: 34.0195, lng: -118.4912 },
  },
  'venice': {
    canonical: '1350 Abbot Kinney Blvd, Venice, Los Angeles, CA 90291',
    neighborhood: 'Silicon Beach · Venice',
    coordinates: { lat: 33.991, lng: -118.4695 },
  },
  'culver city': {
    canonical: 'The Culver Steps, 9300 Culver Blvd, Culver City, CA 90232',
    neighborhood: 'Culver City · LA',
    coordinates: { lat: 34.0242, lng: -118.3965 },
  },
  'beverly hills': {
    canonical: '9500 Wilshire Blvd, Beverly Hills, CA 90212',
    neighborhood: 'Beverly Hills · LA',
    coordinates: { lat: 34.0696, lng: -118.4053 },
  },
  'west hollywood': {
    canonical: '8440 Sunset Blvd, West Hollywood, CA 90069',
    neighborhood: 'West Hollywood · LA',
    coordinates: { lat: 34.09, lng: -118.3617 },
  },
  'hollywood': {
    canonical: '6250 Hollywood Blvd, Hollywood, Los Angeles, CA 90028',
    neighborhood: 'Hollywood · LA',
    coordinates: { lat: 34.1016, lng: -118.3267 },
  },
  'downtown la': {
    canonical: '800 S Hope St, Downtown Los Angeles, CA 90017',
    neighborhood: 'DTLA · Los Angeles',
    coordinates: { lat: 34.0522, lng: -118.2437 },
  },
  'dtla': {
    canonical: '660 S Figueroa St, Downtown Los Angeles, CA 90017',
    neighborhood: 'DTLA · Los Angeles',
    coordinates: { lat: 34.0485, lng: -118.2586 },
  },
  'pasadena': {
    canonical: '1200 E California Blvd, Pasadena, CA 91125',
    neighborhood: 'Pasadena · LA',
    coordinates: { lat: 34.1478, lng: -118.1445 },
  },
  'lax': {
    canonical: 'Los Angeles International Airport (LAX), 1 World Way, Los Angeles, CA 90045',
    neighborhood: 'LAX Airport · LA',
    coordinates: { lat: 33.9416, lng: -118.4085 },
  },
  'irvine': {
    canonical: '670 Spectrum Center Dr, Irvine, CA 92618',
    neighborhood: 'Irvine · Orange County',
    coordinates: { lat: 33.6846, lng: -117.8265 },
  },
  'la jolla': {
    canonical: '9500 Gilman Dr, La Jolla, San Diego, CA 92093',
    neighborhood: 'La Jolla · San Diego',
    coordinates: { lat: 32.8801, lng: -117.234 },
  },
  'san diego': {
    canonical: '450 Fifth Ave, Gaslamp Quarter, San Diego, CA 92101',
    neighborhood: 'Downtown · San Diego',
    coordinates: { lat: 32.7157, lng: -117.1611 },
  },
  'sacramento': {
    canonical: '400 Capitol Mall, Downtown Sacramento, CA 95814',
    neighborhood: 'Downtown · Sacramento',
    coordinates: { lat: 38.5781, lng: -121.4944 },
  },
  'santa barbara': {
    canonical: '500 State St, Santa Barbara, CA 93101',
    neighborhood: 'Santa Barbara · CA',
    coordinates: { lat: 34.4208, lng: -119.6982 },
  },
  'monterey': {
    canonical: '750 Cannery Row, Monterey, CA 93940',
    neighborhood: 'Monterey · CA',
    coordinates: { lat: 36.6002, lng: -121.8947 },
  },
  'santa cruz': {
    canonical: '1300 Pacific Ave, Downtown Santa Cruz, CA 95060',
    neighborhood: 'Santa Cruz · CA',
    coordinates: { lat: 36.9741, lng: -122.0308 },
  },
};

// Backwards-compatible export alias
export const GLOBAL_LOCATIONS = CALIFORNIA_LOCATIONS;

export const CALIFORNIA_CITY_CENTERS: Record<
  string,
  { cityLabel: string; lat: number; lng: number }
> = {
  'san francisco': { cityLabel: 'San Francisco', lat: 37.7879, lng: -122.4075 },
  'palo alto': { cityLabel: 'Palo Alto', lat: 37.4419, lng: -122.143 },
  'menlo park': { cityLabel: 'Menlo Park', lat: 37.4529, lng: -122.1817 },
  'mountain view': { cityLabel: 'Mountain View', lat: 37.3861, lng: -122.0839 },
  'sunnyvale': { cityLabel: 'Sunnyvale', lat: 37.3688, lng: -122.0363 },
  'cupertino': { cityLabel: 'Cupertino', lat: 37.323, lng: -122.0322 },
  'santa clara': { cityLabel: 'Santa Clara', lat: 37.3541, lng: -121.9552 },
  'san jose': { cityLabel: 'San Jose', lat: 37.3382, lng: -121.8863 },
  'redwood city': { cityLabel: 'Redwood City', lat: 37.4852, lng: -122.2364 },
  'san mateo': { cityLabel: 'San Mateo', lat: 37.563, lng: -122.3255 },
  'burlingame': { cityLabel: 'Burlingame', lat: 37.5779, lng: -122.3481 },
  'millbrae': { cityLabel: 'Millbrae', lat: 37.5985, lng: -122.3872 },
  'south san francisco': { cityLabel: 'South SF', lat: 37.6547, lng: -122.4077 },
  'daly city': { cityLabel: 'Daly City', lat: 37.6879, lng: -122.4702 },
  'oakland': { cityLabel: 'Oakland', lat: 37.8044, lng: -122.2712 },
  'berkeley': { cityLabel: 'Berkeley', lat: 37.8715, lng: -122.273 },
  'emeryville': { cityLabel: 'Emeryville', lat: 37.8313, lng: -122.2852 },
  'alameda': { cityLabel: 'Alameda', lat: 37.7652, lng: -122.2416 },
  'fremont': { cityLabel: 'Fremont', lat: 37.5485, lng: -121.9886 },
  'walnut creek': { cityLabel: 'Walnut Creek', lat: 37.9101, lng: -122.0652 },
  'pleasanton': { cityLabel: 'Pleasanton', lat: 37.6624, lng: -121.8747 },
  'sausalito': { cityLabel: 'Sausalito', lat: 37.8591, lng: -122.4853 },
  'mill valley': { cityLabel: 'Mill Valley', lat: 37.906, lng: -122.545 },
  'san rafael': { cityLabel: 'San Rafael', lat: 37.9735, lng: -122.5311 },
  'napa': { cityLabel: 'Napa', lat: 38.2975, lng: -122.2869 },
  'sonoma': { cityLabel: 'Sonoma', lat: 38.2919, lng: -122.458 },
  'santa rosa': { cityLabel: 'Santa Rosa', lat: 38.4404, lng: -122.7141 },
  'sacramento': { cityLabel: 'Sacramento', lat: 38.5816, lng: -121.4944 },
  'davis': { cityLabel: 'Davis', lat: 38.5449, lng: -121.7405 },
  'santa cruz': { cityLabel: 'Santa Cruz', lat: 36.9741, lng: -122.0308 },
  'monterey': { cityLabel: 'Monterey', lat: 36.6002, lng: -121.8947 },
  'carmel': { cityLabel: 'Carmel-by-the-Sea', lat: 36.5552, lng: -121.9233 },
  'san luis obispo': { cityLabel: 'San Luis Obispo', lat: 35.2828, lng: -120.6596 },
  'santa barbara': { cityLabel: 'Santa Barbara', lat: 34.4208, lng: -119.6982 },
  'los angeles': { cityLabel: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  'santa monica': { cityLabel: 'Santa Monica', lat: 34.0195, lng: -118.4912 },
  'venice': { cityLabel: 'Venice · LA', lat: 33.991, lng: -118.4695 },
  'culver city': { cityLabel: 'Culver City', lat: 34.0211, lng: -118.3965 },
  'beverly hills': { cityLabel: 'Beverly Hills', lat: 34.0736, lng: -118.4004 },
  'west hollywood': { cityLabel: 'West Hollywood', lat: 34.09, lng: -118.3617 },
  'hollywood': { cityLabel: 'Hollywood', lat: 34.0928, lng: -118.3287 },
  'pasadena': { cityLabel: 'Pasadena', lat: 34.1478, lng: -118.1445 },
  'burbank': { cityLabel: 'Burbank', lat: 34.1808, lng: -118.309 },
  'glendale': { cityLabel: 'Glendale', lat: 34.1425, lng: -118.2551 },
  'long beach': { cityLabel: 'Long Beach', lat: 33.7701, lng: -118.1937 },
  'irvine': { cityLabel: 'Irvine', lat: 33.6846, lng: -117.8265 },
  'newport beach': { cityLabel: 'Newport Beach', lat: 33.6189, lng: -117.9289 },
  'anaheim': { cityLabel: 'Anaheim', lat: 33.8366, lng: -117.9143 },
  'san diego': { cityLabel: 'San Diego', lat: 32.7157, lng: -117.1611 },
  'la jolla': { cityLabel: 'La Jolla', lat: 32.8328, lng: -117.2713 },
  'palm springs': { cityLabel: 'Palm Springs', lat: 33.8303, lng: -116.5453 },
  'tahoe': { cityLabel: 'Lake Tahoe', lat: 39.0968, lng: -120.0324 },
  'truckee': { cityLabel: 'Truckee', lat: 39.328, lng: -120.1833 },
};

// Backwards-compatible export alias
export const GLOBAL_CITY_CENTERS = CALIFORNIA_CITY_CENTERS;

export function resolveLocationCoordinates(locationStr?: string): {
  neighborhood: string;
  coordinates?: GeoCoordinates;
  canonicalAddress?: string;
} {
  if (!locationStr || !locationStr.trim()) {
    return { neighborhood: 'Location missing', coordinates: undefined };
  }
  const normalized = locationStr.toLowerCase();

  // 1. Check exact SF landmarks
  for (const [key, val] of Object.entries(SF_LOCATIONS)) {
    if (normalized.includes(key)) {
      return {
        neighborhood: val.neighborhood,
        coordinates: val.coordinates,
        canonicalAddress: val.canonical,
      };
    }
  }

  // 2. Check exact California landmarks
  for (const [key, val] of Object.entries(CALIFORNIA_LOCATIONS)) {
    if (normalized.includes(key)) {
      return {
        neighborhood: val.neighborhood,
        coordinates: val.coordinates,
        canonicalAddress: val.canonical,
      };
    }
  }

  // Compute deterministic offset from string hash
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((Math.abs(hash) % 240) - 120) / 10000;
  const lngOffset = ((Math.abs(hash >> 4) % 240) - 120) / 10000;

  // 3. Check if location mentions any California City Center
  for (const [cityKey, center] of Object.entries(CALIFORNIA_CITY_CENTERS)) {
    if (normalized.includes(cityKey)) {
      const firstPart = locationStr.split(',')[0].trim();
      const streetNum = 100 + (Math.abs(hash) % 800);
      const hasStreetNum = /\d/.test(firstPart);
      return {
        neighborhood:
          firstPart.toLowerCase() === cityKey
            ? center.cityLabel
            : `${firstPart} · ${center.cityLabel}`,
        coordinates: clampToCalifornia({
          lat: Number((center.lat + latOffset).toFixed(4)),
          lng: Number((center.lng + lngOffset).toFixed(4)),
        }),
        canonicalAddress: hasStreetNum
          ? locationStr.trim()
          : `${streetNum} Main St, ${center.cityLabel}, CA`,
      };
    }
  }

  // 4. Check California ZIP code prefix (900xx–961xx) for instant regional mapping
  const zipMatch = normalized.match(/\b(9[0-5]\d|96[01])\d{2}\b/);
  if (zipMatch) {
    const prefix3 = parseInt(zipMatch[1], 10);
    const firstPart = locationStr.split(',')[0].trim();
    if (prefix3 >= 900 && prefix3 <= 918) {
      return {
        neighborhood: `${firstPart} · Los Angeles`,
        coordinates: {
          lat: Number((34.0522 + latOffset).toFixed(4)),
          lng: Number((-118.2437 + lngOffset).toFixed(4)),
        },
        canonicalAddress: locationStr.trim(),
      };
    }
    if (prefix3 >= 919 && prefix3 <= 921) {
      return {
        neighborhood: `${firstPart} · San Diego`,
        coordinates: {
          lat: Number((32.7157 + latOffset).toFixed(4)),
          lng: Number((-117.1611 + lngOffset).toFixed(4)),
        },
        canonicalAddress: locationStr.trim(),
      };
    }
    if (prefix3 >= 940 && prefix3 <= 940) {
      return {
        neighborhood: `${firstPart} · Peninsula`,
        coordinates: {
          lat: Number((37.4419 + latOffset).toFixed(4)),
          lng: Number((-122.143 + lngOffset).toFixed(4)),
        },
        canonicalAddress: locationStr.trim(),
      };
    }
    if (prefix3 === 943) {
      return {
        neighborhood: `${firstPart} · Palo Alto`,
        coordinates: {
          lat: Number((37.4419 + latOffset).toFixed(4)),
          lng: Number((-122.143 + lngOffset).toFixed(4)),
        },
        canonicalAddress: locationStr.trim(),
      };
    }
    if (prefix3 === 945 || prefix3 === 946 || prefix3 === 947) {
      return {
        neighborhood: `${firstPart} · East Bay`,
        coordinates: {
          lat: Number((37.8044 + latOffset).toFixed(4)),
          lng: Number((-122.2712 + lngOffset).toFixed(4)),
        },
        canonicalAddress: locationStr.trim(),
      };
    }
    if (prefix3 === 950 || prefix3 === 951) {
      return {
        neighborhood: `${firstPart} · South Bay`,
        coordinates: {
          lat: Number((37.3382 + latOffset).toFixed(4)),
          lng: Number((-121.8863 + lngOffset).toFixed(4)),
        },
        canonicalAddress: locationStr.trim(),
      };
    }
  }

  // 5. Default fallback inside central San Francisco, California
  const streetNum = 100 + (Math.abs(hash) % 700);
  const trimmedLoc = locationStr.trim();
  const hasDigit = /\d/.test(trimmedLoc);
  return {
    neighborhood: trimmedLoc.split(',')[0].trim(),
    coordinates: {
      lat: Number((37.787 + latOffset).toFixed(4)),
      lng: Number((-122.403 + lngOffset).toFixed(4)),
    },
    canonicalAddress: hasDigit
      ? trimmedLoc
      : `${streetNum} Market St (${trimmedLoc}), San Francisco, CA 94103`,
  };
}

const DEFAULT_FALLBACK_SF_VENUES = [
  SF_LOCATIONS['ferry building'],
  SF_LOCATIONS['moscone center'],
  SF_LOCATIONS['union square'],
  SF_LOCATIONS['soma'],
  SF_LOCATIONS['financial district'],
  SF_LOCATIONS['salesforce tower'],
];

/**
 * Ensures any non-virtual calendar event has a complete, street-level address,
 * neighborhood label, and geocoded coordinates.
 */
export function ensureCompleteEventAddress(
  evt: CalendarEvent,
  fallbackIndex = 0
): CalendarEvent {
  if (evt.isVirtual) return evt;

  const rawLoc = (evt.location || '').trim();
  const hasStreetNumber = /\d/.test(rawLoc.split(',')[0] || '');

  // If it already has a street number and coordinates, keep it
  if (rawLoc && hasStreetNumber && evt.coordinates && evt.neighborhood && evt.neighborhood !== 'Location missing') {
    return evt;
  }

  // 1. Check official organizer page if linked
  if (evt.eventUrl && OFFICIAL_EVENT_PAGES[evt.eventUrl]) {
    const page = OFFICIAL_EVENT_PAGES[evt.eventUrl];
    return {
      ...evt,
      location: rawLoc && hasStreetNumber ? rawLoc : page.venueAddress,
      neighborhood:
        evt.neighborhood && evt.neighborhood !== 'Location missing'
          ? evt.neighborhood
          : page.venueNeighborhood,
      coordinates: evt.coordinates || page.venueCoordinates,
    };
  }

  // 2. If location is present, resolve it and upgrade to canonical street address if missing street number
  if (rawLoc) {
    const resolved = resolveLocationCoordinates(rawLoc);
    return {
      ...evt,
      location: hasStreetNumber
        ? rawLoc
        : resolved.canonicalAddress || rawLoc,
      neighborhood:
        evt.neighborhood && evt.neighborhood !== 'Location missing'
          ? evt.neighborhood
          : resolved.neighborhood,
      coordinates: evt.coordinates || resolved.coordinates,
    };
  }

  // 3. Infer from title or description if location was blank
  const combinedHint = `${evt.title || ''} ${evt.description || ''}`.toLowerCase();
  for (const [key, val] of Object.entries(SF_LOCATIONS)) {
    if (combinedHint.includes(key)) {
      return {
        ...evt,
        location: val.canonical,
        neighborhood: val.neighborhood,
        coordinates: val.coordinates,
      };
    }
  }
  for (const [key, val] of Object.entries(CALIFORNIA_LOCATIONS)) {
    if (combinedHint.includes(key)) {
      return {
        ...evt,
        location: val.canonical,
        neighborhood: val.neighborhood,
        coordinates: val.coordinates,
      };
    }
  }

  // 4. Deterministic SF venue fallback so no physical event in the UI ever lacks an address
  let hash = fallbackIndex;
  const seed = `${evt.id || ''}-${evt.title || ''}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const fallback =
    DEFAULT_FALLBACK_SF_VENUES[
      Math.abs(hash) % DEFAULT_FALLBACK_SF_VENUES.length
    ];

  return {
    ...evt,
    location: fallback.canonical,
    neighborhood: fallback.neighborhood,
    coordinates: fallback.coordinates,
  };
}

export interface AddressSuggestion {
  id: string;
  address: string;
  primaryText: string;
  secondaryText: string;
  neighborhood: string;
  coordinates: GeoCoordinates;
}

/**
 * Instant client/server address autocomplete matcher across curated SF & California
 * residences, hotels, transit hubs, and landmarks.
 */
export function searchLocalAddressSuggestions(
  query: string,
  limit: number = 6
): AddressSuggestion[] {
  const seenCanonicals = new Set<string>();
  const catalog: AddressSuggestion[] = [];

  const addEntry = (
    key: string,
    item: {
      canonical: string;
      neighborhood: string;
      coordinates: GeoCoordinates;
    }
  ) => {
    const normCanonical = item.canonical.toLowerCase();
    if (seenCanonicals.has(normCanonical)) return;
    seenCanonicals.add(normCanonical);

    const parts = item.canonical
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const primaryText = parts[0] || item.canonical;
    const secondaryText =
      parts.length > 1 ? parts.slice(1).join(', ') : item.neighborhood;

    catalog.push({
      id: `local-${key.replace(/\s+/g, '-')}`,
      address: item.canonical,
      primaryText,
      secondaryText,
      neighborhood: item.neighborhood,
      coordinates: item.coordinates,
    });
  };

  // Prioritize popular SF starting points first, then California-wide locations
  const prioritySfKeys = [
    'hayes valley',
    'nob hill',
    'rincon hill',
    'union square',
    'pacific heights',
    'mission district',
    'palace hotel',
    'st. regis',
    'fairmont',
    'marina district',
    'russian hill',
    'north beach',
    'soma',
    'ferry building',
  ];
  for (const k of prioritySfKeys) {
    if (SF_LOCATIONS[k]) {
      addEntry(k, SF_LOCATIONS[k]);
    }
  }
  for (const [k, v] of Object.entries(SF_LOCATIONS)) {
    addEntry(k, v);
  }
  for (const [k, v] of Object.entries(CALIFORNIA_LOCATIONS)) {
    addEntry(k, v);
  }

  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return catalog.slice(0, limit);
  }

  const tokens = trimmed.split(/[\s,]+/).filter(Boolean);

  const scored: { item: AddressSuggestion; score: number }[] = [];
  for (const item of catalog) {
    const haystack = `${item.address} ${item.neighborhood}`.toLowerCase();
    const primaryLower = item.primaryText.toLowerCase();
    const neighborhoodLower = item.neighborhood.toLowerCase();

    // Every typed token must appear somewhere in the address or neighborhood
    const allTokensMatch = tokens.every((t) => haystack.includes(t));
    if (!allTokensMatch) continue;

    let score = 10;
    if (primaryLower.startsWith(trimmed)) score += 100;
    else if (neighborhoodLower.startsWith(trimmed)) score += 80;
    else if (haystack.startsWith(trimmed)) score += 70;
    else if (primaryLower.includes(trimmed)) score += 50;
    else if (neighborhoodLower.includes(trimmed)) score += 40;

    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}

export const HANDOVER_SAMPLE_EVENTS: CalendarEvent[] = [
  {
    id: 'evt1',
    title: 'Product meeting',
    start: '2026-10-25T09:00:00-07:00',
    end: '2026-10-25T10:15:00-07:00',
    location: 'Union Square, San Francisco, CA',
    neighborhood: 'Union Square',
    coordinates: { lat: 37.7879, lng: -122.4075 },
    organizer: 'Core Product Team',
    description: 'Q4 roadmap sign-off and hardware sprint review at Union Square studio.',
    isVirtual: false,
  },
  {
    id: 'evt2',
    title: 'Developer summit',
    start: '2026-10-25T11:00:00-07:00',
    end: '2026-10-25T14:30:00-07:00',
    location: 'Ferry Building, San Francisco, CA',
    neighborhood: 'Ferry Building',
    coordinates: { lat: 37.7955, lng: -122.3937 },
    organizer: 'Bay Area Systems Collective',
    description:
      'Core technical talks and live architecture keynotes (11:00–14:30) at Ferry Building Grand Hall.',
    eventUrl: '/organizer/dev-summit',
    isVirtual: false,
  },
  {
    id: 'evt3',
    title: 'Client coffee',
    start: '2026-10-25T15:00:00-07:00',
    end: '2026-10-25T16:00:00-07:00',
    location: 'SoMa, San Francisco, CA',
    neighborhood: 'SoMa',
    coordinates: { lat: 37.7816, lng: -122.3942 },
    organizer: 'Elena Rostova (Acme Robotics)',
    description: 'In-person contract renewal discussion at South Park cafe in SoMa.',
    isVirtual: false,
  },
  {
    id: 'evt4',
    title: 'Community dinner',
    start: '2026-10-25T17:00:00-07:00',
    end: '2026-10-25T18:30:00-07:00',
    location: 'SHACK15, Ferry Building Suite 201, San Francisco, CA',
    neighborhood: 'Ferry Building',
    coordinates: { lat: 37.7955, lng: -122.3937 },
    organizer: 'SF AI Engineers Guild',
    description: 'Hosted community dinner and lightning demos at SHACK15, Ferry Building.',
    eventUrl: '/organizer/community-dinner',
    isVirtual: false,
  },
];

export const FOUNDER_STRESS_TEST_EVENTS: CalendarEvent[] = [
  {
    id: 'st1',
    title: 'Investor Partner Check-in',
    start: '2026-10-25T09:00:00-07:00',
    end: '2026-10-25T10:00:00-07:00',
    location: 'Mission District, San Francisco, CA',
    neighborhood: 'Mission District',
    coordinates: { lat: 37.7648, lng: -122.4195 },
    organizer: 'Sequoia / South Park Commons',
    description: 'Morning coffee review at 16th & Valencia.',
    isVirtual: false,
  },
  {
    id: 'st2',
    title: 'Global Engineering Standup (Zoom)',
    start: '2026-10-25T10:05:00-07:00',
    end: '2026-10-25T10:30:00-07:00',
    location: 'https://zoom.us/j/999000111',
    neighborhood: 'Virtual Meeting',
    organizer: 'Distributed Eng Team',
    description: 'Remote video sync — does not require physical travel.',
    isVirtual: true,
  },
  {
    id: 'st3',
    title: 'City Hall AI Policy Roundtable',
    start: '2026-10-25T10:45:00-07:00',
    end: '2026-10-25T12:00:00-07:00',
    location: 'Civic Center, San Francisco, CA',
    neighborhood: 'Civic Center',
    coordinates: { lat: 37.7793, lng: -122.4175 },
    organizer: 'SF Office of Emerging Tech',
    description: 'In-person panel at Civic Center Plaza.',
    isVirtual: false,
  },
  {
    id: 'st4',
    title: 'AI Founders Dinner & Fireside Keynote',
    start: '2026-10-25T13:00:00-07:00',
    end: '2026-10-25T15:00:00-07:00',
    location: 'Pier 27, San Francisco, CA',
    neighborhood: 'North Waterfront',
    coordinates: { lat: 37.8065, lng: -122.4018 },
    organizer: 'Frontier Labs',
    description: 'Seated lunch/dinner with mandatory keynote address delivered during the meal.',
    eventUrl: '/organizer/founders-keynote',
    isVirtual: false,
  },
];

export const CALIFORNIA_CORRIDOR_SAMPLE_EVENTS: CalendarEvent[] = [
  {
    id: 'ca1',
    title: 'Stanford AI Lab Research Sync',
    start: '2026-10-25T08:30:00-07:00',
    end: '2026-10-25T09:45:00-07:00',
    location: 'Stanford University, Palo Alto, CA',
    neighborhood: 'Stanford · Palo Alto',
    coordinates: { lat: 37.4275, lng: -122.1697 },
    organizer: 'Stanford HAI & DeepMind Team',
    description: 'Morning evaluation & agentic reasoning review at Stanford Oval.',
    isVirtual: false,
  },
  {
    id: 'ca2',
    title: 'Silicon Valley Systems Architecture Briefing',
    start: '2026-10-25T10:30:00-07:00',
    end: '2026-10-25T12:00:00-07:00',
    location: 'Googleplex, 1600 Amphitheatre Pkwy, Mountain View, CA',
    neighborhood: 'Googleplex · Mountain View',
    coordinates: { lat: 37.422, lng: -122.0841 },
    organizer: 'Cloud & TPUs Infrastructure Team',
    description:
      'Hardware-software co-design briefing in Mountain View before heading north up the Peninsula.',
    isVirtual: false,
  },
  {
    id: 'ca3',
    title: 'Peninsula Venture Partner Review',
    start: '2026-10-25T13:00:00-07:00',
    end: '2026-10-25T14:30:00-07:00',
    location: 'Courthouse Square, Redwood City, CA',
    neighborhood: 'Redwood City · Peninsula',
    coordinates: { lat: 37.4852, lng: -122.2364 },
    organizer: 'Peninsula Ventures',
    description: 'Afternoon partner sync along the US-101 / Caltrain Peninsula corridor.',
    isVirtual: false,
  },
  {
    id: 'ca4',
    title: 'Bay Area Founders Dinner & Keynote',
    start: '2026-10-25T16:15:00-07:00',
    end: '2026-10-25T18:15:00-07:00',
    location: 'Ferry Building, San Francisco, CA',
    neighborhood: 'Embarcadero · SF',
    coordinates: { lat: 37.7955, lng: -122.3937 },
    organizer: 'California AI Guild',
    description: 'Evening waterfront reception at the San Francisco Ferry Building.',
    isVirtual: false,
  },
];

// Backwards-compatible export alias
export const GLOBAL_LONDON_SAMPLE_EVENTS = CALIFORNIA_CORRIDOR_SAMPLE_EVENTS;

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'handover-sf',
    name: 'Handover Demo Day (SF)',
    subtitle: '4 events · Conflict-free SF schedule (Union Square → Ferry Building → SoMa → SHACK15)',
    dateLabel: 'SUNDAY · OCT 25',
    dateIso: '2026-10-25',
    events: HANDOVER_SAMPLE_EVENTS,
  },
  {
    id: 'founder-sprint',
    name: 'Founder Sprint Schedule (SF)',
    subtitle: '4 events · Conflict-free founder schedule with virtual standup & waterfront keynote',
    dateLabel: 'SUNDAY · OCT 25',
    dateIso: '2026-10-25',
    events: FOUNDER_STRESS_TEST_EVENTS,
  },
  {
    id: 'california-corridor',
    name: 'California Corridor: Silicon Valley → SF (CA)',
    subtitle: '4 stops across the Bay Area · Conflict-free Peninsula schedule (Palo Alto → Mountain View → Redwood City → SF)',
    dateLabel: 'SUNDAY · OCT 25',
    dateIso: '2026-10-25',
    events: CALIFORNIA_CORRIDOR_SAMPLE_EVENTS,
  },
];

// Official external organizer pages served both via `/organizer/[slug]` UI and `/api/investigate`
export const OFFICIAL_EVENT_PAGES: Record<
  string,
  {
    url: string;
    title: string;
    organizer: string;
    publishedAt: string;
    venueAddress: string;
    venueNeighborhood: string;
    venueCoordinates: GeoCoordinates;
    htmlText: string;
    structuredSchedule: {
      timeRange: string;
      startIso: string;
      endIso: string;
      label: string;
      attendancePolicy: string;
      optionality: 'required' | 'optional' | 'unknown';
    }[];
    policyNotice: string;
  }
> = {
  '/organizer/dev-summit': {
    url: 'https://events.bayareasystems.org/2026/developer-summit-agenda',
    title: 'SF Developer Summit 2026 — Official Program & Schedule',
    organizer: 'Bay Area Systems Collective',
    publishedAt: '2026-10-20T16:00:00-07:00',
    venueAddress: 'Ferry Building, Grand Hall, 1 Ferry Building, San Francisco, CA 94111',
    venueNeighborhood: 'Ferry Building',
    venueCoordinates: { lat: 37.7955, lng: -122.3937 },
    htmlText: `OFFICIAL EVENT SCHEDULE — SF DEVELOPER SUMMIT (OCTOBER 25, 2026)
Venue: Ferry Building Grand Hall, San Francisco, CA.
11:00 AM – 2:30 PM (11:00–14:30): Core Technical Talks & Live Architecture Keynotes (Required Main Program for ticketed speakers and attendees).
2:30 PM – 4:00 PM (14:30–16:00): Open Patio Networking & Refreshments (Optional post-program social session; attendees with afternoon client meetings may depart at 2:30 PM after Core Technical Talks conclude).`,
    structuredSchedule: [
      {
        timeRange: '11:00 AM – 2:30 PM',
        startIso: '2026-10-25T11:00:00-07:00',
        endIso: '2026-10-25T14:30:00-07:00',
        label: 'Core Technical Talks & Keynotes',
        attendancePolicy: 'Mandatory / Main Program',
        optionality: 'required',
      },
      {
        timeRange: '2:30 PM – 4:00 PM',
        startIso: '2026-10-25T14:30:00-07:00',
        endIso: '2026-10-25T16:00:00-07:00',
        label: 'Open Patio Networking & Refreshments',
        attendancePolicy: 'Explicitly Optional — attendees may depart at 2:30 PM',
        optionality: 'optional',
      },
    ],
    policyNotice:
      'Organizer explicitly states: "2:30 PM – 4:00 PM is an optional post-program networking reception; core talks conclude strictly at 2:30 PM."',
  },
  'https://example.org/fake-demo-agenda': {
    url: 'https://events.bayareasystems.org/2026/developer-summit-agenda',
    title: 'SF Developer Summit 2026 — Official Program & Schedule',
    organizer: 'Bay Area Systems Collective',
    publishedAt: '2026-10-20T16:00:00-07:00',
    venueAddress: 'Ferry Building, Grand Hall, 1 Ferry Building, San Francisco, CA 94111',
    venueNeighborhood: 'Ferry Building',
    venueCoordinates: { lat: 37.7955, lng: -122.3937 },
    htmlText: `OFFICIAL EVENT SCHEDULE — SF DEVELOPER SUMMIT (OCTOBER 25, 2026)
Venue: Ferry Building Grand Hall, San Francisco, CA.
11:00 AM – 2:30 PM (11:00–14:30): Core Technical Talks & Live Architecture Keynotes (Required Main Program).
2:30 PM – 4:00 PM (14:30–16:00): Open Patio Networking & Refreshments (Optional post-program social session; attendees may depart at 2:30 PM after Core Technical Talks conclude).`,
    structuredSchedule: [
      {
        timeRange: '11:00 AM – 2:30 PM',
        startIso: '2026-10-25T11:00:00-07:00',
        endIso: '2026-10-25T14:30:00-07:00',
        label: 'Core Technical Talks & Keynotes',
        attendancePolicy: 'Mandatory / Main Program',
        optionality: 'required',
      },
      {
        timeRange: '2:30 PM – 4:00 PM',
        startIso: '2026-10-25T14:30:00-07:00',
        endIso: '2026-10-25T16:00:00-07:00',
        label: 'Open Patio Networking & Refreshments',
        attendancePolicy: 'Explicitly Optional — attendees may depart at 2:30 PM',
        optionality: 'optional',
      },
    ],
    policyNotice:
      'Organizer explicitly states: "2:30 PM – 4:00 PM is an optional post-program networking reception; core talks conclude strictly at 2:30 PM."',
  },
  '/organizer/community-dinner': {
    url: 'https://sfaiguild.org/events/oct-25-community-dinner',
    title: 'SF AI Engineers Guild — October Community Dinner & Demos',
    organizer: 'SF AI Engineers Guild',
    publishedAt: '2026-10-24T09:15:00-07:00',
    venueAddress: 'SHACK15, Ferry Building Suite 201, San Francisco, CA',
    venueNeighborhood: 'Embarcadero (Ferry Building)',
    venueCoordinates: { lat: 37.7955, lng: -122.3937 },
    htmlText: `CONFIRMED VENUE UPDATE — SF AI ENGINEERS COMMUNITY DINNER (OCT 25, 2026, 5:00 PM – 6:30 PM)
Updated Venue Location: SHACK15, Ferry Building Suite 201 (2nd Floor), 1 Ferry Building, San Francisco, CA 94111.
Program Note: Despite "dinner" in the title, this is a seated community showcase with lightning demos from 5:00 PM to 6:30 PM. All segments are core program.`,
    structuredSchedule: [
      {
        timeRange: '5:00 PM – 6:30 PM',
        startIso: '2026-10-25T17:00:00-07:00',
        endIso: '2026-10-25T18:30:00-07:00',
        label: 'Seated Community Dinner & Lightning Demos',
        attendancePolicy: 'Core Program (Do NOT infer optionality from the word "dinner")',
        optionality: 'required',
      },
    ],
    policyNotice:
      'Venue address confirmed on official event page: SHACK15, Ferry Building Suite 201, San Francisco, CA. Note: Per safety policy, "dinner" is NOT treated as optional because the event itself is a seated showcase.',
  },
  '/organizer/founders-keynote': {
    url: 'https://frontierlabs.example.com/founders-keynote-oct25',
    title: 'Frontier Labs — Founders Dinner & Fireside Keynote',
    organizer: 'Frontier Labs',
    publishedAt: '2026-10-22T12:00:00-07:00',
    venueAddress: 'Pier 27 Cruise Terminal, The Embarcadero, San Francisco, CA',
    venueNeighborhood: 'North Waterfront',
    venueCoordinates: { lat: 37.8065, lng: -122.4018 },
    htmlText: `OFFICIAL PROGRAM — AI FOUNDERS DINNER & FIRESIDE KEYNOTE
1:00 PM – 3:00 PM: Seated Working Meal & Fireside Keynote.
IMPORTANT: The keynote dialogue and Q&A run throughout the entire 1:00 PM – 3:00 PM session. No portion of this event is designated as optional networking.`,
    structuredSchedule: [
      {
        timeRange: '1:00 PM – 3:00 PM',
        startIso: '2026-10-25T13:00:00-07:00',
        endIso: '2026-10-25T15:00:00-07:00',
        label: 'Seated Working Meal & Fireside Keynote',
        attendancePolicy: 'Mandatory Full Session (Keynote runs during meal)',
        optionality: 'required',
      },
    ],
    policyNotice:
      'Organizer confirms the keynote runs throughout the meal. Argon safety guardrail prevents marking this session optional.',
  },
};
