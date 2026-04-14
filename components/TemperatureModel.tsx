
import React, { useState, useMemo, useEffect, useContext } from 'react';
import { SolarInputs, ModelType } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ComposedChart, Line, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { LanguageContext } from '../App';
import { VIETNAM_PROVINCES, DEFAULT_REGIONAL_DATA } from '../constants';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const TemperatureModel: React.FC = () => {
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
  
  const [inputs, setInputs] = useState<SolarInputs>({
    ghi: 4.5, 
    latitude: 21.0285,
    dayOfYear: 15,
    area: 100,
    efficiency: 0.18,
    tempCoeff: 0.0045,
    noct: 45,
    ambientTemp: 25,
    pr: 0.86,
    pTotalKw: 5,
    pModuleW: 450
  });

  const [results, setResults] = useState<{
    data: any[],
    totalValue: number,
    mode: 'hourly' | 'monthly',
    method: 'liu-jordan' | 'nasa',
    liuJordanParams?: any,
    noonMetrics?: any,
    nModules?: number,
    pDcActualKw?: number
  } | null>(null);

  const monthCumulativeDays = useMemo(() => [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], []);

  useEffect(() => {
    const region = regionalData[selectedRegion] || Object.values(regionalData)[0];
    if (region && region.months) {
      if (region.hasNasa) setHourlyMethod('nasa');
      else setHourlyMethod('liu-jordan');

      const dayOfYear = monthCumulativeDays[selectedMonthIdx] + selectedDay;
      const ghi = (region.dailyGhi && region.dailyGhi[dayOfYear - 1]) ? region.dailyGhi[dayOfYear - 1] : region.months[selectedMonthIdx].ghi_daily;
      const temp = (region.dailyTemp && region.dailyTemp[dayOfYear - 1]) ? region.dailyTemp[dayOfYear - 1] : region.months[selectedMonthIdx].temp;
      
      setInputs(prev => ({
        ...prev,
        ghi: ghi,
        ambientTemp: temp,
        dayOfYear: dayOfYear,
        latitude: region.lat
      }));
    }
  }, [selectedMonthIdx, selectedDay, selectedRegion, regionalData, monthCumulativeDays]);

  // Handle loading from history
  useEffect(() => {
    if (selectedSimulation && selectedSimulation.modelType === ModelType.TEMPERATURE) {
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
      const start = "20230101";
      const end = "20231231";
      const params = "ALLSKY_SFC_SW_DWN,T2M";
      const url = `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=${params}&community=RE&longitude=${province.lon}&latitude=${province.lat}&start=${start}&end=${end}&format=JSON&time-standard=lst`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error("NASA API connection error");
      const data = await response.json();

      const hourlySolar = data.properties.parameter.ALLSKY_SFC_SW_DWN;
      const hourlyTemp = data.properties.parameter.T2M;

      const dailyGhi = Array(366).fill(0);
      const dailyTemp = Array(366).fill(0);
      const dailyCounts = Array(366).fill(0);
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
        const valTemp = hourlyTemp[timestamp];

        if (valSolar > -900) {
          dailyGhi[dayOfYear - 1] += valSolar;
        }
        if (valTemp > -900) {
          dailyTemp[dayOfYear - 1] += valTemp;
          dailyCounts[dayOfYear - 1]++;
        }

        if (!monthlyAgg[month]) {
          monthlyAgg[month] = { 
            solarSum: 0, 
            tempSum: 0, 
            count: 0, 
            hourProfile: { ghi: Array(24).fill(0), temp: Array(24).fill(0), counts: Array(24).fill(0) } 
          };
        }
        
        if (valSolar > -900) {
          monthlyAgg[month].solarSum += valSolar;
          monthlyAgg[month].hourProfile.ghi[hour] += valSolar;
        }
        if (valTemp > -900) {
          monthlyAgg[month].tempSum += valTemp;
          monthlyAgg[month].hourProfile.temp[hour] += valTemp;
          monthlyAgg[month].hourProfile.counts[hour]++;
          monthlyAgg[month].count++;
        }
      });

      for (let i = 0; i < 366; i++) {
        dailyGhi[i] /= 1000;
        if (dailyCounts[i] > 0) dailyTemp[i] /= dailyCounts[i];
      }

      const newMonths = Array(12).fill(null).map((_, i) => {
        const monthKey = i + 1;
        const agg = monthlyAgg[monthKey];
        const daysInMonth = (agg && agg.count > 0) ? agg.count / 24 : 30;
        
        return {
          ghi_daily: agg ? (agg.solarSum / 1000 / daysInMonth) : 4.5,
          temp: agg ? (agg.tempSum / agg.count) : 25,
          hourlyProfile: Array(24).fill(null).map((_, h) => ({
            ghi: (agg && agg.hourProfile.counts[h] > 0) ? agg.hourProfile.ghi[h] / agg.hourProfile.counts[h] : 0,
            temp: (agg && agg.hourProfile.counts[h] > 0) ? agg.hourProfile.temp[h] / agg.hourProfile.counts[h] : 25
          }))
        };
      });

      const updatedData = {
        ...regionalData,
        [selectedRegion]: { 
          lat: province.lat, 
          lon: province.lon, 
          months: newMonths, 
          dailyGhi, 
          dailyTemp, 
          hasNasa: true 
        }
      };
      setRegionalData(updatedData);
      localStorage.setItem('solar_regional_data_enhanced', JSON.stringify(updatedData));
      alert(t.nasaUpdateSuccess);
    } catch (err) {
      alert(t.nasaFetchError);
    } finally {
      setLoadingNasa(false);
    }
  };

  const saveSimulation = async (results: any) => {
    if (!user) return;

    const finalName = projectName.trim() || `${t.tempModel} - ${selectedRegion}`;

    setIsSaving(true);
    setSaveStatus(null);
    try {
      await addDoc(collection(db, 'simulations'), {
        userId: user.uid,
        modelType: ModelType.TEMPERATURE,
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
          description: `Temperature Model Simulation for ${selectedRegion}`
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
    const { area, efficiency, tempCoeff, noct, latitude, ghi, ambientTemp, pr, pTotalKw, pModuleW } = inputs;
    const regionData = regionalData[selectedRegion] || Object.values(regionalData)[0];
    if (!regionData || !regionData.months) return;

    // Logic tính số lượng tấm pin
    const pTotalW = pTotalKw * 1000;
    const nModules = Math.ceil(pTotalW / pModuleW);
    const pDcActualW = nModules * pModuleW;
    const pDcActualKw = pDcActualW / 1000;

    if (calcMode === 'hourly') {
      const dayOfYear = monthCumulativeDays[selectedMonthIdx] + selectedDay;
      const ghi_wh = ghi * 1000;
      const delta = 23.45 * Math.sin((360 / 365) * (284 + dayOfYear) * (Math.PI / 180));
      const phiRad = latitude * (Math.PI / 180);
      const deltaRad = delta * (Math.PI / 180);
      const cosWs = -Math.tan(phiRad) * Math.tan(deltaRad);
      const ws = Math.acos(Math.max(-1, Math.min(1, cosWs)));
      const wsDeg = ws * (180 / Math.PI);

      let hourlyData = [];
      let totalE = 0;
      let noonMetrics: any = null;

      // Tính scaling factor cho GHI ngày nếu dùng phương pháp NASA
      const monthAvgGhi = regionData.months[selectedMonthIdx].ghi_daily;
      const ghiScalingFactor = monthAvgGhi > 0 ? (ghi / monthAvgGhi) : 1;

      for (let t = 0; t < 24; t++) {
        let It = 0, Ta = ambientTemp;
        if (hourlyMethod === 'liu-jordan') {
          const omega = 15 * (t + 0.5 - 12);
          if (Math.abs(omega) <= wsDeg) {
            const rt = (Math.PI / 24) * (Math.cos(omega * Math.PI / 180) - Math.cos(ws)) / (Math.sin(ws) - ws * Math.cos(ws));
            It = ghi_wh * Math.max(0, rt);
          }
        } else {
          // Lấy profile trung bình tháng và nhân với scaling factor để khớp với GHI của ngày đã chọn
          It = regionData.months[selectedMonthIdx].hourlyProfile[t].ghi * ghiScalingFactor;
          // Ta lấy từ inputs.ambientTemp (đã được cập nhật theo ngày trong useEffect)
          Ta = ambientTemp; 
        }

        const Tc = Ta + (It / 800) * (noct - 20);
        const temp_loss_factor = (1 - tempCoeff * (Tc - 25));
        
        // Et = (It / 1000) * P_dc_actual_kWp * temp_loss_factor * pr
        const Et = (It / 1000) * pDcActualKw * temp_loss_factor * pr;
        totalE += Et;
        
        if (t === 12) noonMetrics = { It, Tc, Et, Ta, ghi, area, efficiency, tempCoeff, noct, pr, temp_loss_factor, nModules, pDcActualKw, type: 'hourly' };
        hourlyData.push({ label: `${t}h`, energy: Et });
      }
      const results = { data: hourlyData, totalValue: totalE, mode: 'hourly', method: hourlyMethod, liuJordanParams: { delta, wsDeg }, noonMetrics, nModules, pDcActualKw };
      setResults(results);
    } else {
      // Chế độ tính theo tháng giữ nguyên logic tích lũy
      let totalYearly = 0;
      let monthSelectedMetrics: any = null;
      
      const monthlyResults = regionData.months.map((m: any, idx: number) => {
        let totalDayE = 0;
        const n = monthCumulativeDays[idx] + 15;
        const d = 23.45 * Math.sin((360 / 365) * (284 + n) * (Math.PI / 180));
        const phiR = latitude * (Math.PI / 180);
        const delR = d * (Math.PI / 180);
        const cosW = -Math.tan(phiR) * Math.tan(delR);
        const w = Math.acos(Math.max(-1, Math.min(1, cosW)));
        const wDeg = w * (180 / Math.PI);
        
        let avgTcAccum = 0;
        let sunshineHours = 0;

        for (let t = 0; t < 24; t++) {
          let It = 0, Ta = m.temp;
          if (hourlyMethod === 'liu-jordan') {
            const omega = 15 * (t + 0.5 - 12);
            if (Math.abs(omega) <= wDeg) {
              const r = (Math.PI / 24) * (Math.cos(omega * Math.PI / 180) - Math.cos(w)) / (Math.sin(w) - w * Math.cos(w));
              It = (m.ghi_daily * 1000) * Math.max(0, r);
            }
          } else {
            It = m.hourlyProfile[t].ghi;
            Ta = m.hourlyProfile[t].temp;
          }
          const Tc = Ta + (It / 800) * (noct - 20);
          const yield_t = (It / 1000) * pDcActualKw * (1 - tempCoeff * (Tc - 25)) * pr;
          totalDayE += yield_t;
          
          if (It > 0) {
            avgTcAccum += Tc;
            sunshineHours++;
          }
        }
        
        const monthlyYield = totalDayE * 30;
        totalYearly += monthlyYield;

        if (idx === selectedMonthIdx) {
          monthSelectedMetrics = {
            ghi_monthly: m.ghi_daily * 30,
            ghi_daily: m.ghi_daily,
            Ta: m.temp,
            avgTc: sunshineHours > 0 ? avgTcAccum / sunshineHours : m.temp,
            area, efficiency, tempCoeff, noct, pr, nModules, pDcActualKw,
            monthlyYield,
            type: 'monthly'
          };
        }
        return { label: `T${idx+1}`, energy: monthlyYield };
      });
      const results = { data: monthlyResults, totalValue: totalYearly, mode: 'monthly', method: hourlyMethod, noonMetrics: monthSelectedMetrics, nModules, pDcActualKw };
      setResults(results);
    }
  };

  const climateChartData = useMemo(() => {
    const data = regionalData[selectedRegion] || Object.values(regionalData)[0];
    if (!data || !data.months) return [];
    return data.months.map((m: any, i: number) => ({ month: `T${i + 1}`, ghi: m.ghi_daily, temp: m.temp }));
  }, [selectedRegion, regionalData]);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
          <div>
            <h3 className="text-xl font-black text-blue-900 uppercase flex items-center gap-3"><i className="fas fa-satellite text-blue-500"></i> {t.tempModelTitle}</h3>
            <p className="text-xs text-gray-400 mt-1">{t.tempModelSubtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={fetchNasaData} disabled={loadingNasa} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-md disabled:opacity-50"><i className={`fas ${loadingNasa ? 'fa-spinner fa-spin' : 'fa-cloud-download-alt'}`}></i> {t.fetchNasaHourly}</button>
            <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="bg-blue-900 text-white border-none rounded-2xl px-6 py-3 font-bold outline-none cursor-pointer hover:bg-blue-800 transition-all min-w-[180px] shadow-lg">
              {Object.keys(VIETNAM_PROVINCES).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 text-center md:text-left">
           <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
              <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{t.dataSourceLabel}</span>
              <p className={`font-bold mt-1 ${hourlyMethod === 'nasa' ? 'text-green-600' : 'text-blue-600'}`}>
                 <i className={`fas ${hourlyMethod === 'nasa' ? 'fa-check-circle' : 'fa-info-circle'} mr-1`}></i>
                 {hourlyMethod === 'nasa' ? t.nasaHourlyReal : t.liuJordanSim}
              </p>
           </div>
           <div className="flex justify-center items-center gap-6">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase">{t.annualRadiation}</p>
                <p className="text-xl font-black text-orange-600">{climateChartData.reduce((acc, d) => acc + d.ghi * 30, 0).toLocaleString('en-US', {useGrouping: false})} kWh/m²</p>
              </div>
              <div className="w-px h-8 bg-gray-100"></div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase">{t.avgTemperature} ({selectedRegion})</p>
                <p className="text-xl font-black text-blue-900">{(regionalData[selectedRegion] || Object.values(regionalData)[0])?.months?.[selectedMonthIdx]?.temp?.toFixed(1)}°C</p>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-3xl p-4">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={climateChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" unit=" kWh" axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" unit=" °C" axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                <Bar yAxisId="left" dataKey="ghi" name="GHI Daily" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="temp" name="Temperature" stroke="#ef4444" strokeWidth={3} dot={{r: 4}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-inner max-h-[300px] overflow-y-auto text-xs">
            <table className="w-full">
              <thead className="bg-gray-50 uppercase font-black text-gray-400 sticky top-0">
                <tr><th className="py-2 px-4 text-left">{t.month}</th><th className="py-2 px-4 text-right">GHI (kWh)</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {climateChartData.map((d, i) => (
                  <tr key={i} className={`hover:bg-blue-50 cursor-pointer ${selectedMonthIdx === i ? 'bg-blue-50 border-l-4 border-blue-600 font-bold' : ''}`} onClick={() => setSelectedMonthIdx(i)}>
                    <td className="py-2 px-4">{d.month}</td>
                    <td className="py-2 px-4 text-right text-orange-600">{d.ghi.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
        <h3 className="text-lg font-black uppercase tracking-widest text-blue-900 mb-8 flex items-center gap-3"><i className="fas fa-sliders-h"></i> {t.calculationInputs}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest">{t.ghiRadiation}</label>
            <div className="w-full p-4 bg-orange-50 border border-orange-200 rounded-2xl font-black text-orange-900 shadow-inner flex justify-between items-center">
              <span>{inputs.ghi.toFixed(2)}</span>
              <span className="text-[9px] opacity-60">kWh/m²/d</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.ambientTempTa}</label>
            <input type="number" step="0.5" value={inputs.ambientTemp} onChange={e => setInputs({...inputs, ambientTemp: Number(e.target.value)})} className="w-full p-4 bg-blue-50 border border-blue-200 rounded-2xl font-bold text-blue-900 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{t.totalInstalledCapacity}</label>
            <div className="relative">
              <input type="number" value={inputs.pTotalKw} onChange={e => setInputs({...inputs, pTotalKw: Number(e.target.value)})} className="w-full p-4 bg-blue-50 border border-blue-200 rounded-2xl font-bold text-blue-900 outline-none pr-12" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-400">kWp</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{t.modulePowerWp}</label>
            <div className="relative">
              <input type="number" value={inputs.pModuleW} onChange={e => setInputs({...inputs, pModuleW: Number(e.target.value)})} className="w-full p-4 bg-blue-50 border border-blue-200 rounded-2xl font-bold text-blue-900 outline-none pr-12" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-400">Wp</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{t.lossFactorLabel}</label>
            <input type="number" step="0.01" value={inputs.pr} onChange={e => setInputs({...inputs, pr: Number(e.target.value)})} className="w-full p-4 bg-emerald-50 border border-emerald-200 rounded-2xl font-bold outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{t.dayOfMonth}</label>
            <input type="number" min="1" max="31" value={selectedDay} onChange={e => setSelectedDay(Math.max(1, Math.min(31, Number(e.target.value))))} className="w-full p-4 bg-blue-50 border border-blue-200 rounded-2xl font-bold text-blue-900 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t.noctTemp}</label>
            <input type="number" value={inputs.noct} onChange={e => setInputs({...inputs, noct: Number(e.target.value)})} className="w-full p-4 bg-indigo-50 border border-indigo-200 rounded-2xl font-bold outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-red-400 uppercase tracking-widest">{t.tempCoeffBeta}</label>
            <input type="number" step="0.0001" value={inputs.tempCoeff} onChange={e => setInputs({...inputs, tempCoeff: Number(e.target.value)})} className="w-full p-4 bg-red-50 border border-red-200 rounded-2xl font-bold outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{t.lossFactorLabel}</label>
            <input type="number" step="0.01" value={inputs.pr} onChange={e => setInputs({...inputs, pr: Number(e.target.value)})} className="w-full p-4 bg-emerald-50 border border-emerald-200 rounded-2xl font-bold outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.moduleCount}</label>
            <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-black text-gray-900 shadow-inner flex justify-between items-center">
              <span>{inputs.pModuleW > 0 ? Math.ceil((inputs.pTotalKw * 1000) / inputs.pModuleW) : 0}</span>
              <span className="text-[9px] opacity-60">{lang === 'vi' ? 'tấm' : 'modules'}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-10 p-6 bg-gray-50 rounded-3xl">
          <button onClick={() => setCalcMode('hourly')} className={`px-8 py-3 rounded-xl text-[11px] font-black transition-all ${calcMode === 'hourly' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500'}`}>{t.hourlyCalcBtn}</button>
          <button onClick={() => setCalcMode('monthly')} className={`px-8 py-3 rounded-xl text-[11px] font-black transition-all ${calcMode === 'monthly' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500'}`}>{t.monthlyCalcBtn}</button>
          <button onClick={handleCalculate} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-12 py-3 rounded-2xl shadow-lg transition-all flex items-center gap-3 uppercase text-xs tracking-widest"><i className="fas fa-play"></i> {t.calculateNowBtn}</button>
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

      {/* Kết quả chi tiết */}
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
               <div className="absolute top-0 left-0 p-8 opacity-10 text-9xl"><i className="fas fa-bolt"></i></div>
               <span className="text-xs opacity-60 uppercase z-10">{t.totalEstimatedYield}</span>
               <div className="text-6xl font-black mt-2 text-orange-400 z-10">{results.totalValue.toFixed(1)} <span className="text-xl font-normal text-white">kWh</span></div>
               
               <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 z-10">
                  <div className="text-left">
                    <p className="text-[9px] opacity-60 uppercase">{t.moduleCount}</p>
                    <p className="text-lg font-black text-white">{results.nModules}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] opacity-60 uppercase">{t.actualDcPower}</p>
                    <p className="text-lg font-black text-orange-400">{results.pDcActualKw?.toFixed(2)} kWp</p>
                  </div>
               </div>
               
               <p className="text-[10px] opacity-40 mt-4 uppercase font-bold tracking-widest">{hourlyMethod === 'nasa' ? t.nasaHourlyReal : t.liuJordanSim}</p>
            </div>
          </div>

          <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <h3 className="text-lg font-black text-blue-900 uppercase mb-8 flex items-center gap-3 border-b pb-4">
              <i className="fas fa-calculator text-blue-500"></i> {t.calculationSteps}
            </h3>
            
            {results.noonMetrics.type === 'hourly' ? (
              <div className="space-y-8">
                <div>
                  <p className="text-xs font-black text-orange-600 uppercase mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center text-[11px] shadow-lg">1</span>
                    {t.step1Solar} ({t.exampleNoon})
                  </p>
                  <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 font-mono text-[13px] text-orange-900">
                    {hourlyMethod === 'liu-jordan' ? `It = Hg_daily * 1000 * rt` : `It = NASA_Irradiance_at_hour * Scaling_Factor`} <br/>
                    It = {results.noonMetrics.It.toFixed(2)} W/m² <br/>
                    <span className="font-bold">➔ It = {results.noonMetrics.It.toFixed(2)} W/m²</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black text-blue-600 uppercase mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] shadow-lg">2</span>
                    {t.step2CellTemp}
                  </p>
                  <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 font-mono text-[13px] text-blue-900">
                    Tc = Ta + (It / 800) * (NOCT - 20) <br/>
                    Tc = {results.noonMetrics.Ta.toFixed(1)} + ({results.noonMetrics.It.toFixed(1)} / 800) * ({results.noonMetrics.noct} - 20) <br/>
                    <span className="font-bold">➔ Tc = {results.noonMetrics.Tc.toFixed(2)} °C</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black text-emerald-600 uppercase mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] shadow-lg">3</span>
                    {t.step3Energy}
                  </p>
                  <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 font-mono text-[13px] text-emerald-900">
                    N_modules = ceil(P_total_installed_Wp / P_module_Wp) = {results.noonMetrics.nModules} <br/>
                    P_dc_actual_kWp = (N_modules * P_module_Wp) / 1000 = {results.noonMetrics.pDcActualKw?.toFixed(2)} kWp <br/>
                    Et = (It / 1000) * P_dc_actual_kWp * (1 - β * (Tc - 25)) * Loss <br/>
                    Et = ({results.noonMetrics.It.toFixed(1)} / 1000) * {results.noonMetrics.pDcActualKw?.toFixed(2)} * ({results.noonMetrics.temp_loss_factor.toFixed(4)}) * {results.noonMetrics.pr} <br/>
                    <span className="font-bold">➔ Et = {results.noonMetrics.Et.toFixed(3)} kWh</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                 <p className="text-sm text-gray-500 italic mb-4">{t.illustrationMonth}</p>
                 <div>
                  <p className="text-xs font-black text-orange-600 uppercase mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center text-[11px] shadow-lg">1</span>
                    {t.cumulativeRadiation}
                  </p>
                  <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 font-mono text-[13px] text-orange-900">
                    H_month = H_daily_avg * 30 days <br/>
                    H_month = {results.noonMetrics.ghi_daily.toFixed(2)} * 30 <br/>
                    <span className="font-bold">➔ H_month = {results.noonMetrics.ghi_monthly.toFixed(1)} kWh/m²</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black text-blue-600 uppercase mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] shadow-lg">2</span>
                    {t.avgCellTemp}
                  </p>
                  <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 font-mono text-[13px] text-blue-900">
                    Tc_avg (ước tính trung bình ban ngày) = Ta + (G_avg / 800) * (NOCT - 20) <br/>
                    Tc_avg ≈ {results.noonMetrics.avgTc.toFixed(2)} °C
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black text-emerald-600 uppercase mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] shadow-lg">3</span>
                    {t.monthlyYieldStep}
                  </p>
                  <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 font-mono text-[13px] text-emerald-900">
                    E_month = (H_month * P_dc_actual_kWp * Temp_Correction * Loss) <br/>
                    E_month = ({results.noonMetrics.ghi_monthly.toFixed(1)} * {results.noonMetrics.pDcActualKw?.toFixed(2)} * (1 - {results.noonMetrics.tempCoeff} * ({results.noonMetrics.avgTc.toFixed(1)} - 25)) * {results.noonMetrics.pr}) <br/>
                    <span className="font-bold text-xl">➔ E_month = {results.noonMetrics.monthlyYield.toFixed(1)} kWh</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default TemperatureModel;
