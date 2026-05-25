import React, { useEffect, useState } from 'react';

type Suggestion = { id: string; place_name: string; center?: [number, number] };

type SuggestionGroup = {
  label: string;
  items: Suggestion[];
};

type Props = {
  value: string;
  onSelect: (address: string, lat: number | null, lng: number | null) => void;
  placeholder?: string;
};

const demoSuggestions: SuggestionGroup[] = [
  {
    label: 'Town Proper & Coastal Hubs',
    items: [
      { id: 'town-proper', place_name: 'Town Proper (Center)' },
      { id: 'poblacion', place_name: 'Poblacion (Center)' },
      { id: 'santa-cruz', place_name: 'Santa Cruz (Commercial Hub)' },
      { id: 'san-roque', place_name: 'San Roque' },
      { id: 'desamparados', place_name: 'Desamparados' },
      { id: 'calunasan', place_name: 'Calunasan' },
      { id: 'pangangan-island', place_name: '🌴 Pangangan Island (Connected by Causeway)' },
      { id: 'libaong', place_name: 'Libaong' },
      { id: 'looc', place_name: 'Looc' },
      { id: 'lomboy', place_name: 'Lomboy' },
      { id: 'magtongtong', place_name: 'Magtongtong' },
      { id: 'talisay', place_name: 'Talisay' },
      { id: 'kinangan', place_name: 'Kinangan' },
      { id: 'kahayag', place_name: 'Kahayag' },
      { id: 'lawis', place_name: 'Lawis' },
    ],
  },
  {
    label: 'Inland & Upland Barangays',
    items: [
      { id: 'abucayan-norte', place_name: 'Abucayan Norte' },
      { id: 'abucayan-sur', place_name: 'Abucayan Sur' },
      { id: 'binasbas', place_name: 'Binasbas' },
      { id: 'bonbon', place_name: 'Bonbon' },
      { id: 'cabayugan', place_name: 'Cabayugan' },
      { id: 'cabudlan', place_name: 'Cabudlan' },
      { id: 'calinginan-norte', place_name: 'Calinginan Norte' },
      { id: 'calinginan-sur', place_name: 'Calinginan Sur' },
      { id: 'catmonan', place_name: 'Catmonan' },
      { id: 'centinela', place_name: 'Centinela' },
      { id: 'labuon', place_name: 'Labuon' },
      { id: 'lucob', place_name: 'Lucob' },
      { id: 'madangog', place_name: 'Madangog' },
      { id: 'maguicay', place_name: 'Maguicay' },
      { id: 'mahayag', place_name: 'Mahayag' },
      { id: 'mantatao', place_name: 'Mantatao' },
      { id: 'sampoangon', place_name: 'Sampoangon' },
      { id: 'sua', place_name: 'Sua' },
      { id: 'tominjao', place_name: 'Tominjao' },
      { id: 'ulugon', place_name: 'Ulugon' },
    ],
  },
];

const flattenSuggestions = () => demoSuggestions.flatMap((group) => group.items);

const MapAutocomplete: React.FC<Props> = ({ value, onSelect, placeholder }) => {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const token = process.env.REACT_APP_MAPBOX_TOKEN;
  const localSuggestions = flattenSuggestions();

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    let mounted = true;
    const fetchSuggestions = async () => {
      if (!query.trim()) {
        setResults(localSuggestions);
        return;
      }

      setLoading(true);
      try {
        if (token) {
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&autocomplete=true&limit=6`;
          const res = await fetch(url);
          const data = await res.json();
          if (!mounted) return;
          const items: Suggestion[] = (data.features || []).map((f: any) => ({ id: f.id, place_name: f.place_name, center: f.center }));
          const localMatches = localSuggestions.filter((suggestion) => suggestion.place_name.toLowerCase().includes(query.toLowerCase()));
          setResults([...localMatches, ...items]);
        } else {
          const filtered = localSuggestions.filter((s) => s.place_name.toLowerCase().includes(query.toLowerCase()));
          setResults(filtered);
        }
      } catch (e) {
        setResults([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const t = setTimeout(fetchSuggestions, 250);
    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [query, token]);

  const selectAddress = (suggestion: Suggestion | null) => {
    const address = suggestion?.place_name?.trim() || query.trim();
    if (!address) return;

    const lat = suggestion?.center ? Number(suggestion.center[1]) : null;
    const lng = suggestion?.center ? Number(suggestion.center[0]) : null;
    onSelect(address, lat, lng);
    setQuery(address);
    setResults([]);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!query.trim()) return;

    const exactMatch = results.find((suggestion) => suggestion.place_name.toLowerCase() === query.trim().toLowerCase());
    selectAddress(exactMatch ?? null);
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Enter delivery address'}
        className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition placeholder:text-cream/40 focus:border-gold/60"
      />

      {query.trim() || results.length ? (
        <div className="mt-2 max-h-44 overflow-auto rounded-2xl border border-white/10 bg-black/10">
          {loading ? <div className="p-3 text-sm text-cream/60">Searching…</div> : null}
          {results.length === 0 && !loading ? (
            <div className="p-3 text-sm text-cream/60">No suggestions. Press Enter to use this address.</div>
          ) : null}
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectAddress(s)}
              className="w-full text-left px-3 py-2 text-sm text-cream hover:bg-white/5"
            >
              {s.place_name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default MapAutocomplete;
