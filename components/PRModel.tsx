
import React, { useState, useMemo, useEffect, useContext } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ComposedChart, Line, Legend } from 'recharts';
import { LanguageContext } from '../App';

const DEFAULT_REGIONAL_DATA = {
  "Hồ Chí Minh": {
    lat: 10.8,
    months: [
      { ghi_daily: 5.2, temp: 27 }, { ghi_daily: 5.8, temp: 28 }, { ghi_daily: 6.1, temp: 29 },
      { ghi_daily: 5.9, temp: 30 }, { ghi_daily: 5.1, temp: 29 }, { ghi_daily: 4.5, temp: 28 },
      { ghi_daily: 4.4, temp: 27 }, { ghi_daily: 4.6, temp: 27 }, { ghi_daily: 4.2, temp: 27 },
      { ghi_daily: 4.1, temp: 27 }, { ghi_daily: 4.3, temp: 27 }, { ghi_daily: 4.8, temp: 27 }
    ]
  },
  "Hà Nội": {
    lat: 21.0,
    months: [
      { ghi_daily: 2.1, temp: 17 }, { ghi_daily: 2.3, temp: 18 }, { ghi_daily: 2.8, temp: 21 },
      { ghi_daily: 3.9, temp: 24 }, { ghi_daily: 5.2, temp: 28 }, { ghi_daily: 5.5, temp: 30 },
      { ghi_daily: 5.4, temp: 30 }, { ghi_daily: 5.1, temp: 29 }, { ghi_daily: 4.8, temp: 28 },
      { ghi_daily: 4.2, temp: 25 }, { ghi_daily: 3.5, temp: 22 }, { ghi_daily: 2.7, temp: 19 }
    ]
  }
};

const PRModel: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  
  const strings = {
    vi: {
      title: "Dữ liệu khí hậu (PR Model)",
      subtitle: "Sử dụng dữ liệu khí hậu đã lưu để tính toán",
      annualGhi: "Bức xạ tích lũy năm",
      dailyGhi: "Bức xạ trung bình ngày",
      chartClimate: "Tương quan Khí hậu Tháng",
      areaLabel: "Diện tích A (m²)",
      effLabel: "Hiệu suất η (%)",
      btnCalc: "Tính toán sản lượng",
      chartYield: "Dự báo Sản lượng Tháng (kWh) - Mô hình PR",
      totalYearly: "Tổng sản lượng năm",
      formulaTitle: "Giải trình công thức PR (Thế số thực tế)"
    },
    en: {
      title: "Climate Data (PR Model)",
      subtitle: "Using saved climate data for calculation",
      annualGhi: "Annual Cumulative GHI",
      dailyGhi: "Avg Daily GHI",
      chartClimate: "Monthly Climate Correlation",
      areaLabel: "Area A (m²)",
      effLabel: "Efficiency η (%)",
      btnCalc: "Calculate Yield",
      chartYield: "Monthly Yield Forecast (kWh) - PR Model",
      totalYearly: "Total Annual Yield",
      formulaTitle: "PR Calculation (With Actual Values)"
    }
  }[lang];

  const [regionalData, setRegionalData] = useState(() => {
    const saved = localStorage.getItem('solar_regional_data');
    return saved ? JSON.parse(saved) : DEFAULT_REGIONAL_DATA;
  });

  const [selectedRegion, setSelectedRegion] = useState<string>("Hồ Chí Minh");
  const [pr, setPr] = useState(0.8);
  const [area, setArea] = useState(100);
  const [eff, setEff] = useState(0.18);
  const [calculationResults, setCalculationResults] = useState<{
    monthlyData: any[],
    totalYearly: number
  } | null>(null);

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('solar_regional_data');
      if (saved) setRegionalData(JSON.parse(saved));
    };
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 2000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const climateChartData = useMemo(() => {
    const data = regionalData[selectedRegion];
    if (!data) return [];
    return data.months.map((m: any, i: number) => ({
      month: `${lang === 'vi' ? 'T' : 'M'}${i + 1}`,
      ghi: m.ghi_daily,
      temp: m.temp
    }));
  }, [selectedRegion, regionalData, lang]);

  const yearlyStats = useMemo(() => {
    const data = regionalData[selectedRegion];
    if (!data) return { avgDaily: 0, totalYearlyGhi: 0 };
    const totalDaily = data.months.reduce((acc: number, m: any) => acc + m.ghi_daily, 0);
    const avgDaily = totalDaily / 12;
    const totalYearlyGhi = data.months.reduce((acc: number, m: any) => acc + (m.ghi_daily * 30), 0);
    return { avgDaily, totalYearlyGhi };
  }, [selectedRegion, regionalData]);

  const calculateYearlyPR = () => {
    const data = regionalData[selectedRegion];
    if (!data) return;
    let totalYearlyEnergy = 0;
    const results = data.months.map((m: any, i: number) => {
      const monthlyEnergy = pr * area * eff * m.ghi_daily * 30;
      totalYearlyEnergy += monthlyEnergy;
      return { label: `${lang === 'vi' ? 'T' : 'M'}${i + 1}`, energy: monthlyEnergy };
    });
    setCalculationResults({ monthlyData: results, totalYearly: totalYearlyEnergy });
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
          <div>
            <h3 className="text-xl font-black text-blue-900 uppercase flex items-center gap-3">
              <i className="fas fa-database text-blue-500"></i> {strings.title}
            </h3>
            <p className="text-xs text-gray-400 mt-1">{strings.subtitle}</p>
          </div>
          <select 
            value={selectedRegion} 
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="bg-blue-600 text-white border-none rounded-2xl px-6 py-3 font-bold outline-none cursor-pointer shadow-lg"
          >
            {Object.keys(regionalData).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-orange-50 border border-orange-100 p-6 rounded-2xl flex items-center gap-5">
            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white text-xl shadow-lg">
              <i className="fas fa-sun"></i>
            </div>
            <div>
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{strings.annualGhi}</p>
              <p className="text-2xl font-black text-orange-900 tabular-nums">
                {yearlyStats.totalYearlyGhi.toLocaleString(undefined, {maximumFractionDigits: 0})} 
                <span className="text-sm font-bold ml-1">kWh/m²</span>
              </p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex items-center gap-5">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl shadow-lg">
              <i className="fas fa-cloud-sun"></i>
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{strings.dailyGhi}</p>
              <p className="text-2xl font-black text-blue-900 tabular-nums">
                {yearlyStats.avgDaily.toFixed(2)} 
                <span className="text-sm font-bold ml-1">kWh/m²</span>
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-2xl">
          <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest text-center">{strings.chartClimate} ({selectedRegion})</h4>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={climateChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700}} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} unit=" kWh" tick={{fontSize: 10}} label={{ value: 'GHI (kWh)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} unit=" °C" tick={{fontSize: 10}} label={{ value: 'Temp (°C)', angle: 90, position: 'insideRight', fontSize: 10 }} />
                <Tooltip contentStyle={{borderRadius: '16px', border: 'none'}} />
                <Legend verticalAlign="top" iconType="circle" />
                <Bar yAxisId="left" dataKey="ghi" name="GHI Radiation" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="temp" name="Temperature" stroke="#ef4444" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Performance Ratio (PR)</label>
            <input type="number" step="0.01" value={pr} onChange={e => setPr(Number(e.target.value))} className="w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl font-bold text-blue-900" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{strings.areaLabel}</label>
            <input type="number" value={area} onChange={e => setArea(Number(e.target.value))} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{strings.effLabel}</label>
            <input type="number" step="0.01" value={eff} onChange={e => setEff(Number(e.target.value))} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold" />
          </div>
        </div>
        <div className="flex justify-center">
          <button onClick={calculateYearlyPR} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-12 py-4 rounded-2xl shadow-lg transition-all flex items-center gap-3 uppercase text-xs tracking-widest">
            <i className="fas fa-chart-line"></i> {strings.btnCalc}
          </button>
        </div>
      </section>

      {calculationResults && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <h4 className="text-[10px] font-black text-gray-400 uppercase mb-6 tracking-widest text-center">{strings.chartYield}</h4>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={calculationResults.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} label={{ value: 'Yield (kWh)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <Tooltip formatter={(val: number) => [`${val.toLocaleString()} kWh`, 'Yield']} />
                <Bar dataKey="energy" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-blue-900 text-white p-8 rounded-[40px] shadow-2xl flex flex-col justify-center">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{strings.totalYearly}</span>
            <div className="text-5xl font-black mt-2">
              {calculationResults.totalYearly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="text-xl font-normal opacity-50 ml-2">kWh</span>
            </div>
          </div>

          <section className="lg:col-span-3 bg-white rounded-3xl shadow-xl border border-gray-100 p-8 mt-8">
            <h3 className="text-lg font-black text-blue-900 uppercase mb-8 flex items-center gap-3 border-b pb-4">
              <i className="fas fa-info-circle text-blue-500"></i> {strings.formulaTitle}
            </h3>
            <div className="bg-blue-50/50 p-8 rounded-3xl border border-blue-100">
               <p className="text-sm font-medium text-blue-900 mb-6 leading-relaxed">
                  Công thức tính sản lượng dựa trên hiệu suất hệ thống thực tế (PR):
               </p>
               <div className="bg-white p-6 rounded-2xl shadow-inner border border-blue-50 font-mono text-blue-800 text-lg mb-8">
                  E = PR × A × η × GHI_annual
               </div>
               
               {/* Numerical Substitution */}
               <div className="bg-white p-6 rounded-2xl border border-blue-200 mb-8 font-mono text-[14px] text-blue-700">
                  <span className="text-gray-400">// Thế số:</span><br/>
                  E = {pr} × {area.toLocaleString()} × {eff} × {yearlyStats.totalYearlyGhi.toLocaleString()} <br/>
                  E = <span className="font-black text-blue-900">{(pr * area * eff * yearlyStats.totalYearlyGhi).toLocaleString(undefined, {maximumFractionDigits: 0})} kWh/năm</span>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <p className="flex justify-between border-b border-blue-100 pb-2">
                      <span className="text-[10px] font-black text-blue-400 uppercase">Hệ số PR:</span>
                      <span className="font-bold">{pr}</span>
                    </p>
                    <p className="flex justify-between border-b border-blue-100 pb-2">
                      <span className="text-[10px] font-black text-blue-400 uppercase">Diện tích (A):</span>
                      <span className="font-bold">{area.toLocaleString()} m²</span>
                    </p>
                    <p className="flex justify-between border-b border-blue-100 pb-2">
                      <span className="text-[10px] font-black text-blue-400 uppercase">Hiệu suất (η):</span>
                      <span className="font-bold">{(eff * 100).toFixed(1)}%</span>
                    </p>
                  </div>
                  <div className="space-y-3">
                    <p className="flex justify-between border-b border-blue-100 pb-2">
                      <span className="text-[10px] font-black text-blue-400 uppercase">Bức xạ GHI:</span>
                      <span className="font-bold">{yearlyStats.totalYearlyGhi.toLocaleString()} kWh/m²</span>
                    </p>
                    <div className="pt-2 text-right">
                       <p className="text-[10px] font-black text-orange-600 uppercase">Kết quả cuối cùng:</p>
                       <p className="text-2xl font-black text-orange-700">
                          {(pr * area * eff * yearlyStats.totalYearlyGhi).toLocaleString(undefined, {maximumFractionDigits: 0})} kWh
                       </p>
                    </div>
                  </div>
               </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default PRModel;
