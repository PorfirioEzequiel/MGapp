import React, { cloneElement, useEffect, useRef, useState } from 'react';
import { ADDRESS_SEARCH_URL } from './territorialMapConfig';
import { MapCoordinate } from './leafletRuntime';

const cache = new Map();
let lastRequest = 0;

// Explicit address search for the local trial. No requests on each keystroke,
// no citizen records, names or map datasets are sent to the demo geocoder.
export default function LeafletAddressSearch({ children, onLoad, onPlaceChanged }) {
  const place = useRef(null);
  const request = useRef(null);
  const callbacks = useRef({ onLoad, onPlaceChanged });
  callbacks.current = { onLoad, onPlaceChanged };
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    callbacks.current.onLoad?.({ getPlace: () => place.current });
    return () => request.current?.abort();
  }, []);

  const search = async () => {
    const q = query.trim();
    if (q.length < 3) { setMessage('Escribe al menos tres caracteres.'); return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const key = q.toLocaleLowerCase('es-MX');
    setMessage('');
    setResults([]);
    if (!cache.has(key) && Date.now() - lastRequest < 1100) {
      setMessage('Espera un momento antes de otra búsqueda.'); return;
    }
    setBusy(true);
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      let rows = cache.get(key);
      if (!rows) {
        lastRequest = Date.now();
        const url = new URL(ADDRESS_SEARCH_URL);
        url.searchParams.set('q', q);
        url.searchParams.set('limit', '6');
        url.searchParams.set('lat', '19.66');
        url.searchParams.set('lon', '-98.99');
        url.searchParams.set('bbox', '-118.5,14.3,-86.5,32.8');
        const response = await fetch(url.toString(), { signal: controller.signal });
        if (!response.ok) throw new Error('Geocoder unavailable');
        const data = await response.json();
        rows = (data.features || []).filter(row => {
          const coords = row.geometry?.coordinates;
          const country = row.properties?.countrycode?.toLowerCase();
          return (!country || country === 'mx') && coords?.length >= 2 && coords.slice(0, 2).every(Number.isFinite);
        });
        if (cache.size >= 30) cache.delete(cache.keys().next().value);
        cache.set(key, rows);
      }
      if (request.current !== controller || controller.signal.aborted) return;
      setResults(rows);
      if (!rows.length) setMessage('Sin coincidencias. Prueba con calle y municipio, o coloca el pin en el mapa.');
    } catch (_) {
      if (request.current === controller) setMessage('No se pudo buscar la dirección. Intenta otra vez o coloca el pin en el mapa.');
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) setBusy(false);
    }
  };

  const label = row => {
    const p = row.properties || {};
    return [...new Set([p.name, p.street, p.housenumber, p.district, p.city, p.state].filter(Boolean))].join(', ');
  };
  const choose = row => {
    const [lng, lat] = row.geometry.coordinates;
    place.current = { geometry: { location: new MapCoordinate(lat, lng) } };
    setQuery(label(row)); setResults([]); setMessage('');
    callbacks.current.onPlaceChanged?.();
  };
  const input = cloneElement(React.Children.only(children), {
    value: query, 'aria-label': 'Buscar calle o dirección',
    onChange: event => {
      request.current?.abort(); request.current = null;
      setQuery(event.target.value); setResults([]); setMessage(''); setBusy(false);
    },
    onKeyDown: event => {
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (!busy) search(); }
      if (event.key === 'Escape') { setResults([]); setMessage(''); }
    },
  });
  return <div className="territorial-address-search">
    {input}
    <button type="button" className="territorial-address-submit" onClick={search} disabled={busy}>{busy ? '…' : 'Buscar'}</button>
    {message && <div className="territorial-address-feedback" role="status">{message}</div>}
    {results.length > 0 && <div className="territorial-address-results" aria-label="Direcciones encontradas">
      {results.map((row, index) => <button type="button" key={`${row.properties?.osm_id}-${index}`} onClick={() => choose(row)}>{label(row)}</button>)}
      <small>Datos © OpenStreetMap · Photon</small>
    </div>}
  </div>;
}
