import React, { useEffect, useState } from 'react';
import type { Suggestion, SuggestionGroup } from './MapAutocompleteTypes';
import demoSuggestions from '../data/deliveryLocations';

type Props = {
  value: string;
  onSelect: (address: string, lat: number | null, lng: number | null) => void;
  placeholder?: string;
};


const flattenSuggestions = () => demoSuggestions.flatMap((group) => group.items);

const MapAutocomplete: React.FC<Props> = ({ value, onSelect, placeholder }) => {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<Suggestion[]>([]);
  const [localResults, setLocalResults] = useState<SuggestionGroup[]>([]);
  const [remoteResults, setRemoteResults] = useState<Suggestion[]>([]);
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
        setLocalResults(demoSuggestions);
        setRemoteResults([]);
        setResults(flattenSuggestions());
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
          const localMatchesGroups = demoSuggestions
            .map((g) => ({ label: g.label, items: g.items.filter((s) => s.place_name.toLowerCase().includes(query.toLowerCase())) }))
            .filter((g) => g.items.length > 0);
          setRemoteResults(items);
          setLocalResults(localMatchesGroups);
          setResults([...localMatchesGroups.flatMap((g) => g.items), ...items]);
        } else {
          const groups = demoSuggestions.map((g) => ({ label: g.label, items: g.items.filter((s) => s.place_name.toLowerCase().includes(query.toLowerCase())) })).filter((g) => g.items.length > 0);
          setLocalResults(groups.length ? groups : demoSuggestions);
          setRemoteResults([]);
          setResults((groups.length ? groups.flatMap((g) => g.items) : flattenSuggestions()));
        }
      } catch (e) {
        setResults([]);
        setLocalResults([]);
        setRemoteResults([]);
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

      {query.trim() || results.length || localResults.length || remoteResults.length ? (
        <div className="mt-2 max-h-44 overflow-auto rounded-2xl border border-white/10 bg-black/10">
          {loading ? <div className="p-3 text-sm text-cream/60">Searching…</div> : null}
          {results.length === 0 && localResults.length === 0 && remoteResults.length === 0 && !loading ? (
            <div className="p-3 text-sm text-cream/60">No suggestions. Press Enter to use this address.</div>
          ) : null}

          {localResults.length > 0 && localResults.map((g) => (
            <div key={g.label} className="border-b border-white/5">
              <div className="px-3 py-1 text-xs text-cream/60 font-semibold">{g.label}</div>
              {g.items.map((s) => (
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
          ))}

          {remoteResults.length > 0 ? (
            <div>
              <div className="px-3 py-1 text-xs text-cream/60 font-semibold">Map results</div>
              {remoteResults.map((s) => (
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
      ) : null}
    </div>
  );
};

export default MapAutocomplete;
