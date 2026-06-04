import { AppLogo } from './AppLogo';
import { SandboxBadge } from '../sandbox/SandboxBadge';
import { useSandboxUi } from '../../context/SandboxUiContext';

export function BrandLockup({
  logoClassName = 'h-9 w-auto',
  showTitle = true,
  titleClassName = 'text-sm font-bold uppercase tracking-wide text-slate-800',
}) {
  const { showSandboxBadge } = useSandboxUi();

  return (
    <span className="flex shrink-0 items-center gap-2">
      <AppLogo className={logoClassName} />
      {showSandboxBadge ? <SandboxBadge /> : null}
      {showTitle ? <span className={titleClassName}>CROSS</span> : null}
    </span>
  );
}
