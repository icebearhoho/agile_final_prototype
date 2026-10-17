import { NavLink } from "react-router";
import { SignOut } from "@phosphor-icons/react";
import { navGroupsFor, type NavItem } from "../../data/nav";
import { useSession } from "../../session";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function Item({ to, label, icon: Icon, badge, compact }: NavItem & { compact?: boolean }) {
  if (compact) {
    return (
      <NavLink
        to={to}
        end={to === "/admin" || to === "/parent"}
        className={({ isActive }) =>
          `flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold ${focus} ${
            isActive
              ? "border-primary bg-primary text-on-primary"
              : "border-line bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
          }`
        }
      >
        <Icon size={16} aria-hidden="true" />
        {label}
        {badge !== undefined && <span className="text-[11px] font-bold opacity-80">{badge}</span>}
      </NavLink>
    );
  }
  return (
    <NavLink
      to={to}
      end={to === "/admin" || to === "/parent"}
      className={({ isActive }) =>
        `flex min-h-11 items-center gap-2.5 border-l-[3px] py-1.5 pl-4 pr-3 text-[13.5px] font-semibold ${focus} ${
          isActive
            ? "border-primary bg-primary-fixed text-on-primary-fixed-variant"
            : "border-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
        }`
      }
    >
      <Icon size={20} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 flex-1">{label}</span>
      {badge !== undefined && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-on-primary">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

/** Reference-portal sidebar: always expanded, sections with uppercase labels, active item tinted burgundy. */
export default function Sidebar() {
  const { role, signOut } = useSession();
  if (!role) return null;
  const groups = navGroupsFor(role);

  return (
    <>
      {/* Desktop: vertical section sidebar like the reference portal. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto pb-10 md:block">
        <nav aria-label="Primary" className="flex h-full flex-col">
          <div className="flex-1">
            {groups.map((g, i) => (
              <div key={g.group ?? i}>
                {g.group && (
                  <p className="px-4 pb-1.5 pt-3.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">
                    {g.group}
                  </p>
                )}
                <ul>
                  {g.items.map((item) => (
                    <li key={item.to}>
                      <Item {...item} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={signOut}
            className={`mt-4 flex min-h-11 items-center gap-2.5 border-l-[3px] border-transparent py-1.5 pl-4 pr-3 text-[13.5px] font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface ${focus}`}
          >
            <SignOut size={20} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0 flex-1">Sign out</span>
          </button>
        </nav>
      </aside>
      {/* Small screens: the same items wrap as chips under the top bar. */}
      <nav aria-label="Primary" className="w-full border-b border-line bg-surface-container-lowest px-3 py-2 md:hidden">
        <div className="flex flex-wrap gap-1.5">
          {groups.flatMap((g) => g.items).map((item) => (
            <Item key={item.to} {...item} compact />
          ))}
          <button
            type="button"
            onClick={signOut}
            className={`flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface-container-lowest px-3 text-[13px] font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface ${focus}`}
          >
            <SignOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </nav>
    </>
  );
}
