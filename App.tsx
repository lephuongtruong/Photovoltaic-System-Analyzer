
import React, { useState, createContext, useContext } from 'react';
import { ModelType } from './types';
import TemperatureModel from './components/TemperatureModel';
import PRModel from './components/PRModel';
import PerformanceAnalysis from './components/PerformanceAnalysis';

// Dictionary for Internationalization
export const translations = {
  vi: {
    title: "Photovoltaic-System Analyzer",
    subtitle: "",
    tempModel: "Mô Hình Suy Giảm Nhiệt Độ",
    prModel: "Mô Hình PR",
    analysis: "Phân tích hiệu quả",
    footer: "© 2026 Photovoltaic System Analyzer – Developed by Le Phuong Truong",
    langBtn: "English"
  },
  en: {
    title: "Photovoltaic-System Analyzer",
    subtitle: "",
    tempModel: "Temperature Degradation Model",
    prModel: "PR Model",
    analysis: "Performance Analysis",
    footer: "© 2026 Photovoltaic System Analyzer – Developed by Le Phuong Truong",
    langBtn: "Tiếng Việt"
  }
};

type Language = 'vi' | 'en';
export const LanguageContext = createContext<{
  lang: Language;
  t: typeof translations.vi;
  setLang: (l: Language) => void;
}>({
  lang: 'vi',
  t: translations.vi,
  setLang: () => {},
});

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ModelType>(ModelType.TEMPERATURE);
  const [lang, setLang] = useState<Language>('vi');

  const t = translations[lang];

  const toggleLang = () => {
    setLang(lang === 'vi' ? 'en' : 'vi');
  };

  return (
    <LanguageContext.Provider value={{ lang, t, setLang }}>
      <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden min-h-[90vh] flex flex-col">
        {/* Header */}
        <header className="bg-[#1e40af] p-8 text-white text-center relative">
          <button 
            onClick={toggleLang}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-sm flex items-center gap-2 border border-white/30 transition-all font-bold"
          >
            <i className="fas fa-globe"></i> {t.langBtn}
          </button>
          <div className="flex justify-center items-center gap-4">
            <span className="text-4xl">☀️</span>
            <h1 className="text-3xl font-bold uppercase tracking-wide">
              {t.title}
            </h1>
          </div>
          {t.subtitle && (
            <p className="text-blue-100 font-light italic mt-2">
              {t.subtitle}
            </p>
          )}
        </header>

        {/* Tabs Navigation */}
        <nav className="flex bg-gray-100 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab(ModelType.TEMPERATURE)}
            className={`flex-1 min-w-[150px] py-4 px-6 text-center font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === ModelType.TEMPERATURE 
              ? 'bg-white text-blue-700 border-b-4 border-blue-600' 
              : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-thermometer-half"></i> {t.tempModel}
          </button>
          <button
            onClick={() => setActiveTab(ModelType.PR)}
            className={`flex-1 min-w-[150px] py-4 px-6 text-center font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === ModelType.PR 
              ? 'bg-white text-blue-700 border-b-4 border-blue-600' 
              : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-chart-bar"></i> {t.prModel}
          </button>
          <button
            onClick={() => setActiveTab(ModelType.ANALYSIS)}
            className={`flex-1 min-w-[180px] py-4 px-6 text-center font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === ModelType.ANALYSIS 
              ? 'bg-white text-blue-700 border-b-4 border-blue-600' 
              : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-tasks"></i> {t.analysis}
          </button>
        </nav>

        {/* Main Content Area */}
        <main className="flex-grow p-6 md:p-10 bg-[#f8fafc]">
          {activeTab === ModelType.TEMPERATURE && <TemperatureModel />}
          {activeTab === ModelType.PR && <PRModel />}
          {activeTab === ModelType.ANALYSIS && <PerformanceAnalysis />}
        </main>

        {/* Footer */}
        <footer className="p-4 bg-gray-50 text-center text-xs text-gray-400 border-t border-gray-100">
          {t.footer}
        </footer>
      </div>
    </LanguageContext.Provider>
  );
};

export default App;
