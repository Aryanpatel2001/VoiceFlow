/**
 * Dashboard Sidebar
 *
 * Navigation sidebar for the dashboard.
 * Uses VoiceFlow Pro design system.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Phone,
  GitBranch,
  BarChart3,
  Plug,
  Settings,
  CreditCard,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Zap,
  Users,
  BookOpen,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    label: "Calls",
    href: "/dashboard/calls",
    icon: <Phone className="h-5 w-5" />,
  },
  {
    label: "Agent Canvas",
    href: "/dashboard/canvas",
    icon: <GitBranch className="h-5 w-5" />,
  },
  {
    label: "Knowledge Base",
    href: "/dashboard/knowledge",
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    label: "Campaigns",
    href: "/dashboard/campaigns",
    icon: <Megaphone className="h-5 w-5" />,
    badge: "New",
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: <BarChart3 className="h-5 w-5" />,
  },
];

const secondaryNavItems: NavItem[] = [
  {
    label: "Integrations",
    href: "/dashboard/integrations",
    icon: <Plug className="h-5 w-5" />,
  },
  {
    label: "Team",
    href: "/dashboard/team",
    icon: <Users className="h-5 w-5" />,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: <Settings className="h-5 w-5" />,
  },
  {
    label: "Billing",
    href: "/dashboard/billing",
    icon: <CreditCard className="h-5 w-5" />,
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar-background transition-all duration-300",
        collapsed ? "w-[70px]" : "w-[260px]"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border px-4",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="font-display text-lg font-bold text-sidebar-foreground"
                >
                  VoiceFlow<span className="text-primary">Pro</span>
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          {!collapsed && (
            <button
              onClick={onToggle}
              className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Collapse button when collapsed */}
        {collapsed && (
          <button
            onClick={onToggle}
            className="mx-auto mt-4 rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Main Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {!collapsed && (
              <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
                Main
              </p>
            )}
            {mainNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname === item.href}
                collapsed={collapsed}
              />
            ))}
          </div>

          <div className="mt-6 space-y-1">
            {!collapsed && (
              <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
                Settings
              </p>
            )}
            {secondaryNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname === item.href}
                collapsed={collapsed}
              />
            ))}
          </div>
        </nav>

        {/* Usage Indicator */}
        {!collapsed && (
          <div className="border-t border-sidebar-border p-4">
            <div className="rounded-lg bg-sidebar-accent p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-sidebar-foreground/70">Minutes Used</span>
                <span className="font-medium text-sidebar-foreground">
                  1,247 / 2,000
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-sidebar-border">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: "62%" }}
                />
              </div>
              <p className="mt-2 text-xs text-sidebar-foreground/50">
                62% used this month
              </p>
            </div>
          </div>
        )}

        {/* Help */}
        <div className="border-t border-sidebar-border p-3">
          <Link
            href="/help"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed && "justify-center"
            )}
          >
            <HelpCircle className="h-5 w-5" />
            {!collapsed && <span>Help & Support</span>}
          </Link>
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        collapsed && "justify-center",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      {item.icon}
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {!collapsed && item.badge && (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {item.badge}
        </span>
      )}

      {/* Tooltip for collapsed state */}
      {collapsed && (
        <div className="absolute left-full ml-2 hidden rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block">
          {item.label}
        </div>
      )}
    </Link>
  );
}
