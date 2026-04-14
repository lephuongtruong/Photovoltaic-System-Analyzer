
import React, { useState, useMemo, useEffect, useContext } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Legend } from 'recharts';
import { LanguageContext } from '../App';
import { VIETNAM_PROVINCES, DEFAULT_REGIONAL_DATA } from '../constants';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ModelType } from '../types';

const PRModel: React.FC = () => {
  const { t, lang, user, selectedSimulation, setSelectedSimulation } = useContext(LanguageContext);
  const [loadingNasa, setLoadingNasa] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [projectName, setProjectName] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  
  const [regionalData, setRegionalData] = useState(() => {
    const saved = localStorage.getItem('solar_regional_data_enhanced');
    const data = saved ? JSON.parse(saved) : DEFAULT_REGIONAL_DATA;
    // Sync with VIETNAM_PROVINCES to ensure new provinces are included
    const syncedData = { ...DEFAULT_REGIONAL_DATA };
    Object.keys(VIETNAM_PROVINCES).forEach(name => {
      if (data[name]) syncedData[name] = data[name];
    });
    return syncedData;
  });

  const [selectedRegion, setSelectedRegion] = useState<string>("Hà Nội");
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState<number>(15);
  const [calcMode, setCalcMode] = useState<'hourly' | 'monthly'>('hourly');
  const [hourlyMethod, setHourlyMethod] = useState<'liu-jordan' | 'nasa'>('liu-jordan');
  
  const [inputs, setInputs] = useState({ area: 100, efficiency: 0.18, pr: 0.8, ghi: 4.5, pTotalKw: 5, pModuleW: 450 });
  const [results, setResults] = useState<{ data: any[], totalValue: number, mode: 'hourly' | 'monthly', method: 'liu-jordan' | 'nasa', noonMetrics?: any, nModules?: number, pDcActualKw?: number } | null>(null);

  const monthCumulativeDays = useMemo(() => [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], []);

  useEffect(() => {
    const region = regionalData[selectedRegion] || Object.values(regionalData)[0];
    if (region && region.months) {
      if (region.hasNasa) setHourlyMethod('nasa');
      else setHourlyMethod('liu-jordan');

      const dayOfYear = monthCumulativeDays[selectedMonthIdx] + selectedDay;
      const ghi = (region.dailyGhi && region.dailyGhi[dayOfYear - 1]) ? region.dailyGhi[dayOfYear - 1] : region.months[selectedMonthIdx].ghi_daily;
      setInputs(prev => ({ ...prev, ghi: ghi }));
    }
  }, [selectedMonthIdx, selectedDay, selectedRegion, regionalData, monthCumulativeDays]);

  // Handle loading from history
  useEffect(() => {
    if (selectedSimulation && selectedSimulation.modelType === ModelType.PR) {
      const { inputs, results: savedResults } = selectedSimulation;
      if (inputs.region) setSelectedRegion(inputs.region);
      if (inputs.selectedMonthIdx !== undefined) setSelectedMonthIdx(inputs.selectedMonthIdx);
      if (inputs.selectedDay !== undefined) setSelectedDay(inputs.selectedDay);
      if (inputs.calcMode) setCalcMode(inputs.calcMode);
      if (inputs.hourlyMethod) setHourlyMethod(inputs.hourlyMethod);
      if (inputs.inputs) setInputs(inputs.inputs);
      
      if (savedResults) {
        setResults(savedResults);
      }
      
      setSelectedSimulation(null);
    }
  }, [selectedSimulation, setSelectedSimulation]);

  const fetchNasaData = async () => {
    const province = VIETNAM_PROVINCES[selectedRegion];
    if (!province) return;
    setLoadingNasa(true);
    try {
      const start = "20230101", end = "20231231";
      const params = "ALLSKY_SFC_SW_DWN,T2M";
      const url = `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=${params}&community=RE&longitude=${province.lon}&latitude=${province.lat}&start=${start}&end=${end}&format=JSON&time-standard=lst`;
      const response = await fetch(url);
      const data = await response.json();
      const hourlySolar = data.properties.parameter.ALLSKY_SFC_SW_DWN;
      const dailyGhi = Array(366).fill(0);
      const monthlyAgg: any = {};
      Object.keys(hourlySolar).forEach((timestamp) => {
        const month = parseInt(timestamp.substring(4, 6));
        const day = parseInt(timestamp.substring(6, 8));
        const hour = parseInt(timestamp.substring(8, 10));
        const date = new Date(2023, month - 1, day);
        const startOfYear = new Date(2023, 0, 0);
        const diff = (date.getTime() - startOfYear.getTime()) + ((startOfYear.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
        const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
        const valSolar = hourlySolar[timestamp];
        if (valSolar > -900) {
          dailyGhi[dayOfYear - 1] += valSolar;
          if (!monthlyAgg[month]) { monthlyAgg[month] = { solarSum: 0, count: 0, hourProfile: { ghi: Array(24).fill(0), counts: Array(24).fill(0) } }; }
          monthlyAgg[month].solarSum += valSolar;
          monthlyAgg[month].hourProfile.ghi[hour] += valSolar;
          monthlyAgg[month].hourProfile.counts[hour]++;
          monthlyAgg[month].count++;
        }
      });
      for (let i = 0; i < 366; i++) dailyGhi[i] /= 1000;
      const newMonths = Array(12).fill(null).map((_, i) => {
        const agg = monthlyAgg[i+1];
        const days = (agg && agg.count > 0) ? agg.count / 24 : 30;
        return {
          ghi_daily: agg ? (agg.solarSum / 1000 / days) : 4.5,
          temp: 25,
          hourlyProfile: Array(24).fill(null).map((_, h) => ({
            ghi: (agg && agg.hourProfile.counts[h] > 0) ? agg.hourProfile.ghi[h] / agg.hourProfile.counts[h] : 0,
            temp: 25
          }))
        };
      });
      const updated = { 
        ...regionalData, 
        [selectedRegion]: { 
          lat: province.lat, 
          lon: province.lon, 
          months: newMonths, 
          dailyGhi, 
          dailyTemp: Array(366).fill(25),
          hasNasa: true 
        } 
      };
      setRegionalData(updated);
      localStorage.setItem('solar_regional_data_enhanced', JSON.stringify(updated));
      alert(t.nasaUpdateSuccessPr);
    } catch (err) { alert("NASA API Error"); } finally { setLoadingNasa(false); }
  };

  const saveSimulation = async (results: any) => {
    if (!user) return;

    const finalName = projectName.trim() || `${t.prModel} - ${selectedRegion}`;

    setIsSaving(true);
    setSaveStatus(null);
    try {
      await addDoc(collection(db, 'simulations'), {
        userId: user.uid,
        modelType: ModelType.PR,
        projectName: finalName,
        timestamp: serverTimestamp(),
        inputs: {
          region: selectedRegion,
          inputs,
          calcMode,
          hourlyMethod,
          selectedMonthIdx,
          selectedDay
        },
        results: results,
        metadata: {
          location: selectedRegion,
          description: `PR Model Simulation for ${selectedRegion}`
        }
      });
      setSaveStatus({ type: 'success', msg: t.projectSaved });
      setProjectName("");
    } catch (error) {
      console.error("Error saving simulation:", error);
      setSaveStatus({ type: 'error', msg: lang === 'vi' ? 'Lỗi khi lưu dự án. Vui lòng thử lại.' : 'Error saving project. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCalculate = () => {
    const { area, efficiency, pr, ghi, pTotalKw, pModuleW } = inputs;
    const regionData = regionalData[selectedRegion] || Object.values(regionalData)[0];
    if (!regionData || !regionData.months) return;

    // Logic tính số lượng tấm pin
    const pTotalW = pTotalKw * 1000;
    const nModules = Math.ceil(pTotalW / pModuleW);
    const pDcActualW = nModules * pModuleW;
    const pDcActualKw = pDcActualW / 1000;

    if (calcMode === 'hourly') {
      const dayOfYear = monthCumulativeDays[selectedMonthIdx] + selectedDay;
      const delta = 23.45 * Math.sin((360 / 365) * (284 + dayOfYear) * (Math.PI / 180));
      const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(regionData.lat * Math.PI / 180) * Math.tan(delta * Math.PI / 180))));
      const wsDeg = ws * 180 / Math.PI;

      let totalE = 0, hourlyData = [], noonMetrics: any = null;

      // Tính scaling factor cho GHI ngày nếu dùng phương pháp NASA
      const monthAvgGhi = regionData.months[selectedMonthIdx].ghi_daily;
      const ghiScalingFactor = monthAvgGhi > 0 ? (ghi / monthAvgGhi) : 1;

      for (let t = 0; t < 24; t++) {
        let It = 0;
        if (hourlyMethod === 'liu-jordan') {
          const omega = 15 * (t + 0.5 - 12);
          if (Math.abs(omega) <= wsDeg) {
            const rt = (Math.PI / 24) * (Math.cos(omega * Math.PI / 180) - Math.cos(ws)) / (Math.sin(ws) - ws * Math.cos(ws));
            It = (ghi * 1000) * Math.max(0, rt);
          }
        } else { 
          // Áp dụng scaling factor để profile khớp với tổng GHI ngày đã chọn
          It = regionData.months[selectedMonthIdx].hourlyProfile[t].ghi * ghiScalingFactor; 
        }

        // Et = (It / 1000) * P_dc_actual_kWp * PR
        const Et = (It / 1000) * pDcActualKw * pr;
        totalE += Et;
        if (t === 12) noonMetrics = { It, Et, pr, area, efficiency, pDcActualKw, nModules, type: 'hourly' };
        hourlyData.push({ label: `${t}h`, energy: Et });
      }
      const results = { data: hourlyData, totalValue: totalE, mode: 'hourly', method: hourlyMethod, noonMetrics, nModules, pDcActualKw };
      setResults(results);
    } else {
      let totalYearly = 0, monthlyMetricsSelected: any = null;
      const monthlyData = regionData.months.map((m: any, idx: number) => {
        let totalDayE = 0;
        for (let t = 0; t < 24; t++) {
          let It = 0;
          if (hourlyMethod === 'liu-jordan') {
            It = (m.ghi_daily * 1000) * 0.1;
          } else {
            It = m.hourlyProfile[t].ghi;
          }
          // Et = (It / 1000) * P_dc_actual_kWp * PR
          totalDayE += (It / 1000) * pDcActualKw * pr;
        }
        const yieldMonth = totalDayE * 30;
        totalYearly += yieldMonth;
        if (idx === selectedMonthIdx) monthlyMetricsSelected = { H_month: m.ghi_daily * 30, E_month: yieldMonth, pr, area, efficiency, pDcActualKw, nModules, type: 'monthly' };
        return { label: `T${idx + 1}`, energy: yieldMonth };
      });
      const results = { data: monthlyData, totalValue: totalYearly, mode: 'monthly', method: hourlyMethod, noonMetrics: monthlyMetricsSelected, nModules, pDcActualKw };
      setResults(results);
    }
  };

  const climateChartData = useMemo(() => {
    const data = regionalData[selectedRegion] || Object.values(regionalData)[0];
    if (!data || !data.months) return [];
    return data.months.map((m: any, i: number) => ({ month: `T${i + 1}`, ghi: m.ghi_daily }));
  }, [selectedRegion, regionalData]);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
          <div>
            <h3 className="text-xl font-black text-blue-900 uppercase flex items-center gap-3"><i className="fas fa-database text-blue-500"></i> {t.prModelTitle}</h3>
            <p className="text-xs text-gray-400 mt-1">{t.prModelSubtitle}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchNasaData} disabled={loadingNasa} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-md disabled:opacity-50"><i className={`fas ${loadingNasa ? 'fa-spinner fa-spin' : 'fa-cloud-download-alt'}`}></i> {t.btnNasa}</button>
            <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="bg-blue-900 text-white border-none rounded-2xl px-6 py-3 font-bold outline-none cursor-pointer">
              {Object.keys(VIETNAM_PROVINCES).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="bg-blue-50 p-4 rounded-2xl mb-6 text-center">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{t.dataSourceLabel}</span>
            <p className="font-bold text-blue-800">{hourlyMethod === 'nasa' ? t.nasaHourlyReal : t.liuJordanSim}</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-gray-50 rounded-3xl p-6">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={climateChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                <Bar dataKey="ghi" fill="#fbbf24" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-inner max-h-[250px] overflow-y-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-50">
                {climateChartData.map((d, i) => (
                  <tr key={i} className={`hover:bg-blue-50 cursor-pointer ${selectedMonthIdx === i ? 'bg-blue-50 border-l-4 border-blue-600 font-bold' : ''}`} onClick={() => setSelectedMonthIdx(i)}>
                    <td className="py-2 px-4 font-bold">{d.month}</td>
                    <td className="py-2 px-4 text-right text-orange-600 font-mono">{d.ghi.toFixed(2)} kWh/m²</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest">GHI (NASA/Auto)</label>
            <div className="w-full p-4 bg-orange-50 border border-orange-200 rounded-2xl font-black text-orange-900 shadow-inner flex justify-between items-center">
              <span>{inputs.ghi.toFixed(2)}</span>
              <span className="text-[9px] opacity-60">kWh/m²/d</span>
            </div>
            <p className="text-[9px] text-gray-400 italic px-1">{t.ghiDesc}</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{t.pTotalLabel}</label>
            <div className="relative">
              <input type="number" value={inputs.pTotalKw} onChange={e => setInputs({ ...inputs, pTotalKw: Number(e.target.value) })} className="w-full p-4 bg-blue-50 border border-blue-200 rounded-2xl font-bold text-blue-900 outline-none pr-12" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-400">kWp</span>
            </div>
            <p className="text-[9px] text-gray-400 italic px-1">{t.pTotalDesc}</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{t.pModuleLabel}</label>
            <div className="relative">
              <input type="number" value={inputs.pModuleW} onChange={e => setInputs({ ...inputs, pModuleW: Number(e.target.value) })} className="w-full p-4 bg-blue-50 border border-blue-200 rounded-2xl font-bold text-blue-900 outline-none pr-12" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-400">Wp</span>
            </div>
            <p className="text-[9px] text-gray-400 italic px-1">{t.pModuleDesc}</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.prLabel}</label>
            <input type="number" step="0.01" value={inputs.pr} onChange={e => setInputs({ ...inputs, pr: Number(e.target.value) })} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold outline-none" />
            <p className="text-[9px] text-gray-400 italic px-1">{t.prDesc}</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{t.dayLabel}</label>
            <input type="number" min="1" max="31" value={selectedDay} onChange={e => setSelectedDay(Math.max(1, Math.min(31, Number(e.target.value))))} className="w-full p-4 bg-blue-50 border border-blue-200 rounded-2xl font-bold text-blue-900 outline-none" />
            <p className="text-[9px] text-gray-400 italic px-1">{t.dayDesc}</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-10 p-6 bg-gray-50 rounded-3xl">
          <button onClick={() => setCalcMode('hourly')} className={`px-8 py-3 rounded-xl text-[11px] font-black transition-all ${calcMode === 'hourly' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500'}`}>{t.hourlyCalcBtn}</button>
          <button onClick={() => setCalcMode('monthly')} className={`px-8 py-3 rounded-xl text-[11px] font-black transition-all ${calcMode === 'monthly' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500'}`}>{t.monthlyCalcBtn}</button>
          <button onClick={handleCalculate} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-12 py-3 rounded-2xl shadow-lg transition-all flex items-center gap-3 uppercase text-xs tracking-widest"><i className="fas fa-play"></i> {t.btnCalc}</button>
          {results && (
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative min-w-[200px]">
                <input 
                  type="text"
                  placeholder={t.enterProjectName}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm outline-none"
                />
              </div>
              <button 
                onClick={() => saveSimulation(results)}
                disabled={isSaving || !user}
                className={`px-8 py-3 rounded-2xl font-black transition-all shadow-lg flex items-center justify-center gap-2 uppercase text-xs tracking-widest ${
                  !user 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                }`}
              >
                {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                {!user ? t.loginToSave : t.saveProject}
              </button>
            </div>
          )}
        </div>
        {saveStatus && (
          <div className={`mt-4 text-[10px] font-bold text-center p-2 rounded-xl max-w-xs mx-auto ${saveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {saveStatus.msg}
          </div>
        )}
      </section>

      {/* Kết quả */}
      {results && results.noonMetrics && (
        <div className="space-y-8 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
               <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={results.data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} />
                    <YAxis unit=" kWh" axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                    <Bar dataKey="energy" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
            <div className="bg-blue-900 text-white p-8 rounded-[40px] shadow-2xl flex flex-col justify-center text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl"><i className="fas fa-chart-line"></i></div>
               <span className="text-xs opacity-60 uppercase z-10">{t.totalYieldPrModel}</span>
               <div className="text-6xl font-black mt-2 text-orange-400 z-10">{results.totalValue.toFixed(1)} <span className="text-xl font-normal text-white">kWh</span></div>
               
               <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 z-10">
                  <div className="text-left">
                    <p className="text-[9px] opacity-60 uppercase">{t.nModulesLabel}</p>
                    <p className="text-lg font-black text-white">{results.nModules}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] opacity-60 uppercase">{t.pDcActualLabel}</p>
                    <p className="text-lg font-black text-orange-400">{results.pDcActualKw?.toFixed(2)} kWp</p>
                  </div>
               </div>
               
               <p className="text-[10px] opacity-40 mt-4 font-bold">{hourlyMethod === 'nasa' ? 'Dựa trên NASA Hourly' : 'Dựa trên Dữ liệu Vùng'}</p>
            </div>
          </div>

          <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <h3 className="text-lg font-black text-blue-900 uppercase mb-8 flex items-center gap-3 border-b pb-4">
              <i className="fas fa-microscope text-blue-500"></i> {t.formulaTitlePrModel}
            </h3>
            <div className="space-y-8">
              <p className="text-sm text-gray-600 italic">{t.formulaDescPrModel}</p>
              {results.noonMetrics.type === 'hourly' ? (
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-black text-orange-600 uppercase mb-4">{t.step1It} ({t.exampleNoon}):</p>
                    <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 font-mono text-[13px] text-orange-900">
                      It = NASA_Profile_at_hour * Scaling_Factor <br/>
                      It = {results.noonMetrics.It.toFixed(2)} W/m² (Nguồn: {hourlyMethod === 'nasa' ? t.nasaHourlyReal : t.liuJordanSim})
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-black text-blue-600 uppercase mb-4">{t.step2Et}:</p>
                    <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 font-mono text-[13px] text-blue-900">
                      N_modules = ceil(P_total_installed_Wp / P_module_Wp) = {results.noonMetrics.nModules} <br/>
                      P_dc_actual_kWp = (N_modules * P_module_Wp) / 1000 = {results.noonMetrics.pDcActualKw?.toFixed(2)} kWp <br/>
                      Et = (It / 1000) * P_dc_actual_kWp * PR <br/>
                      Et = ({results.noonMetrics.It.toFixed(1)} / 1000) * {results.noonMetrics.pDcActualKw?.toFixed(2)} * {results.noonMetrics.pr} <br/>
                      <span className="font-bold text-xl text-blue-900">➔ Et = {results.noonMetrics.Et.toFixed(3)} kWh</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-black text-orange-600 uppercase mb-4">{t.formulaSubstitutionMonthly}</p>
                    <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 font-mono text-[13px] text-indigo-900">
                      H_month = H_daily_avg * 30 days <br/>
                      H_month = {results.noonMetrics.H_month.toFixed(1)} kWh/m² <br/><br/>
                      E_month = (H_month * P_dc_actual_kWp * PR) <br/>
                      E_month = ({results.noonMetrics.H_month.toFixed(1)} * {results.noonMetrics.pDcActualKw?.toFixed(2)} * {results.noonMetrics.pr}) <br/>
                      <span className="font-bold text-2xl text-indigo-900">➔ E_month = {results.noonMetrics.E_month.toFixed(1)} kWh</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default PRModel;
