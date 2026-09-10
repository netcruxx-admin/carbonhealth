'use client';

/**
 * AddressSearch
 *
 * The shared address lookup for every address form (hospital onboarding, edit
 * hospital, hospital settings, patient profile). It is NOT bound to
 * `addressLine1` — it is its own search box plus a "Detect location" button, and
 * on a pick (or a detected position) it writes the sibling Formik fields:
 *
 *   addressLine1, addressLine2, city, district, state, pincode, country
 *
 * Uses the current Places API — `AutocompleteSuggestion.fetchAutocompleteSuggestions`
 * and `Place.fetchFields` — rather than the deprecated `places.Autocomplete`
 * widget. When a picked place is missing the finer parts (PIN code and district
 * are the usual gaps on a locality-level result) it reverse-geocodes the place's
 * coordinates and fills only the blanks, which is what makes those two reliable.
 *
 * Renders nothing when NEXT_PUBLIC_GOOGLE_PLACES_API_KEY is unset: there is then
 * no service to search with, and the manual fields below stand on their own.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormikContext } from 'formik';
import { AlertCircle, Loader2, LocateFixed, Search } from 'lucide-react';

const ADDRESS_FIELDS = [
  'addressLine1',
  'addressLine2',
  'city',
  'district',
  'state',
  'pincode',
  'country',
] as const;

interface ParsedAddress {
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
  formattedAddress: string;
}

const EMPTY: ParsedAddress = {
  addressLine1: '',
  addressLine2: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
  country: '',
  formattedAddress: '',
};

// --- script loader (one tag per page, shared across mounts) -----------------

let mapsPromise: Promise<void> | null = null;

// Global the Maps bootstrap calls back into once the API core is ready.
const READY_CALLBACK = '__carbonGmapsReady';

function loadMaps(apiKey: string): Promise<void> {
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Maps can only load in the browser'));
      return;
    }
    // `importLibrary` is what every caller below actually needs. It is attached
    // by the async bootstrap *after* the script tag's `load` event fires, so
    // resolving on `load` (or on a bare `window.google.maps`) races the first
    // importLibrary() call and makes the first search/detect throw. Gate on the
    // function itself, and let the `callback=` param below tell us when it lands.
    if (typeof window.google?.maps?.importLibrary === 'function') {
      resolve();
      return;
    }

    (window as unknown as Record<string, () => void>)[READY_CALLBACK] = () => {
      try {
        delete (window as unknown as Record<string, unknown>)[READY_CALLBACK];
      } catch {
        (window as unknown as Record<string, unknown>)[READY_CALLBACK] = undefined;
      }
      resolve();
    };

    const fail = (script?: HTMLScriptElement) => {
      script?.remove();
      mapsPromise = null;
      reject(new Error('Google Maps failed to load'));
    };

    const existing = document.getElementById('gmaps-js') as HTMLScriptElement | null;
    if (existing) {
      // A tag is already in flight (added by an earlier mount). The shared
      // `callback=` above still fires for it; only wire up the error path.
      existing.addEventListener('error', () => fail(existing));
      return;
    }

    const script = document.createElement('script');
    script.id = 'gmaps-js';
    script.async = true;
    // No `libraries=` — each library is pulled on demand via importLibrary(),
    // which is the sanctioned path for the current Places API. `callback=`
    // resolves this promise only once the API core (and importLibrary) is ready.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&loading=async&callback=${READY_CALLBACK}`;
    script.onerror = () => fail(script);
    document.head.appendChild(script);
  });
  return mapsPromise;
}

async function placesLib(apiKey: string): Promise<google.maps.PlacesLibrary> {
  await loadMaps(apiKey);
  return google.maps.importLibrary('places') as Promise<google.maps.PlacesLibrary>;
}

async function geocodingLib(apiKey: string): Promise<google.maps.GeocodingLibrary> {
  await loadMaps(apiKey);
  return google.maps.importLibrary('geocoding') as Promise<google.maps.GeocodingLibrary>;
}

// --- address-component parsing ----------------------------------------------
// Handles both shapes: the new Place API's `longText`, and the Geocoder's
// `long_name`.

type AnyComponent = {
  types: string[];
  longText?: string | null;
  shortText?: string | null;
  long_name?: string;
  short_name?: string;
};

const componentText = (c: AnyComponent) =>
  c.longText ?? c.long_name ?? c.shortText ?? c.short_name ?? '';

function parseComponents(components: AnyComponent[], formattedAddress: string): ParsedAddress {
  const pick = (...types: string[]) => {
    const hit = components.find((c) => types.some((t) => c.types.includes(t)));
    return hit ? componentText(hit) : '';
  };

  const streetNumber = pick('street_number');
  const route = pick('route');
  const premise = pick('premise');
  const subpremise = pick('subpremise');
  const sub1 = pick('sublocality_level_1', 'sublocality', 'neighborhood');
  const sub2 = pick('sublocality_level_2');

  let addressLine1 = '';
  if (premise || subpremise) addressLine1 = [subpremise, premise].filter(Boolean).join(', ');
  else if (route) addressLine1 = [streetNumber, route].filter(Boolean).join(' ');
  else if (sub1) addressLine1 = sub1;
  else if (formattedAddress) addressLine1 = formattedAddress.split(',')[0].trim();

  let addressLine2 = '';
  if ((premise || subpremise) && sub1) addressLine2 = [sub2, sub1].filter(Boolean).join(', ');
  else if (route && sub1) addressLine2 = sub1;
  else if (sub1 && sub2) addressLine2 = sub2;

  const city = pick(
    'locality',
    'postal_town',
    'administrative_area_level_3',
    'sublocality_level_1',
  );
  const adm2 = pick('administrative_area_level_2');
  const adm3 = pick('administrative_area_level_3');
  const district = adm2 || (adm3 && adm3 !== city ? adm3 : '');

  return {
    addressLine1,
    addressLine2,
    city,
    district,
    state: pick('administrative_area_level_1'),
    pincode: pick('postal_code'),
    country: pick('country') || 'India',
    formattedAddress: formattedAddress || '',
  };
}

const fillBlanks = (base: ParsedAddress, extra: ParsedAddress): ParsedAddress => ({
  addressLine1: base.addressLine1 || extra.addressLine1,
  addressLine2: base.addressLine2 || extra.addressLine2,
  city: base.city || extra.city,
  district: base.district || extra.district,
  state: base.state || extra.state,
  pincode: base.pincode || extra.pincode,
  country: base.country || extra.country || 'India',
  formattedAddress: base.formattedAddress || extra.formattedAddress,
});

const missingParts = (a: ParsedAddress) => !a.city || !a.district || !a.state || !a.pincode;

async function reverseGeocode(apiKey: string, lat: number, lng: number): Promise<ParsedAddress> {
  const { Geocoder } = await geocodingLib(apiKey);
  const { results } = await new Geocoder().geocode({ location: { lat, lng } });
  if (!results?.length) return EMPTY;
  const best =
    results.find((r) => r.types?.includes('street_address') || r.types?.includes('premise')) ??
    results[0];
  return parseComponents(
    (best.address_components ?? []) as AnyComponent[],
    best.formatted_address ?? '',
  );
}

// --- state snapping --------------------------------------------------------
// The sibling `state` control is a <select> over an exact list, so a geocoder
// spelling has to be snapped onto one of those or the dropdown shows blank.

const STATE_ALIASES: Record<string, string> = {
  'nct of delhi': 'Delhi',
  'national capital territory of delhi': 'Delhi',
  'jammu & kashmir': 'Jammu and Kashmir',
  'andaman & nicobar islands': 'Andaman and Nicobar Islands',
  orissa: 'Odisha',
  pondicherry: 'Puducherry',
  uttaranchal: 'Uttarakhand',
};

interface Props {
  label?: string;
  /** The exact option strings the sibling `state` <select> accepts. */
  states?: string[];
}

export function AddressSearch({ label = 'Search address', states = [] }: Props) {
  const { setFieldValue, setFieldTouched } = useFormikContext();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const boxRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  const snapState = useCallback(
    (raw: string) => {
      if (!raw) return '';
      const key = raw.trim().toLowerCase();
      const target = STATE_ALIASES[key] ?? raw.trim();
      return states.find((s) => s.toLowerCase() === target.toLowerCase()) ?? target;
    },
    [states],
  );

  const apply = useCallback(
    (addr: ParsedAddress) => {
      setFieldValue('addressLine1', addr.addressLine1);
      setFieldValue('addressLine2', addr.addressLine2);
      setFieldValue('city', addr.city);
      setFieldValue('district', addr.district);
      setFieldValue('state', snapState(addr.state));
      setFieldValue('pincode', addr.pincode);
      setFieldValue('country', addr.country || 'India');
      ADDRESS_FIELDS.forEach((f) => setFieldTouched(f, true, false));
    },
    [setFieldValue, setFieldTouched, snapState],
  );

  // Close the suggestion list on an outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const runSearch = useCallback(
    (text: string) => {
      if (!apiKey || text.trim().length < 3) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      const seq = ++seqRef.current;
      void (async () => {
        try {
          const { AutocompleteSuggestion, AutocompleteSessionToken } = await placesLib(apiKey);
          if (!AutocompleteSuggestion) {
            setNote('Address search needs an updated Google Maps key — enter the address manually.');
            return;
          }
          if (!tokenRef.current) tokenRef.current = new AutocompleteSessionToken();
          const { suggestions: list } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: text,
            sessionToken: tokenRef.current,
            includedRegionCodes: ['in'],
          });
          if (seq !== seqRef.current) return; // a newer keystroke already fired
          setSuggestions(list ?? []);
          setOpen((list ?? []).length > 0);
        } catch {
          if (seq === seqRef.current) {
            setSuggestions([]);
            setNote('Address search is unavailable right now.');
          }
        }
      })();
    },
    [apiKey],
  );

  const onQueryChange = (v: string) => {
    setQuery(v);
    setNote('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(v), 250);
  };

  const choose = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return;
    setOpen(false);
    setBusy(true);
    setNote('');
    try {
      setQuery(prediction.text.text);
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['addressComponents', 'formattedAddress', 'location'] });
      tokenRef.current = null; // the session ends at the first fetchFields
      let parsed = parseComponents(
        (place.addressComponents ?? []) as AnyComponent[],
        place.formattedAddress ?? '',
      );
      if (missingParts(parsed) && place.location) {
        const geo = await reverseGeocode(apiKey!, place.location.lat(), place.location.lng());
        parsed = fillBlanks(parsed, geo);
      }
      apply(parsed);
      setNote(
        missingParts(parsed) ? 'Filled what was available — check the district and PIN code.' : '',
      );
    } catch {
      setNote('Could not load that address. Enter it manually below.');
    } finally {
      setBusy(false);
    }
  };

  const detect = () => {
    if (!apiKey) {
      setNote('Location lookup needs the Google Maps key.');
      return;
    }
    if (!navigator.geolocation) {
      setNote('This browser cannot share a location.');
      return;
    }
    setBusy(true);
    setNote('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const geo = await reverseGeocode(apiKey, pos.coords.latitude, pos.coords.longitude);
          apply(geo);
          setQuery(geo.formattedAddress);
          setNote(
            missingParts(geo) ? 'Filled what was available — check the district and PIN code.' : '',
          );
        } catch {
          setNote('Could not resolve your location.');
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        setNote(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied.'
            : 'Could not get your location.',
        );
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  if (!apiKey) return null;

  return (
    <div ref={boxRef} className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Start typing an address or landmark…"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
          />
        </div>
        <button
          type="button"
          onClick={detect}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:border-cyan-400 hover:text-cyan-700 transition disabled:opacity-50 whitespace-nowrap"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
          Detect location
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          {suggestions.map((s, i) => {
            const p = s.placePrediction;
            if (!p) return null;
            const main = p.mainText?.text ?? p.text.text;
            const secondary = p.secondaryText?.text ?? '';
            return (
              <li key={p.placeId || i}>
                <button
                  type="button"
                  onClick={() => choose(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex flex-col"
                >
                  <span className="text-slate-800">{main}</span>
                  {secondary && <span className="text-xs text-slate-400">{secondary}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
        {note && <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
        {note || 'Pick a result to fill the fields below, or use Detect location.'}
      </p>
    </div>
  );
}
