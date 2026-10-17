import { Bell } from "@phosphor-icons/react";
import { useSession } from "../../session";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const pill =
  "inline-flex h-11 items-center justify-center rounded-full border border-line bg-surface-container-lowest text-on-surface motion-safe:transition-colors duration-150 hover:bg-primary-fixed";

type Props = { title: string; subtitle?: string; showFilter?: boolean };

/** Page header, restored to the icebearhoho layout: large title + subtitle, header actions, bell and avatar. */
export default function Header({ title, subtitle }: Props) {
  const { user } = useSession();
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 pb-6">
      <div className="min-w-0">
        <h1 className="truncate text-4xl font-semibold leading-tight tracking-tight text-on-surface">{title}</h1>
        {subtitle && <p className="mt-1.5 truncate text-base text-on-surface-variant">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div id="header-actions" className="flex items-center gap-3" />
        <button
          type="button"
          aria-label="Notifications, 1 unread"
          className={`${pill} ${focus} relative w-11`}
        >
          <Bell size={20} />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-alert" aria-hidden="true" />
        </button>
        <span
          title={user.name}
          role="img"
          aria-label={`Signed in as ${user.name}`}
          className="grid size-11 select-none place-items-center rounded-full bg-primary text-sm font-semibold text-on-primary"
        >
          {user.initials}
        </span>
      </div>
    </header>
  );
}
