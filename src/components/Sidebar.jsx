import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { 
  Boxes, 
  ClipboardList, 
  Settings, 
  Moon, 
  Sun, 
  User, 
  ChevronRight,
  Database
} from "lucide-react";

export default function Sidebar() {
  const { 
    activeTab, 
    setActiveTab, 
    currentUser, 
    setCurrentUser, 
    USERS, 
    theme, 
    setTheme,
    isFirebaseConfigured
  } = useApp();

  const [showUserMenu, setShowUserMenu] = useState(false);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <div className="w-20 md:w-24 glass-sidebar flex flex-col items-center justify-between py-6 shrink-0 transition-colors duration-300">
      {/* Top Logo / App Icon */}
      <div className="flex flex-col items-center gap-1">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white hover:scale-105 transition-transform duration-200">
          <Boxes className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 mt-1">IR v1.0</span>
      </div>

      {/* Navigation Links */}
      <div className="flex flex-col gap-6">
        <button
          onClick={() => setActiveTab("inventario")}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${
            activeTab === "inventario"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10 dark:bg-white dark:text-slate-900 dark:shadow-white/10"
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          }`}
          title="Inventario"
        >
          <Boxes className="w-5.5 h-5.5" />
        </button>

        <button
          onClick={() => setActiveTab("pedidos")}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${
            activeTab === "pedidos"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10 dark:bg-white dark:text-slate-900 dark:shadow-white/10"
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          }`}
          title="Órdenes y Pedidos"
        >
          <ClipboardList className="w-5.5 h-5.5" />
        </button>
      </div>

      {/* User Simulator & Bottom Controls */}
      <div className="flex flex-col items-center gap-5 relative">
        
        {/* User Simulation Selector */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-12 h-12 rounded-full ring-2 ring-sky-500/30 overflow-hidden hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center bg-slate-200"
            title="Cambiar Usuario (Simulador Multiusuario)"
          >
            {currentUser.avatar ? (
              <img 
                src={currentUser.avatar} 
                alt={currentUser.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-5 h-5 text-slate-500" />
            )}
          </button>

          {/* Real-time Indicator Dot */}
          <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
            isFirebaseConfigured ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
          }`} 
            title={isFirebaseConfigured ? "Firebase Firestore Conectado (Real-time)" : "Fallback Local Reactivo Activo (Multiusuario entre Pestañas)"}
          />

          {showUserMenu && (
            <div className="absolute left-16 bottom-0 w-64 glass-card p-3 rounded-2xl shadow-xl z-50 animate-fade-in flex flex-col gap-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                Simular Usuario:
              </h4>
              <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
              {USERS.map((user) => (
                <button
                  key={user.name}
                  onClick={() => {
                    setCurrentUser(user);
                    setShowUserMenu(false);
                  }}
                  className={`flex items-center gap-3 w-full p-2 rounded-xl transition-colors duration-150 ${
                    currentUser.name === user.name
                      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div className="text-left">
                    <p className="text-xs font-semibold">{user.name.split(" ")[0]}</p>
                    <p className="text-[10px] text-slate-400">{user.role}</p>
                  </div>
                  {currentUser.name === user.name && (
                    <ChevronRight className="w-4 h-4 ml-auto text-sky-500" />
                  )}
                </button>
              ))}
              <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
              <div className="flex items-center gap-1.5 px-2 text-[10px] text-slate-400">
                <Database className="w-3.5 h-3.5 text-sky-500" />
                <span>Modo: {isFirebaseConfigured ? "Firebase Cloud" : "Sinc local reactiva"}</span>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggler */}
        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200"
          title={theme === "light" ? "Modo Oscuro" : "Modo Claro"}
        >
          {theme === "light" ? (
            <Moon className="w-5 h-5 text-slate-500 hover:text-slate-900" />
          ) : (
            <Sun className="w-5 h-5 text-amber-400 hover:text-amber-300" />
          )}
        </button>

        {/* Settings Button */}
        <button
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200"
          title="Configuración"
        >
          <Settings className="w-5 h-5 hover:text-slate-800 dark:hover:text-slate-200" />
        </button>
      </div>
    </div>
  );
}
