function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Marker emoji per mezzi sulla mappa operativa (Google Maps). */
export function getEmojiMarkerIcon(google, emoji) {
  if (!google?.maps) return undefined;

  const char = escapeXml(String(emoji ?? '📍').trim() || '📍');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <ellipse cx="24" cy="42" rx="18" ry="2.5" fill="#000" opacity="0.12"/>
  <text x="24" y="32" font-size="28" text-anchor="middle" dominant-baseline="middle">${char}</text>
</svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(36, 36),
    anchor: new google.maps.Point(18, 32),
  };
}

/** Icona ambulanza per marker mezzi sulla mappa operativa (Google Maps). */
export function getAmbulanceMarkerIcon(google) {
  if (!google?.maps) return undefined;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <ellipse cx="24" cy="42" rx="20" ry="3" fill="#000" opacity="0.15"/>
  <rect x="6" y="16" width="30" height="18" rx="3" fill="#0284c7" stroke="#0c4a6e" stroke-width="1.5"/>
  <path d="M36 20h6l4 7v7h-4a3 3 0 0 1-6 0H20a3 3 0 0 1-6 0H10v-7l4-7h6" fill="#0369a1" stroke="#0c4a6e" stroke-width="1.2" stroke-linejoin="round"/>
  <rect x="10" y="20" width="8" height="10" rx="1" fill="#e0f2fe" stroke="#0c4a6e" stroke-width="1"/>
  <path d="M14 23h4M16 21v4" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round"/>
  <circle cx="14" cy="36" r="3.5" fill="#1e293b" stroke="#64748b" stroke-width="1"/>
  <circle cx="34" cy="36" r="3.5" fill="#1e293b" stroke="#64748b" stroke-width="1"/>
  <circle cx="14" cy="36" r="1.5" fill="#94a3b8"/>
  <circle cx="34" cy="36" r="1.5" fill="#94a3b8"/>
  <rect x="22" y="8" width="10" height="4" rx="1" fill="#ef4444" opacity="0.9"/>
</svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(40, 40),
    anchor: new google.maps.Point(20, 36),
  };
}
