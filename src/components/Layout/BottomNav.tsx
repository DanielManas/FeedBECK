import { Home, Search, User, Settings, Plus, Bell } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';

export default function BottomNav() {
  const { pendingRequestsCount } = useAuth();
  
  const tabs = [
    { id: 'feed', icon: Home, label: 'Feed', path: '/' },
    { id: 'search', icon: Search, label: 'Busca', path: '/search' },
    { id: 'post', icon: Plus, label: 'Postar', path: '/post', primary: true },
    { id: 'profile', icon: User, label: 'Perfil', path: '/profile' },
    { id: 'settings', icon: Settings, label: 'Ajustes', path: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bottom-nav px-4 pt-2 pb-safe-bottom z-50">
      <div className="flex justify-between items-center max-w-lg mx-auto h-16">
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.path}
            id={`nav-${tab.id}`}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center relative transition-colors ${
                isActive ? 'text-moss-400' : 'text-gray-500'
              } ${tab.primary ? 'mt-[-32px]' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                {tab.primary ? (
                  <div className="bg-moss-500 text-white p-4 rounded-2xl shadow-lg shadow-moss-900/40">
                    <tab.icon size={28} />
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <tab.icon size={24} className={isActive ? 'green-glow' : ''} />
                    </div>
                    <span className={`text-[10px] mt-1 uppercase tracking-widest font-bold ${isActive ? 'text-moss-400' : 'text-gray-500'}`}>
                      {tab.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute -top-2 w-1 h-1 bg-moss-400 rounded-full"
                      />
                    )}
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
