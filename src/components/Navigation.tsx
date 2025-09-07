"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

const Navigation = () => {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Stock Movers', icon: '📈' },
    { href: '/market-data', label: 'Market Data', icon: '📊' },
    { href: '/signals', label: 'Trading Signals', icon: '🔔' },
    // { href: '/highs-lows', label: 'Highs & Lows', icon: '📉' },
    // { href: '/analytics', label: 'Analytics', icon: '🔍' }
  ];

  return (
    <nav className="nav shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <span className="text-2xl">📈</span>
            <span className="text-xl font-bold brand">StockWeb</span>
          </div>

          {/* Navigation Links */}
          <div className="flex space-x-8">
              {navItems.concat([{ href: '/page4', label: 'Sheets', icon: '📄' }]).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
                  pathname === item.href
                    ? 'nav-link active'
                    : ''
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* User section placeholder + theme toggle */}
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <div className="w-8 h-8 user-pill rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">U</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
