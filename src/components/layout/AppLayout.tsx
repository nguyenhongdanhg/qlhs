import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { MobileHeader } from './MobileHeader';
import { MainHeader } from './MainHeader';
import { Footer } from './Footer';
import { SchoolProvider } from '@/contexts/SchoolContext';

export function AppLayout() {
  return (
    <SchoolProvider>
      <div className="min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Mobile Header */}
        <MobileHeader />

        {/* Main Content */}
        <main className="lg:ml-[280px] flex flex-col min-h-screen">
          {/* Desktop Header */}
          <MainHeader />
          
          <div className="flex-1 pb-20 lg:pb-0">
            <Outlet />
          </div>
          
          {/* Footer */}
          <Footer />
        </main>

        {/* Mobile Bottom Nav */}
        <MobileNav />
      </div>
    </SchoolProvider>
  );
}
