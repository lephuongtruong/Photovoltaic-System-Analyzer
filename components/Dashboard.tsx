
import React, { useContext } from 'react';
import { LanguageContext } from '../App';

const Dashboard: React.FC = () => {
  const { t } = useContext(LanguageContext);

  const features = [
    {
      icon: "fa-microchip",
      title: t.diodeModel,
      desc: t.diodeFeatureDesc,
      color: "bg-blue-600"
    },
    {
      icon: "fa-thermometer-half",
      title: t.tempModel,
      desc: t.tempFeatureDesc,
      color: "bg-orange-500"
    },
    {
      icon: "fa-chart-bar",
      title: t.prModel,
      desc: t.prFeatureDesc,
      color: "bg-indigo-500"
    },
    {
      icon: "fa-calculator",
      title: t.liuJordan,
      desc: t.liuJordanFeatureDesc,
      color: "bg-violet-500"
    },
    {
      icon: "fa-tasks",
      title: t.analysis,
      desc: t.analysisFeatureDesc,
      color: "bg-emerald-500"
    }
  ];

  return (
    <div className="space-y-12 animate-fadeIn pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[40px] bg-[#020617] text-white p-12 shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-10 text-[250px] pointer-events-none rotate-12">
          <i className="fas fa-solar-panel"></i>
        </div>
        <div className="relative z-10 max-w-4xl">
          <h2 className="text-5xl font-black mb-8 leading-[1.2] tracking-tight">
            {t.heroTitle} <br/> <span className="text-blue-400">{t.heroSubtitle}</span> <br/> 
            <span className="text-2xl font-bold text-slate-400">{t.heroVersion}</span>
          </h2>
          <p className="text-slate-300 text-lg font-medium mb-10 leading-relaxed">
            {t.heroDesc}
          </p>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                <i className="fas fa-satellite text-blue-400"></i>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase">{t.dataSource}</p>
                <p className="text-sm font-bold">NASA POWER</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                <i className="fas fa-shield-alt text-emerald-400"></i>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase">{t.standard}</p>
                <p className="text-sm font-bold">IEC 61724-1</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {features.map((f, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group cursor-default flex flex-col items-center text-center">
            <div className={`w-12 h-12 ${f.color} text-white rounded-2xl flex items-center justify-center text-xl mb-4 shadow-lg group-hover:rotate-12 transition-transform`}>
              <i className={`fas ${f.icon}`}></i>
            </div>
            <h3 className="text-sm font-black text-blue-900 mb-2 uppercase tracking-tight">{f.title}</h3>
            <p className="text-[11px] text-gray-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Key Benefits */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="flex flex-col items-center text-center p-6">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl mb-4">
            <i className="fas fa-microscope"></i>
          </div>
          <h4 className="font-black text-blue-900 mb-2">{t.benefitAccuracy}</h4>
          <p className="text-sm text-gray-500">{t.benefitAccuracyDesc}</p>
        </div>
        <div className="flex flex-col items-center text-center p-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl mb-4">
            <i className="fas fa-bolt"></i>
          </div>
          <h4 className="font-black text-blue-900 mb-2">{t.benefitRealtime}</h4>
          <p className="text-sm text-gray-500">{t.benefitRealtimeDesc}</p>
        </div>
        <div className="flex flex-col items-center text-center p-6">
          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-2xl mb-4">
            <i className="fas fa-file-contract"></i>
          </div>
          <h4 className="font-black text-blue-900 mb-2">{t.benefitStandard}</h4>
          <p className="text-sm text-gray-500">{t.benefitStandardDesc}</p>
        </div>
      </section>

      {/* Quick Stats / Info */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm">
          <h3 className="text-xl font-black text-blue-900 mb-8 flex items-center gap-3">
            <i className="fas fa-info-circle text-blue-500"></i> {t.guideTitle}
          </h3>
          <ul className="space-y-6">
            <li className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black flex-shrink-0">1</div>
              <div>
                <p className="font-bold text-gray-800">{t.guideStep1}</p>
                <p className="text-sm text-gray-500">{t.guideStep1Desc}</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black flex-shrink-0">2</div>
              <div>
                <p className="font-bold text-gray-800">{t.guideStep2}</p>
                <p className="text-sm text-gray-500">{t.guideStep2Desc}</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black flex-shrink-0">3</div>
              <div>
                <p className="font-bold text-gray-800">{t.guideStep3}</p>
                <p className="text-sm text-gray-500">{t.guideStep3Desc}</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="bg-slate-50 p-10 rounded-[40px] border border-slate-200 relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 text-[150px] text-slate-200/50">
            <i className="fas fa-globe-asia"></i>
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-4 relative z-10 flex items-center gap-2">
            <i className="fas fa-leaf text-emerald-500"></i> {t.envTitle}
          </h3>
          <p className="text-slate-600 mb-8 relative z-10 leading-relaxed">
            {t.envDesc}
          </p>
          <div className="grid grid-cols-2 gap-4 relative z-10">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t.co2Reduction}</p>
              <p className="text-xl font-black text-emerald-600">0.52 <span className="text-xs font-bold text-slate-400">kg/kWh</span></p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t.treeEquivalent}</p>
              <p className="text-xl font-black text-blue-600">24 <span className="text-xs font-bold text-slate-400">trees/kWp</span></p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
