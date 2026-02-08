import { ReactNode, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Workflow,
  Link2,
  ScrollText,
  Menu,
  X,
  ChevronRight,
  Layers,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Workflows', href: '/workflows', icon: Workflow },
  { name: 'Verbindungen', href: '/connections', icon: Link2 },
  { name: 'Protokolle', href: '/logs', icon: ScrollText },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const breadcrumbs = getBreadcrumbs(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar transition-transform duration-300 lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">PLX Middleware</h1>
            <p className="text-[11px] text-gray-400">Paperless + Lexoffice</p>
          </div>
          <button
            className="ml-auto rounded-lg p-1 text-gray-400 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          {navigation.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-600/20 text-brand-400'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={`h-5 w-5 flex-shrink-0 transition-colors ${
                      isActive ? 'text-brand-400' : 'text-gray-400 group-hover:text-gray-300'
                    }`}
                  />
                  {item.name}
                  {isActive && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-400" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-gray-300">System aktiv</span>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:px-8">
          <button
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <nav className="flex items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                <span
                  className={
                    index === breadcrumbs.length - 1
                      ? 'font-medium text-gray-900'
                      : 'text-gray-500'
                  }
                >
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}

function getBreadcrumbs(pathname: string): string[] {
  const crumbs = ['PLX Middleware'];
  const pathMap: Record<string, string> = {
    '/': 'Dashboard',
    '/workflows': 'Workflows',
    '/workflows/new': 'Neuer Workflow',
    '/connections': 'Verbindungen',
    '/logs': 'Protokolle',
  };

  if (pathname === '/') {
    crumbs.push('Dashboard');
  } else {
    const segments = pathname.split('/').filter(Boolean);
    let current = '';
    for (const segment of segments) {
      current += `/${segment}`;
      const label = pathMap[current];
      if (label) {
        crumbs.push(label);
      }
    }
  }

  return crumbs;
}
