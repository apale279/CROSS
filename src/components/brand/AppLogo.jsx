const LOGO_SRC = '/logo.png';

export function AppLogo({ className = 'h-8 w-auto object-contain', alt = 'CROSS' }) {
  return <img src={LOGO_SRC} alt={alt} className={className} decoding="async" />;
}
