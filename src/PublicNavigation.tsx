import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeftRight,
  Bell,
  ChartNoAxesCombined,
  CircleHelp,
  FileText,
  Globe2,
  Menu,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';

const groups = [
  {
    title: 'Platform',
    links: [
      {
        name: 'Currency converter',
        Icon: ArrowLeftRight,
        href: '/#converter-heading',
        description: 'Convert between currencies.',
      },
      {
        name: 'Rate alerts',
        Icon: Bell,
        href: '/#how-it-works',
        description: 'See how target alerts work.',
      },
      {
        name: 'Transfer Planner',
        Icon: Send,
        href: '/planner',
        description: 'Estimate and plan a transfer.',
      },
    ],
  },
  {
    title: 'Explore',
    links: [
      {
        name: 'Historical charts',
        Icon: ChartNoAxesCombined,
        href: '/charts',
        description: 'Explore past exchange rates.',
      },
      {
        name: 'NZD to INR',
        Icon: Globe2,
        href: '/rates/nzd-inr',
        description: 'View rates for a popular pair.',
      },
    ],
  },
  {
    title: 'Resources',
    links: [
      {
        name: 'FAQs',
        Icon: CircleHelp,
        href: '/#faq',
        description: 'Find answers about rates and alerts.',
      },
      {
        name: 'Privacy Policy',
        Icon: ShieldCheck,
        href: '/privacy',
        description: 'Read how RateWatch handles data.',
      },
      {
        name: 'Terms of Service',
        Icon: FileText,
        href: '/terms',
        description: 'Read the terms for using RateWatch.',
      },
    ],
  },
];

export function RateWatchMark() {
  return (
    <svg viewBox="0 0 34 34" width="34" height="34" fill="none" aria-hidden="true">
      <rect x=".5" y=".5" width="33" height="33" rx="9" fill="#10112f" stroke="#10112f" />
      <path
        d="M7 22.5 13 13l4.2 5.1L23.5 10M10.5 25l5.7-4.2 4 2.2 7-7.1"
        stroke="#d8ff32"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23.5" cy="10" r="2" fill="#d8ff32" />
    </svg>
  );
}

export default function PublicNavigation({ signedIn }: { signedIn: boolean }) {
  const [clicked, setGroup] = useState<string>();
  const [hovered, setHovered] = useState<string>();
  const group = hovered ?? clicked;
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!group && !mobileOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) {
        setGroup(undefined);
        setHovered(undefined);
        setMobileOpen(false);
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [group, mobileOpen]);

  const close = () => {
    setGroup(undefined);
    setHovered(undefined);
    setMobileOpen(false);
  };

  return (
    <header
      className="rw-header"
      ref={header}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || (!group && !mobileOpen)) return;
        event.stopPropagation();
        if (group) {
          document.getElementById(`rw-trigger-${group}`)?.focus();
          setGroup(undefined);
          setHovered(undefined);
        } else {
          toggle.current?.focus();
          setMobileOpen(false);
        }
      }}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <div className="rw-header-inner">
        <Link className="rw-wordmark" to="/" onClick={close}>
          <RateWatchMark />
          RateWatch
        </Link>
        <button
          className="rw-mobile-toggle"
          type="button"
          ref={toggle}
          aria-expanded={mobileOpen}
          aria-controls="rw-navigation"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => {
            setGroup(undefined);
            setHovered(undefined);
            setMobileOpen(!mobileOpen);
          }}
        >
          {mobileOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
        </button>
        <nav
          id="rw-navigation"
          className="rw-navigation"
          aria-label="Main navigation"
          data-open={mobileOpen}
        >
          <ul className="rw-nav-groups">
            {groups.map(({ title, links }) => (
              <li
                key={title}
                onPointerEnter={(event) => {
                  if (
                    event.pointerType === 'mouse' &&
                    window.matchMedia('(min-width: 761px) and (hover: hover)').matches &&
                    !event.currentTarget.querySelector('ul')?.contains(document.activeElement)
                  ) {
                    setGroup(undefined);
                    setHovered(title);
                  }
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType !== 'mouse') return;
                  if (event.currentTarget.querySelector('ul')?.contains(document.activeElement))
                    setGroup(title);
                  setHovered(undefined);
                }}
              >
                <button
                  type="button"
                  id={`rw-trigger-${title}`}
                  aria-expanded={group === title}
                  aria-controls={`rw-panel-${title}`}
                  data-current={pathname !== '/' && links.some(({ href }) => href === pathname)}
                  onClick={() => {
                    setHovered(undefined);
                    setGroup(clicked === title ? undefined : title);
                  }}
                >
                  {title}
                </button>
                <ul className="rw-nav-panel" id={`rw-panel-${title}`} hidden={group !== title}>
                  {links.map(({ name, href, description, Icon }) => (
                    <li key={href}>
                      {href.includes('#') ? (
                        <a href={href} onClick={close}>
                          <Icon size={18} aria-hidden="true" />
                          <strong>{name}</strong>
                          <span>{description}</span>
                        </a>
                      ) : (
                        <Link
                          to={href}
                          onClick={close}
                          aria-current={pathname === href ? 'page' : undefined}
                        >
                          <Icon size={18} aria-hidden="true" />
                          <strong>{name}</strong>
                          <span>{description}</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <div className="rw-account-actions">
            {!signedIn && (
              <Link to="/login" onClick={close}>
                Log in
              </Link>
            )}
            <Link className="rw-button" to={signedIn ? '/dashboard' : '/register'} onClick={close}>
              {signedIn ? 'Dashboard' : 'Get started'}
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
