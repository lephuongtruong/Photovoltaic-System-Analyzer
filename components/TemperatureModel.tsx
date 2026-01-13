
import React, { useState, useMemo, useEffect, useContext } from 'react';
import { SolarInputs } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ComposedChart, Line, Legend } from 'recharts';
import * as XLSX from 'xlsx';
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

const TemperatureModel: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  
  const strings = {
    vi: {
      title: "Dữ liệu khí hậu",
      subtitle: "Dữ liệu được lưu trữ an toàn trong trình duyệt",
      sample: "Mẫu Excel",
      import: "Import Excel",
      clear: "Xóa hết dữ liệu",
      yearlyGhi: "Tổng bức xạ năm (GHI)",
      avgTemp: "Nhiệt độ TB",
      chartTitle: "Biểu đồ Khí hậu: Bức xạ (kWh/m2/ngày) & Nhiệt độ (°C)",
      thMonth: "Tháng",
      calcInputs: "Thông số đầu vào tính toán",
      ghiLabel: "Bức xạ GHI (kWh/m²/ngày)",
      tempLabel: "Nhiệt độ môi trường Ta (°C)",
      areaLabel: "Diện tích A (m²)",
      effLabel: "Hiệu suất η (%)",
      btnHourly: "TÍNH THEO GIỜ",
      btnMonthly: "TÍNH THEO THÁNG",
      btnCalc: "Bắt đầu tính",
      resultTitle: "Phân phối Sản lượng",
      totalEst: "Tổng sản lượng ước tính",
      note: "* Kết quả dựa trên mô hình Liu & Jordan và điều kiện NOCT 45°C.",
      formulaTitle: "Giải trình mô hình Liu & Jordan (Thế số thực tế)"
    },
    en: {
      title: "Climate Data",
      subtitle: "Data securely stored in your browser",
      sample: "Excel Sample",
      import: "Import Excel",
      clear: "Clear All Data",
      yearlyGhi: "Annual Radiation (GHI)",
      avgTemp: "Avg Temperature",
      chartTitle: "Climate Chart: Radiation (kWh/m2/day) & Temperature (°C)",
      thMonth: "Month",
      calcInputs: "Calculation Parameters",
      ghiLabel: "GHI Radiation (kWh/m²/day)",
      tempLabel: "Ambient Temperature Ta (°C)",
      areaLabel: "Area A (m²)",
      effLabel: "Efficiency η (%)",
      btnHourly: "HOURLY CALC",
      btnMonthly: "MONTHLY CALC",
      btnCalc: "Calculate Now",
      resultTitle: "Yield Distribution",
      totalEst: "Total Estimated Yield",
      note: "* Results based on Liu & Jordan model and NOCT 45°C conditions.",
      formulaTitle: "Liu & Jordan Model Explanation (Actual Values)"
    }
  }[lang];

  const [regionalData, setRegionalData] = useState(() => {
    const saved = localStorage.getItem('solar_regional_data');
    return saved ? JSON.parse(saved) : DEFAULT_REGIONAL_DATA;
  });
  
  const [selectedRegion, setSelectedRegion] = useState<string>("Hồ Chí Minh");
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(0);
  const [calcMode, setCalcMode] = useState<'hourly' | 'monthly'>('hourly');
  
  const [inputs, setInputs] = useState<SolarInputs>({
    ghi: 5.2, 
    latitude: 10.8,
    dayOfYear: 15,
    area: 100,
    efficiency: 0.18,
    tempCoeff: 0.0045,
    noct: 45,
    ambientTemp: 27,
    pr: 0.8
  });

  const [results, setResults] = useState<{
    data: any[],
    totalValue: number,
    mode: 'hourly' | 'monthly',
    liuJordanParams?: any
  } | null>(null);

  useEffect(() => {
    localStorage.setItem('solar_regional_data', JSON.stringify(regionalData));
  }, [regionalData]);

  const clearData = () => {
    if (window.confirm(lang === 'vi' ? "Bạn có chắc chắn?" : "Are you sure?")) {
      localStorage.removeItem('solar_regional_data');
      setRegionalData(DEFAULT_REGIONAL_DATA);
      setSelectedRegion("Hồ Chí Minh");
    }
  };

  const downloadSampleExcel = () => {
    const data = [
      ["Tên Vùng", "Vĩ độ", "Tháng (1-12)", "Bức xạ GHI (kWh/m2/ngày)", "Nhiệt độ (°C)"],
      ["Hồ Chí Minh", 10.8, 1, 5.2, 27],
      ["Hồ Chí Minh", 10.8, 2, 5.8, 28],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Climate_Data");
    XLSX.writeFile(wb, "Solar_Analyzer_Sample.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws) as any[];

        const newRegionalData = { ...regionalData };
        rawData.forEach((row: any) => {
          const regionName = row["Tên Vùng"] || row["Vùng"] || row["Region Name"];
          const lat = Number(row["Vĩ độ"] || row["Latitude"]);
          const month = Number(row["Tháng (1-12)"] || row["Month"]);
          const ghi = Number(row["Bức xạ GHI (kWh/m2/ngày)"] || row["GHI"]);
          const temp = Number(row["Nhiệt độ (°C)"] || row["Temp"]);

          if (regionName && !isNaN(month) && month >= 1 && month <= 12) {
            if (!newRegionalData[regionName]) {
              newRegionalData[regionName] = {
                lat: lat || 10.0,
                months: Array(12).fill(null).map(() => ({ ghi_daily: 0, temp: 25 }))
              };
            }
            newRegionalData[regionName].months[month - 1] = { ghi_daily: ghi || 0, temp: temp || 25 };
          }
        });
        setRegionalData(newRegionalData);
        alert(lang === 'vi' ? `Đã lưu ${Object.keys(newRegionalData).length} vùng!` : `Saved ${Object.keys(newRegionalData).length} regions!`);
      } catch (err) { alert("File error."); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const yearlyClimateStats = useMemo(() => {
    const data = regionalData[selectedRegion];
    if (!data) return { avgDaily: 0, totalYearly: 0 };
    const totalDailyGhi = data.months.reduce((acc, m) => acc + m.ghi_daily, 0);
    const totalYearlyGhi = data.months.reduce((acc, m) => acc + (m.ghi_daily * 30), 0);
    return { avgDaily: totalDailyGhi / 12, totalYearly: totalYearlyGhi };
  }, [selectedRegion, regionalData]);

  const climateChartData = useMemo(() => {
    const data = regionalData[selectedRegion];
    if (!data) return [];
    return data.months.map((m, i) => ({
      month: `${lang === 'vi' ? 'T' : 'M'}${i + 1}`,
      ghi: m.ghi_daily,
      temp: m.temp
    }));
  }, [selectedRegion, regionalData, lang]);

  const handleRegionMonthChange = (region: string, monthIdx: number) => {
    const data = regionalData[region];
    if (!data) return;
    setSelectedRegion(region);
    setSelectedMonthIdx(monthIdx);
    setInputs(prev => ({
      ...prev,
      ghi: data.months[monthIdx].ghi_daily,
      latitude: data.lat,
      ambientTemp: data.months[monthIdx].temp,
      dayOfYear: (monthIdx * 30) + 15
    }));
  };

  const handleCalculate = () => {
    const { area, efficiency, tempCoeff, noct, ghi, latitude, ambientTemp, dayOfYear } = inputs;
    const ghi_wh = ghi * 1000;
    
    // Liu & Jordan Base Calculations for Explanation
    const delta = 23.45 * Math.sin((360 / 365) * (284 + dayOfYear) * (Math.PI / 180));
    const phiRad = latitude * (Math.PI / 180);
    const deltaRad = delta * (Math.PI / 180);
    const cosWs = -Math.tan(phiRad) * Math.tan(deltaRad);
    const ws = Math.acos(Math.max(-1, Math.min(1, cosWs)));
    const wsDeg = ws * (180 / Math.PI);

    const liuJordanParams = { delta, phiRad, deltaRad, ws, wsDeg };

    if (calcMode === 'hourly') {
      let hourlyData = [];
      let totalE = 0;

      for (let t = 0; t < 24; t++) {
        const omega = 15 * (t + 0.5 - 12);
        let It = 0;
        if (Math.abs(omega) <= wsDeg) {
          const r = (Math.PI / 24) * (Math.cos(omega * Math.PI / 180) - Math.cos(ws)) / (Math.sin(ws) - ws * Math.cos(ws));
          It = ghi_wh * Math.max(0, r);
        }
        const Tc = ambientTemp + (It / 800) * (noct - 20);
        const Et = (It * area * efficiency * (1 - tempCoeff * (Tc - 25))) / 1000;
        totalE += Et;
        hourlyData.push({ label: `${t}h`, energy: Et, It: It });
      }
      setResults({ data: hourlyData, totalValue: totalE, mode: 'hourly', liuJordanParams });
    } else {
      const regionData = regionalData[selectedRegion];
      const monthlyData = regionData.months.map((m, idx) => {
        let totalDayE = 0;
        const n = (idx * 30) + 15;
        const d = 23.45 * Math.sin((360 / 365) * (284 + n) * (Math.PI / 180));
        const pR = latitude * (Math.PI / 180);
        const dR = d * (Math.PI / 180);
        const cWs = -Math.tan(pR) * Math.tan(dR);
        const w = Math.acos(Math.max(-1, Math.min(1, cWs)));
        const wD = w * (180 / Math.PI);
        for (let t = 0; t < 24; t++) {
          const omega = 15 * (t + 0.5 - 12);
          let It = 0;
          if (Math.abs(omega) <= wD) {
            const r = (Math.PI / 24) * (Math.cos(omega * Math.PI / 180) - Math.cos(w)) / (Math.sin(w) - w * Math.cos(w));
            It = (m.ghi_daily * 1000) * Math.max(0, r);
          }
          const Tc = m.temp + (It / 800) * (noct - 20);
          totalDayE += (It * area * efficiency * (1 - tempCoeff * (Tc - 25))) / 1000;
        }
        return { label: `${lang === 'vi' ? 'T' : 'M'}${idx + 1}`, energy: totalDayE * 30 };
      });
      setResults({ data: monthlyData, totalValue: monthlyData.reduce((a, b) => a + b.energy, 0), mode: 'monthly', liuJordanParams });
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* 1. Header & Quick Stats Section */}
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
          <div>
            <h3 className="text-xl font-black text-blue-900 uppercase flex items-center gap-3">
              <i className="fas fa-database text-blue-500"></i> {strings.title}
            </h3>
            <p className="text-xs text-gray-400 mt-1 font-medium italic">{strings.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={downloadSampleExcel} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all border border-gray-200">
              <i className="fas fa-download"></i> {strings.sample}
            </button>
            <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md">
              <i className="fas fa-file-excel"></i> {strings.import}
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
            </label>
            <button onClick={clearData} className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all border border-red-200">
              <i className="fas fa-trash-alt"></i> {strings.clear}
            </button>
            <select 
              value={selectedRegion} 
              onChange={(e) => handleRegionMonthChange(e.target.value, selectedMonthIdx)}
              className="bg-blue-600 text-white border-none rounded-2xl px-6 py-3 font-bold outline-none cursor-pointer hover:bg-blue-700 transition-all min-w-[150px] shadow-lg"
            >
              {Object.keys(regionalData).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-orange-50 border border-orange-100 p-6 rounded-2xl flex items-center gap-5">
            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white text-xl shadow-lg">
              <i className="fas fa-sun"></i>
            </div>
            <div>
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{strings.yearlyGhi}</p>
              <p className="text-2xl font-black text-orange-900">
                {yearlyClimateStats.totalYearly.toLocaleString()} <span className="text-sm">kWh/m²</span>
              </p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex items-center gap-5">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl shadow-lg">
              <i className="fas fa-temperature-high"></i>
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{strings.avgTemp} ({selectedRegion})</p>
              <p className="text-2xl font-black text-blue-900">
                {climateChartData[selectedMonthIdx]?.temp}°C
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-3xl p-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest text-center">{strings.chartTitle}</h4>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={climateChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700}} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} unit=" kWh" tick={{fontSize: 10}} label={{ value: 'GHI (kWh)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} unit=" °C" tick={{fontSize: 10}} label={{ value: 'Temp (°C)', angle: 90, position: 'insideRight', fontSize: 10 }} />
                  <Tooltip contentStyle={{borderRadius: '16px', border: 'none'}} />
                  <Legend verticalAlign="top" iconType="circle" />
                  <Bar yAxisId="left" dataKey="ghi" name="GHI Daily" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="temp" name="Temperature" stroke="#ef4444" strokeWidth={3} dot={{r: 4}} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden flex flex-col shadow-inner max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-400">
                <tr>
                  <th className="py-3 px-4 text-left">{strings.thMonth}</th>
                  <th className="py-3 px-4 text-right">GHI (kWh)</th>
                  <th className="py-3 px-4 text-right">Temp (°C)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {climateChartData.map((d, i) => (
                  <tr key={i} className={`hover:bg-blue-50 cursor-pointer transition-colors ${selectedMonthIdx === i ? 'bg-blue-50 border-l-4 border-blue-600 font-bold' : ''}`} onClick={() => handleRegionMonthChange(selectedRegion, i)}>
                    <td className="py-3 px-4">{d.month}</td>
                    <td className="py-3 px-4 text-right text-orange-600 font-mono">{d.ghi.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-red-500 font-mono">{d.temp}°C</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 2. Inputs Section */}
      <section className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
        <h3 className="text-lg font-black uppercase tracking-widest text-blue-900 mb-8 flex items-center gap-3">
          <i className="fas fa-sliders-h"></i> {strings.calcInputs}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{strings.ghiLabel}</label>
            <input type="number" step="0.1" value={inputs.ghi} onChange={e => setInputs({...inputs, ghi: Number(e.target.value)})} className="w-full p-4 bg-orange-50 border border-orange-200 rounded-2xl font-bold text-orange-900 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{strings.tempLabel}</label>
            <input type="number" step="0.5" value={inputs.ambientTemp} onChange={e => setInputs({...inputs, ambientTemp: Number(e.target.value)})} className="w-full p-4 bg-blue-50 border border-blue-200 rounded-2xl font-bold text-blue-900 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{strings.areaLabel}</label>
            <input type="number" value={inputs.area} onChange={e => setInputs({...inputs, area: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-gray-900 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{strings.effLabel}</label>
            <input type="number" step="0.01" value={inputs.efficiency} onChange={e => setInputs({...inputs, efficiency: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-gray-900 outline-none" />
          </div>
        </div>
        <div className="flex justify-center mt-10 gap-4">
          <div className="bg-gray-100 p-1 rounded-2xl flex">
            <button onClick={() => setCalcMode('hourly')} className={`px-8 py-3 rounded-xl text-[11px] font-black transition-all ${calcMode === 'hourly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>{strings.btnHourly}</button>
            <button onClick={() => setCalcMode('monthly')} className={`px-8 py-3 rounded-xl text-[11px] font-black transition-all ${calcMode === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>{strings.btnMonthly}</button>
          </div>
          <button onClick={handleCalculate} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-12 py-3 rounded-2xl shadow-lg transition-all flex items-center gap-3 uppercase text-xs tracking-widest">
            <i className="fas fa-play"></i> {strings.btnCalc}
          </button>
        </div>
      </section>

      {/* 3. Results Display Section */}
      {results && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <h4 className="text-[10px] font-black text-gray-400 uppercase mb-6 tracking-widest text-center">{strings.resultTitle} {results.mode === 'hourly' ? (lang === 'vi' ? 'Theo giờ' : 'Hourly') : (lang === 'vi' ? 'Theo tháng' : 'Monthly')} (kWh)</h4>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={results.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} label={{ value: 'Yield (kWh)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                  <Bar dataKey="energy" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-blue-900 text-white p-8 rounded-[40px] shadow-2xl flex flex-col justify-center">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{strings.totalEst}</span>
              <div className="text-5xl font-black mt-2">
                {results.totalValue.toLocaleString(undefined, {maximumFractionDigits: 2})}
                <span className="text-xl font-normal opacity-50 ml-2">kWh</span>
              </div>
              <p className="mt-4 text-xs font-light italic">
                {strings.note}
              </p>
            </div>
          </div>

          {/* 4. Formulas Detailed Section (Liu & Jordan Focus) */}
          <section className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 animate-slideUp">
            <h3 className="text-lg font-black text-blue-900 uppercase mb-8 flex items-center gap-3 border-b pb-4">
              <i className="fas fa-calculator text-blue-500"></i> {strings.formulaTitle}
            </h3>
            
            <div className="space-y-12">
               {/* Step 1: Liu & Jordan Parameters */}
               <div className="space-y-6">
                  <p className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] shadow-lg">1</span>
                    Xác định thông số thiên văn (Liu & Jordan)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
                      <p className="text-[10px] font-black text-indigo-800 uppercase mb-4">Độ lệch mặt trời (δ)</p>
                      <div className="bg-white p-4 rounded-xl shadow-inner font-mono text-[12px] text-indigo-900 mb-4">
                         δ = 23.45 * sin[360/365 * (284 + n)]
                      </div>
                      <code className="text-[13px] font-mono block text-indigo-700 italic">
                        δ = 23.45 * sin[360/365 * (284 + {inputs.dayOfYear})] <br/>
                        δ ≈ {results.liuJordanParams?.delta.toFixed(2)}°
                      </code>
                    </div>
                    <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
                      <p className="text-[10px] font-black text-indigo-800 uppercase mb-4">Góc giờ hoàng hôn (ws)</p>
                      <div className="bg-white p-4 rounded-xl shadow-inner font-mono text-[12px] text-indigo-900 mb-4">
                         cos(ws) = -tan(φ) * tan(δ)
                      </div>
                      <code className="text-[13px] font-mono block text-indigo-700 italic">
                        cos(ws) = -tan({inputs.latitude}°) * tan({results.liuJordanParams?.delta.toFixed(2)}°) <br/>
                        ws ≈ {results.liuJordanParams?.wsDeg.toFixed(2)}°
                      </code>
                    </div>
                  </div>
               </div>

               {/* Step 2: GHI Decomposition */}
               <div className="space-y-6">
                  <p className="text-xs font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center text-[11px] shadow-lg">2</span>
                    Phân rã GHI theo giờ (Mô hình Liu & Jordan)
                  </p>
                  <div className="bg-amber-50/50 p-8 rounded-3xl border border-amber-100">
                    <div className="bg-white p-6 rounded-2xl shadow-inner border border-amber-100 font-mono text-amber-900 text-[14px] mb-6 leading-relaxed">
                       r_t = (π/24) * [cos(ω) - cos(ws)] / [sin(ws) - (ws*π/180)*cos(ws)] <br/>
                       I_t = GHI_daily * r_t
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                         <p className="text-[11px] font-bold text-amber-800">Ví dụ tại ω = 0° (Chính ngọ):</p>
                         <code className="text-[12px] font-mono text-amber-700 italic block leading-loose">
                           ω_0 = 15° * (12 + 0.5 - 12) = 7.5° <br/>
                           r_t ≈ {(Math.PI/24 * (Math.cos(7.5*Math.PI/180) - Math.cos(results.liuJordanParams?.ws)) / (Math.sin(results.liuJordanParams?.ws) - results.liuJordanParams?.ws * Math.cos(results.liuJordanParams?.ws))).toFixed(4)} <br/>
                           I_t = {inputs.ghi} kWh * { (Math.PI/24 * (Math.cos(7.5*Math.PI/180) - Math.cos(results.liuJordanParams?.ws)) / (Math.sin(results.liuJordanParams?.ws) - results.liuJordanParams?.ws * Math.cos(results.liuJordanParams?.ws))).toFixed(4) } <br/>
                           I_t ≈ { (inputs.ghi * (Math.PI/24 * (Math.cos(7.5*Math.PI/180) - Math.cos(results.liuJordanParams?.ws)) / (Math.sin(results.liuJordanParams?.ws) - results.liuJordanParams?.ws * Math.cos(results.liuJordanParams?.ws)))).toFixed(2) } kWh/m²/h
                         </code>
                       </div>
                       <div className="bg-white/50 p-4 rounded-xl border border-amber-200">
                          <p className="text-[10px] font-black text-amber-400 uppercase mb-2 italic">Ghi chú:</p>
                          <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                            Mô hình Liu & Jordan giả định bầu trời sạch và phân phối bức xạ theo quy luật hình Sin biến thiên dựa trên góc giờ (ω) và thời gian chiếu sáng trong ngày.
                          </p>
                       </div>
                    </div>
                  </div>
               </div>

               {/* Step 3: Energy Output */}
               <div className="space-y-6">
                  <p className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] shadow-lg">3</span>
                    Tính toán nhiệt độ và sản lượng Et (kWh)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100">
                        <p className="text-[10px] font-black text-emerald-800 uppercase mb-4">Nhiệt độ tế bào Tc</p>
                        <div className="bg-white p-4 rounded-xl shadow-inner font-mono text-[12px] text-emerald-900 mb-2">
                           Tc = Ta + (It / 800) * (NOCT - 20)
                        </div>
                        <code className="text-[12px] font-mono text-emerald-700 italic">
                          Tc = {inputs.ambientTemp} + (It / 800) * ({inputs.noct} - 20)
                        </code>
                     </div>
                     <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100">
                        <p className="text-[10px] font-black text-emerald-800 uppercase mb-4">Sản lượng Et</p>
                        <div className="bg-white p-4 rounded-xl shadow-inner font-mono text-[12px] text-emerald-900 mb-2">
                           Et = It * A * η * [1 - β * (Tc - 25)]
                        </div>
                        <code className="text-[12px] font-mono text-emerald-700 italic">
                           Et = It * {inputs.area.toLocaleString()} * {inputs.efficiency} * [1 - {inputs.tempCoeff} * (Tc - 25)]
                        </code>
                     </div>
                  </div>
               </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default TemperatureModel;
