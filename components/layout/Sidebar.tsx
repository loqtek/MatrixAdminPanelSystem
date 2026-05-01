'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Button } from '../ui/Button';
import {
  ChartNoAxesColumn,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  House,
  LogOut,
  RefreshCcw,
  Settings,
  Users,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: ChartNoAxesColumn },
  { name: 'Users', href: '/dashboard/users', icon: Users },
  { name: 'Rooms', href: '/dashboard/rooms', icon: House },
  { name: 'Background Updates', href: '/dashboard/background-updates', icon: RefreshCcw },
  { name: 'Federation', href: '/dashboard/federation', icon: Globe },
  { name: 'Config', href: '/dashboard/config', icon: Settings },
  { name: 'Logs', href: '/dashboard/logs', icon: FileText },
];

interface SidebarProps {
  onLogout: () => void | Promise<void>;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ onLogout, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`min-h-screen bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col transition-[width] duration-200 ${collapsed ? 'w-20' : 'w-72'}`}
    >
      <div className="p-4 border-b border-[var(--color-border)]">
        <div className={`flex ${collapsed ? 'flex-col items-center gap-2' : 'items-center justify-between'}`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <Image
            src="/mapsLogoNoBg1.png"
            alt="MAPS Logo"
            width={collapsed ? 36 : 34}
            height={collapsed ? 36 : 34}
            className="object-contain"
          />
          {!collapsed && (
            <h1 className="text-xl font-bold text-[var(--color-foreground)]">MAPS</h1>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="h-9 w-9 p-0"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
        </div>
      </div>
      
      <nav className={`mt-6 flex-1 ${collapsed ? 'px-2' : 'px-3'} space-y-1`}>
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={`
                flex items-center rounded-lg text-sm font-medium transition-colors duration-200
                ${collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5'}
                ${
                  isActive
                    ? 'bg-[color-mix(in_srgb,var(--color-primary)_15%,transparent)] text-[var(--color-foreground)]'
                    : 'text-[var(--color-muted)] hover:bg-[color-mix(in_srgb,var(--color-surface)_70%,var(--color-primary)_30%)] hover:text-[var(--color-foreground)]'
                }
              `}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!collapsed && item.name}
            </Link>
          );
        })}
      </nav>
      
      <div className={`border-t border-[var(--color-border)] ${collapsed ? 'p-2' : 'p-4'}`}>
        <Button
          variant="ghost"
          onClick={onLogout}
          title={collapsed ? 'Logout' : undefined}
          className={`w-full ${collapsed ? 'h-10 px-0 justify-center' : 'justify-start'}`}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {!collapsed && 'Logout'}
        </Button>
      </div>
    </aside>
  );
}

