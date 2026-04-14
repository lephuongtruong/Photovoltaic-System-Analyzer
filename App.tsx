
import React, { useState, createContext, useContext, useEffect } from 'react';
import { ModelType, SimulationRecord } from './types';
import TemperatureModel from './components/TemperatureModel';
import PRModel from './components/PRModel';
import PerformanceAnalysis from './components/PerformanceAnalysis';
import LiuJordanModel from './components/LiuJordanModel';
import Dashboard from './components/Dashboard';
import DiodeModel from './components/DiodeModel';
import SimulationHistory from './components/SimulationHistory';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';

// Dictionary for Internationalization
export const translations = {
  vi: {
    // App
    title: "Photovoltaic-System Analyzer",
    subtitle: "Phân tích & Mô phỏng Hệ thống Điện mặt trời",
    dashboard: "Tổng quan",
    tempModel: "Mô Hình Nhiệt Độ",
    prModel: "Mô Hình PR",
    liuJordan: "Mô Hình Liu & Jordan",
    diodeModel: "Mô Hình 1 Diod",
    analysis: "Phân tích hiệu quả",
    history: "Lịch sử mô phỏng",
    footer: "© 2026 Photovoltaic System Analyzer – Developed by Le Phuong Truong",
    langBtn: "English",
    
    // Dashboard
    heroTitle: "Nền tảng Phân tích",
    heroSubtitle: "Hệ thống Quang điện",
    heroVersion: "– Phiên bản 2.0",
    heroDesc: "Nền tảng được phát triển nhằm hỗ trợ mô phỏng, dự báo và đánh giá hiệu suất của các hệ thống điện mặt trời dựa trên các mô hình vật lý chuẩn. Hệ thống tích hợp dữ liệu bức xạ và khí tượng từ nguồn NASA POWER và áp dụng các phương pháp đánh giá hiệu suất phù hợp với tiêu chuẩn IEC 61724-1. Công cụ cung cấp môi trường phân tích phục vụ nghiên cứu, thiết kế và đánh giá vận hành hệ thống quang điện trong các điều kiện thực tế.",
    dataSource: "Nguồn dữ liệu",
    standard: "Tiêu chuẩn",
    benefitAccuracy: "Độ chính xác cao",
    benefitAccuracyDesc: "Sử dụng các mô hình vật lý và toán học tiên tiến nhất để mô phỏng.",
    benefitRealtime: "Dữ liệu thời gian thực",
    benefitRealtimeDesc: "Kết nối trực tiếp với NASA POWER API để lấy dữ liệu khí tượng chuẩn xác.",
    benefitStandard: "Tuân thủ tiêu chuẩn",
    benefitStandardDesc: "Các báo cáo và phân tích tuân thủ nghiêm ngặt tiêu chuẩn IEC 61724-1.",
    guideTitle: "Hướng dẫn nhanh",
    guideStep1: "Chọn mô hình phù hợp",
    guideStep1Desc: "Sử dụng 1-Diode Model cho độ chính xác vật lý cao nhất (cần nhấn nút \"Tối ưu hóa thông số khớp với STC\") hoặc Temperature Model cho tính toán nhanh.",
    guideStep2: "Tích hợp dữ liệu NASA",
    guideStep2Desc: "Nhấn \"Lấy dữ liệu NASA\" để tải bức xạ và nhiệt độ thực tế tại vị trí của bạn.",
    guideStep3: "Đối soát thực tế",
    guideStep3Desc: "Tải lên file Excel sản lượng thực tế để đánh giá hiệu quả vận hành (O&M).",
    envTitle: "Tác động môi trường",
    envDesc: "Việc mô phỏng chính xác giúp tối ưu hóa thiết kế, giảm thiểu lãng phí và tăng cường khả năng thu hồi vốn cho các dự án năng lượng xanh.",
    co2Reduction: "Giảm phát thải CO2",
    treeEquivalent: "Tương đương số cây",
    diodeFeatureDesc: "Mô phỏng chi tiết dựa trên đặc tính vật lý của tế bào quang điện. Tính toán đường cong I-V, P-V và điểm MPP.",
    tempFeatureDesc: "Mô phỏng sản lượng dựa trên nhiệt độ tế bào (Tc) và hệ số nhiệt độ β. Tích hợp dữ liệu NASA Hourly.",
    prFeatureDesc: "Tính toán nhanh dựa trên hệ số Performance Ratio (PR). Phù hợp cho đánh giá sơ bộ dự án.",
    liuJordanFeatureDesc: "Mô hình thiên văn Liu & Jordan để ước tính bức xạ khuếch tán và trực tiếp từ bức xạ tổng cộng.",
    analysisFeatureDesc: "Phân tích dữ liệu thực tế so với mô phỏng theo tiêu chuẩn IEC 61724-1. Tính toán PR, Yf, Yr.",
    
    // Diode Model
    diodeDesc: "Mô phỏng chi tiết dựa trên đặc tính vật lý của tế bào quang điện.",
    nasaDataBtn: "Lấy dữ liệu NASA",
    calculateBtn: "Tính toán",
    optimizeBtn: "Tối ưu hóa thông số khớp STC",
    optimizing: "Đang tối ưu...",
    optimizeHint: "* Nhấn \"Tối ưu hóa\" để tự động tìm Rs và n khớp với Vmp/Imp của bạn.",
    systemParams: "Thông số hệ thống",
    totalPower: "Tổng công suất lắp đặt (kWp)",
    modulePower: "Công suất 1 tấm pin (kWp)",
    lossFactor: "Hệ số tổn thất hệ thống (%)",
    moduleCount: "Số lượng tấm pin:",
    actualDcPower: "Công suất DC thực tế:",
    annualYield: "Sản lượng năm ước tính:",
    radiationData: "Dữ liệu bức xạ",
    avgYearly: "TB năm (ngày)",
    totalYearly: "Tổng năm",
    month: "Tháng",
    ghi: "GHI (kWh/m²)",
    stcParams: "Thông số tấm pin (STC)",
    theoreticalPmax: "Pmax lý thuyết (Vmp*Imp):",
    simulatedPmax: "Pmax mô phỏng (STC):",
    totalCells: "Tổng số cell:",
    idealityFactor: "Hệ số lý tưởng (n)",
    formulaTitle: "Công thức 1-Diode (Half-Cell Support)",
    dailyYieldChart: "Sản lượng điện trung bình ngày (kWh/ngày)",
    hourlyChart: "Biểu đồ giờ trong ngày",
    power: "Công suất",
    radiation: "Bức xạ",
    ambientTemp: "Nhiệt độ môi trường",
    cellTemp: "Nhiệt độ cell",
    hour: "Giờ",
    optimizeSuccess: "Tối ưu hóa thành công!",
    optimizeError: "Lỗi khi tối ưu hóa.",
    nasaSuccess: "Đã cập nhật dữ liệu NASA Hourly cho 1-Diode Model!",
    nasaError: "Lỗi tải dữ liệu từ NASA POWER API.",
    peakHour: "Giờ cao điểm",
    calculationDetails: "Chi tiết tính toán",
    cellTempFormula: "1. Nhiệt độ cell (Tc):",
    iphFormula: "2. Dòng quang điện (Iph):",
    i0Formula: "3. Dòng bão hòa ngược (I0):",
    ivMppFormula: "4. Giải phương trình I-V (MPP):",
    yieldFormula: "5. Sản lượng điện (Epv):",
    yieldFormulaDesc: "Epv = Ppv * t * nModules * hệ số tổn thất",
    yieldFormulaNote: "Trong đó t = thời gian (1h), Ppv = công suất 1 tấm pin (kWp), nModules = số lượng tấm",
    newtonRaphsonDesc: "Sử dụng phương pháp lặp Newton-Raphson để tìm điểm công suất cực đại (Pmax) cho 1 tấm pin, sau đó nhân với số lượng tấm",
    ivPvSimulation: "Mô phỏng đặc tính I-V / P-V",
    resetStc: "Đặt về STC (1000W/m², 25°C)",
    irradianceG: "Bức xạ G (W/m²)",
    cellTempTc: "Nhiệt độ Cell Tc (°C)",
    voltageV: "Điện áp (V)",
    currentA: "Dòng điện (A)",
    powerW: "Công suất (W)",
    ivCurve: "Đường I-V",
    pvCurve: "Đường P-V",
    mppPoint: "Điểm MPP",
    
    // Temperature Model
    tempModelTitle: "Dữ liệu khí hậu NASA POWER",
    tempModelSubtitle: "Tính toán sản lượng dựa trên dữ liệu Bức xạ & Nhiệt độ Hourly thực tế",
    annualRadiation: "Tổng bức xạ năm (GHI)",
    avgTemperature: "Nhiệt độ TB",
    nasaClimateChart: "Khí hậu NASA: Bức xạ (kWh/m2/ngày) & Nhiệt độ (°C)",
    calculationInputs: "Thông số đầu vào",
    ghiRadiation: "Bức xạ GHI (kWh/m²/ngày)",
    ambientTempTa: "Nhiệt độ môi trường Ta (°C)",
    totalInstalledCapacity: "Tổng công suất lắp đặt (kWp)",
    modulePowerWp: "Công suất 1 tấm pin (Wp)",
    lossFactorLabel: "Hệ số tổn thất (Inv, cáp, bụi...)",
    dayOfMonth: "Ngày trong tháng",
    noctTemp: "Nhiệt độ NOCT (°C)",
    tempCoeffBeta: "Hệ số nhiệt độ β (%/°C)",
    hourlyCalcBtn: "TÍNH THEO GIỜ",
    monthlyCalcBtn: "TÍNH THEO THÁNG",
    calculateNowBtn: "Bắt đầu tính",
    yieldDistribution: "Phân phối Sản lượng",
    totalEstimatedYield: "Tổng sản lượng ước tính",
    nasaPriorityNote: "* Kết quả ưu tiên sử dụng dữ liệu Hourly trực tiếp từ NASA nếu đã tải.",
    calculationSteps: "Chi tiết các bước tính toán (Thế số minh họa)",
    step1Solar: "Bước 1: Xác định Bức xạ mặt trời (NASA Hourly)",
    step2CellTemp: "Bước 2: Tính Nhiệt độ tế bào trung bình (Tc)",
    step3Energy: "Bước 3: Sản lượng đầu ra (Et)",
    exampleNoon: "Minh họa tại 12h00",
    illustrationMonth: "Minh họa tính toán tích lũy cho cả tháng",
    fetchNasaHourly: "Lấy dữ liệu NASA (Hourly)",
    dataSourceLabel: "Nguồn dữ liệu:",
    liuJordanSim: "Mô phỏng Liu & Jordan",
    nasaHourlyReal: "NASA Hourly (Dữ liệu thực)",
    nasaUpdateSuccess: "Đã cập nhật dữ liệu NASA Hourly thành công!",
    nasaFetchError: "Lỗi tải dữ liệu từ NASA POWER API.",
    cumulativeRadiation: "Bức xạ tích lũy (H_month)",
    avgCellTemp: "Nhiệt độ tế bào TB (Tc_avg)",
    monthlyYieldStep: "Sản lượng tháng (E_month)",
    tempModelDesc: "Mô phỏng sản lượng dựa trên nhiệt độ tế bào (Tc) và hệ số nhiệt độ β.",
    tempCoeff: "Hệ số nhiệt độ (β) (%/°C)",
    
    // PR Model
    prModelTitle: "Mô hình PR & Khí hậu NASA",
    prModelSubtitle: "Tính toán nhanh sản lượng dựa trên hệ số Performance Ratio (PR)",
    annualGhi: "Bức xạ năm",
    avgMonthlyGhi: "Bức xạ TB tháng",
    nasaClimateGhi: "Khí hậu NASA (GHI)",
    prFactorLabel: "Hệ số PR (0.6 - 0.9)",
    totalYieldPrModel: "Tổng sản lượng (PR Model)",
    formulaTitlePrModel: "Công thức & Thế số minh họa (PR Model)",
    formulaDescPrModel: "Sản lượng được tính bằng cách nhân trực tiếp bức xạ với hệ số PR hệ thống (bao gồm các tổn thất Inverter, dây dẫn, bụi...):",
    formulaSubstitutionNoon: "Thế số thực tế (tại 12h00 trưa):",
    formulaSubstitutionMonthly: "Thế số tính toán theo tháng:",
    forecastedYieldPrModel: "Sản lượng Dự báo (PR Model)",
    step1It: "Xác định It (Bức xạ NASA Hourly)",
    step2Et: "Tính Et (Sản lượng đầu ra)",
    nasaUpdateSuccessPr: "Đã cập nhật dữ liệu NASA Hourly cho PR Model!",
    prModelDesc: "Tính toán nhanh dựa trên hệ số Performance Ratio (PR).",
    prValue: "Hệ số PR (%)",
    pTotalLabel: "Tổng công suất lắp đặt (kWp)",
    pModuleLabel: "Công suất tấm pin (Wp)",
    prLabel: "Hệ số PR (0.6 - 0.9)",
    dayLabel: "Ngày trong tháng",
    pTotalDesc: "Tổng công suất DC của hệ thống pin mặt trời",
    pModuleDesc: "Công suất định mức của một tấm pin (STC)",
    prDesc: "Hiệu suất thực tế của hệ thống (thường 0.75 - 0.85)",
    dayDesc: "Chọn ngày cụ thể để mô phỏng bức xạ theo giờ",
    ghiDesc: "Cường độ bức xạ mặt trời trung bình ngày",
    
    // Liu & Jordan Model
    importClimate: "Import Khí hậu",
    downloadSample: "Tải file mẫu",
    clearData: "Xóa dữ liệu",
    location: "Vị trí",
    systemInputs: "Thông số hệ thống",
    ghiLabelLj: "Bức xạ Hg (kWh/m²/tháng)",
    latitudeLabel: "Vĩ độ (φ)",
    areaLabelLj: "Diện tích A (m²)",
    efficiencyLabelLj: "Hiệu suất η (0.1-0.25)",
    ambientTempLabelLj: "Nhiệt độ Ta (°C)",
    noctTempLabelLj: "Nhiệt độ NOCT (°C)",
    betaCoeffLabelLj: "Hệ số β (%/°C)",
    prFactorLabelLj: "Hệ số PR (Mô hình PR)",
    systemLossLabelLj: "Hệ số tổn thất (Inv, bụi...)",
    runCalculation: "Bắt đầu tính toán",
    estimationResults: "Kết quả ước tính",
    avgDailyGhiLj: "Bức xạ ngày TB (kWh/m²)",
    yieldTempModel: "Sản lượng (Nhiệt độ)",
    yieldPrModel: "Sản lượng (PR)",
    astronomicalDetails: "Chi tiết tính toán thiên văn (Liu & Jordan)",
    cellTempTcLabel: "Nhiệt độ tế bào Tc",
    chartClimateLj: "Biểu đồ Bức xạ GHI & Nhiệt độ trung bình tháng",
    chartYieldDailyLj: "Biểu đồ Sản lượng dự báo theo giờ trong ngày",
    chartYieldMonthlyLj: "Biểu đồ Sản lượng dự báo theo ngày trong tháng",
    calcMode: "Chế độ tính toán",
    daily: "Theo ngày",
    monthly: "Theo tháng",
    dayOfMonthLj: "Ngày trong tháng",
    unitDay: "Ngày",
    totalSelectedPeriod: "Tổng cho thời gian chọn",
    solarDeclination: "Độ lệch mặt trời (δ)",
    sunsetAngle: "Góc hoàng hôn (ωs)",
    maxDayLength: "Thời gian nắng tối đa (N)",
    step1Declination: "Xác định Độ lệch mặt trời (δ)",
    step2Sunset: "Xác định Góc hoàng hôn (ωs)",
    step3HourlyRatio: "Tính tỉ lệ bức xạ tức thời (rt) tại 12h00",
    noonNoteLj: "Minh họa tại 12h00",
    importSuccessLj: "Import dữ liệu khí hậu thành công!",
    importErrorLj: "Lỗi khi import file Excel. Vui lòng kiểm tra lại định dạng mẫu.",
    confirmClearLj: "Bạn có chắc chắn muốn xóa dữ liệu đã import và quay về mặc định?",
    thMonthLj: "Tháng",
    thRadLj: "Bức xạ",
    thTempLj: "Nhiệt độ",
    yieldDaySummaryLj: "Sản lượng Ngày",
    yieldMonthSummaryLj: "Sản lượng Tháng",
    usingLossLj: "dùng Loss",

    // Performance Analysis
    analysisDesc: "Phân tích dữ liệu thực tế so với mô phỏng theo tiêu chuẩn IEC 61724-1.",
    uploadExcel: "Tải lên file Excel sản lượng thực tế",
    performanceMetrics: "Chỉ số hiệu suất",
    analysisTitle: "Phân tích hiệu quả hệ thống",
    titlePa: "Phân tích hiệu quả hệ thống",
    iecPa: "Tuân thủ tiêu chuẩn IEC 61724-1",
    simPa: "MÔ PHỎNG",
    actualPa: "THỰC TẾ",
    importPa: "Import Dữ liệu",
    areaPa: "Diện tích Pin A (m2)",
    effPa: "Hiệu suất η (0.0 - 1.0)",
    capacityPa: "Công suất Pnom (kWp)",
    regionPa: "Khu vực / Nguồn dữ liệu",
    dataLoadedPa: "Dữ liệu đã tải",
    noDataPa: "Chưa có dữ liệu",
    prActualPa: "Hiệu suất thực tế (PR)",
    yieldActualPa: "Yield Sản Lượng (Yf)",
    finalUnitPa: "h/d",
    cufRatioPa: "Tỉ lệ CUF",
    totalEnergyLabelPa: "Tổng Sản Lượng AC",
    chartTitle1Pa: "Sản lượng AC (kWh) & Chỉ số PR (%)",
    chartTitle2Pa: "Đối sánh Yield: Yf (Sản lượng) vs Yr (Bức xạ) - IEC 61724",
    step1Pa: "Tính toán theo công thức (Thế số thực tế IEC 61724)",
    iecStep0Pa: "Bước 0: Công suất danh định (Pnom)",
    iecStep1Pa: "Quy đổi sang các đơn vị IEC (Mẫu dữ liệu thực tế tại",
    yieldFinalPa: "Yf (Final Yield)",
    formulaYfPa: "Yf = E_ac / Pnom / 30 ngày",
    yieldRefPa: "Yr (Ref Yield)",
    formulaYrPa: "Yr = H_daily / 1kW/m² (STC)",
    formulaPRPa: "PR = (Yf / Yr) * 100%",
    pleaseUploadPa: "Vui lòng tải lên dữ liệu thực tế",
    uploadDescPa: "Sử dụng nút 'Import Dữ liệu' bên trên để tải lên file Excel chứa sản lượng và bức xạ thực tế.",
    totalEnergyYield: "Tổng Sản Lượng",
    refYieldYr: "Yr (Ref Yield)",
    finalYieldYf: "Yf (Final Yield)",
    chartAcPr: "Sản lượng AC (kWh) & Chỉ số PR (%)",
    chartYieldComparison: "Đối sánh Yield: Yf (Sản lượng) vs Yr (Bức xạ) - IEC 61724",
    step0NominalPower: "Bước 0: Xác định công suất danh định (Pnom)",
    step1IecFormula: "Tính toán theo công thức (Thế số thực tế IEC 61724)",
    actualPr: "Hiệu suất thực tế (PR)",
    actualYf: "Yield Sản Lượng (Yf)",
    cufRatio: "Tỉ lệ CUF",
    totalAcEnergy: "Tổng Sản Lượng AC",
    iecStep0: "Bước 0: Công suất danh định (Pnom)",
    iecStep1: "Quy đổi sang các đơn vị IEC (Mẫu dữ liệu thực tế tại",
    finalUnit: "h/d",
    formulaYf: "Yf = E_ac / Pnom / 30 ngày",
    formulaYr: "Yr = H_daily / 1kW/m² (STC)",
    formulaPR: "PR = (Yf / Yr) * 100%",
    downloadSampleHere: "Tải file mẫu tại đây",
    importActualError: "Lỗi khi import dữ liệu thực tế!",
    
    // Common
    loading: "Đang tải...",
    error: "Lỗi",
    success: "Thành công",
    province: "Tỉnh/Thành phố",
    saveProject: "Lưu dự án",
    projectSaved: "Dự án đã được lưu thành công!",
    loginToSave: "Vui lòng đăng nhập để lưu dự án.",
    projectName: "Tên dự án",
    enterProjectName: "Nhập tên dự án",
    loadProject: "Tải dự án",
    confirmDelete: "Bạn có chắc muốn xóa bản ghi này?",
    loginRequired: "Yêu cầu đăng nhập",
    loginRequiredDesc: "Vui lòng đăng nhập để xem và lưu lịch sử mô phỏng của bạn.",
    noHistory: "Chưa có lịch sử mô phỏng nào.",
    records: "Bản ghi",
    manageHistory: "Quản lý các bản mô phỏng đã thực hiện",
  },
  en: {
    // App
    title: "Photovoltaic-System Analyzer",
    subtitle: "PV System Analysis & Simulation",
    dashboard: "Dashboard",
    tempModel: "Temperature Model",
    prModel: "PR Model",
    liuJordan: "Liu & Jordan Model",
    diodeModel: "1-Diode Model",
    analysis: "Performance Analysis",
    history: "Simulation History",
    footer: "© 2026 Photovoltaic System Analyzer – Developed by Le Phuong Truong",
    langBtn: "Tiếng Việt",
    
    // Dashboard
    heroTitle: "Analysis Platform",
    heroSubtitle: "Photovoltaic System",
    heroVersion: "– Version 2.0",
    heroDesc: "The platform was developed to support simulation, forecasting, and performance evaluation of solar power systems based on standard physical models. The system integrates radiation and meteorological data from NASA POWER and applies performance evaluation methods in accordance with IEC 61724-1 standards. The tool provides an analytical environment for research, design, and evaluation of PV system operation in real-world conditions.",
    dataSource: "Data Source",
    standard: "Standard",
    benefitAccuracy: "High Accuracy",
    benefitAccuracyDesc: "Using the most advanced physical and mathematical models for simulation.",
    benefitRealtime: "Real-time Data",
    benefitRealtimeDesc: "Direct connection to NASA POWER API for accurate meteorological data.",
    benefitStandard: "Standard Compliance",
    benefitStandardDesc: "Reports and analyses strictly comply with IEC 61724-1 standards.",
    guideTitle: "Quick Guide",
    guideStep1: "Choose suitable model",
    guideStep1Desc: "Use 1-Diode Model for highest physical accuracy (need to press \"Optimize parameters to match STC\") or Temperature Model for fast calculation.",
    guideStep2: "Integrate NASA data",
    guideStep2Desc: "Press \"Fetch NASA Data\" to download real radiation and temperature at your location.",
    guideStep3: "Real-world comparison",
    guideStep3Desc: "Upload Excel file of actual production to evaluate operation and maintenance (O&M) efficiency.",
    envTitle: "Environmental Impact",
    envDesc: "Accurate simulation helps optimize design, minimize waste, and enhance ROI for green energy projects.",
    co2Reduction: "CO2 Reduction",
    treeEquivalent: "Tree Equivalent",
    diodeFeatureDesc: "Detailed simulation based on the physical characteristics of photovoltaic cells. Calculate I-V, P-V curves and MPP.",
    tempFeatureDesc: "Simulation of yield based on cell temperature (Tc) and temperature coefficient β. Integrated NASA Hourly data.",
    prFeatureDesc: "Fast calculation based on Performance Ratio (PR). Suitable for preliminary project evaluation.",
    liuJordanFeatureDesc: "Liu & Jordan astronomical model to estimate diffuse and direct radiation from total radiation.",
    analysisFeatureDesc: "Analysis of actual data vs. simulation according to IEC 61724-1 standards. Calculate PR, Yf, Yr.",

    // Diode Model
    diodeDesc: "Detailed simulation based on the physical characteristics of photovoltaic cells.",
    nasaDataBtn: "Fetch NASA Data",
    calculateBtn: "Calculate",
    optimizeBtn: "Optimize Parameters to Match STC",
    optimizing: "Optimizing...",
    optimizeHint: "* Press \"Optimize\" to automatically find Rs and n that match your Vmp/Imp.",
    systemParams: "System Parameters",
    totalPower: "Total Installed Capacity (kWp)",
    modulePower: "Module Power (kWp)",
    lossFactor: "System Loss Factor (%)",
    moduleCount: "Number of Modules:",
    actualDcPower: "Actual DC Capacity:",
    annualYield: "Estimated Annual Yield:",
    radiationData: "Radiation Data",
    avgYearly: "Yearly Avg (Daily)",
    totalYearly: "Yearly Total",
    month: "Month",
    ghi: "GHI (kWh/m²)",
    stcParams: "Module Parameters (STC)",
    theoreticalPmax: "Theoretical Pmax (Vmp*Imp):",
    simulatedPmax: "Simulated Pmax (STC):",
    totalCells: "Total Cells:",
    idealityFactor: "Ideality Factor (n)",
    formulaTitle: "1-Diode Formula (Half-Cell Support)",
    dailyYieldChart: "Average Daily Yield (kWh/day)",
    hourlyChart: "Hourly Profile",
    power: "Power",
    radiation: "Radiation",
    ambientTemp: "Ambient Temp",
    cellTemp: "Cell Temp",
    hour: "Hour",
    optimizeSuccess: "Optimization successful!",
    optimizeError: "Optimization error.",
    nasaSuccess: "NASA Hourly data updated for 1-Diode Model!",
    nasaError: "Error fetching data from NASA POWER API.",
    peakHour: "Peak hour",
    calculationDetails: "Calculation details",
    cellTempFormula: "1. Cell temperature (Tc):",
    iphFormula: "2. Photocurrent (Iph):",
    i0Formula: "3. Reverse saturation current (I0):",
    ivMppFormula: "4. Solve I-V equation (MPP):",
    yieldFormula: "5. Energy yield (Epv):",
    yieldFormulaDesc: "Epv = Ppv * t * nModules * loss factor",
    yieldFormulaNote: "Where t = time (1h), Ppv = panel power (kWp), nModules = number of panels",
    newtonRaphsonDesc: "Using Newton-Raphson iteration to find the maximum power point (Pmax) for 1 module, then multiplying by the number of modules",
    ivPvSimulation: "I-V / P-V Characteristics Simulation",
    resetStc: "Reset to STC (1000W/m², 25°C)",
    irradianceG: "Irradiance G (W/m²)",
    cellTempTc: "Cell Temperature Tc (°C)",
    voltageV: "Voltage (V)",
    currentA: "Current (A)",
    powerW: "Power (W)",
    ivCurve: "I-V Curve",
    pvCurve: "P-V Curve",
    mppPoint: "MPP Point",

    // Temperature Model
    tempModelTitle: "NASA POWER Climate Data",
    tempModelSubtitle: "Yield calculation based on actual Hourly Radiation & Temp data",
    annualRadiation: "Annual Radiation (GHI)",
    avgTemperature: "Avg Temperature",
    nasaClimateChart: "NASA Climate: Radiation (kWh/m2/day) & Temp (°C)",
    calculationInputs: "Calculation Inputs",
    ghiRadiation: "GHI Radiation (kWh/m²/day)",
    ambientTempTa: "Ambient Temp Ta (°C)",
    totalInstalledCapacity: "Total Installed Capacity (kWp)",
    modulePowerWp: "Module Power (Wp)",
    lossFactorLabel: "Loss Factor (Inv, cable, dust...)",
    dayOfMonth: "Day of Month",
    noctTemp: "NOCT Temp (°C)",
    tempCoeffBeta: "Temp Coeff β (%/°C)",
    hourlyCalcBtn: "HOURLY CALC",
    monthlyCalcBtn: "MONTHLY CALC",
    calculateNowBtn: "Calculate Now",
    yieldDistribution: "Yield Distribution",
    totalEstimatedYield: "Total Estimated Yield",
    nasaPriorityNote: "* Results prioritize NASA Hourly data if available.",
    calculationSteps: "Calculation Steps (Numerical Substitution)",
    step1Solar: "Step 1: Solar Radiation (NASA Hourly)",
    step2CellTemp: "Step 2: Cell Temperature (Tc)",
    step3Energy: "Step 3: Energy Output (Et)",
    exampleNoon: "Example at 12:00 PM",
    illustrationMonth: "Illustration for full month calculation",
    fetchNasaHourly: "Fetch NASA Data (Hourly)",
    dataSourceLabel: "Data Source:",
    liuJordanSim: "Liu & Jordan Simulation",
    nasaHourlyReal: "NASA Hourly (Real Data)",
    nasaUpdateSuccess: "NASA Hourly data updated successfully!",
    nasaFetchError: "Error fetching data from NASA POWER API.",
    cumulativeRadiation: "Cumulative Radiation (H_month)",
    avgCellTemp: "Avg Cell Temperature (Tc_avg)",
    monthlyYieldStep: "Monthly Yield (E_month)",
    tempModelDesc: "Simulation of yield based on cell temperature (Tc) and temperature coefficient β.",
    tempCoeff: "Temperature Coefficient (β) (%/°C)",

    // PR Model
    prModelTitle: "PR Model & NASA Climate",
    prModelSubtitle: "Fast yield calculation based on Performance Ratio (PR)",
    annualGhi: "Annual Radiation",
    avgMonthlyGhi: "Avg Monthly GHI",
    nasaClimateGhi: "NASA Climate (GHI)",
    prFactorLabel: "PR Factor (0.6 - 0.9)",
    totalYieldPrModel: "Total Yield (PR Model)",
    formulaTitlePrModel: "Formula & Numerical Substitution (PR Model)",
    formulaDescPrModel: "Yield is calculated by directly multiplying radiation with the system PR factor (accounting for Inverter, cable, and dust losses):",
    formulaSubstitutionNoon: "Numerical Substitution (at 12:00 PM):",
    formulaSubstitutionMonthly: "Monthly calculation substitution:",
    forecastedYieldPrModel: "Forecasted Yield (PR Model)",
    step1It: "Determine It (NASA Hourly Irradiance)",
    step2Et: "Calculate Et (Yield Output)",
    nasaUpdateSuccessPr: "NASA Hourly data updated for PR Model!",
    prModelDesc: "Fast calculation based on Performance Ratio (PR).",
    prValue: "PR Ratio (%)",
    pTotalLabel: "Total Installed Capacity (kWp)",
    pModuleLabel: "Module Power (Wp)",
    prLabel: "PR Factor (0.6 - 0.9)",
    dayLabel: "Day of Month",
    pTotalDesc: "Total DC capacity of the solar system",
    pModuleDesc: "Rated power of a single solar module (STC)",
    prDesc: "Actual system performance ratio (typically 0.75 - 0.85)",
    dayDesc: "Select a specific day for hourly radiation simulation",
    ghiDesc: "Average daily solar radiation intensity",

    // Liu & Jordan Model
    importClimate: "Import Climate",
    downloadSample: "Download Sample",
    clearData: "Clear Data",
    location: "Location",
    systemInputs: "System Parameters",
    ghiLabelLj: "GHI Radiation (kWh/m²/month)",
    latitudeLabel: "Latitude (φ)",
    areaLabelLj: "Area A (m²)",
    efficiencyLabelLj: "Efficiency η (0.1-0.25)",
    ambientTempLabelLj: "Ambient Ta (°C)",
    noctTempLabelLj: "NOCT Temp (°C)",
    betaCoeffLabelLj: "Coeff β (%/°C)",
    prFactorLabelLj: "PR Factor (PR Model)",
    systemLossLabelLj: "System Loss (Inv, dust...)",
    runCalculation: "Run Calculation",
    estimationResults: "Estimation Results",
    avgDailyGhiLj: "Avg Daily GHI (kWh/m²)",
    yieldTempModel: "Yield (Temp Model)",
    yieldPrModel: "Yield (PR Model)",
    astronomicalDetails: "Astronomical Calculation Details (Liu & Jordan)",
    cellTempTcLabel: "Cell Temp Tc",
    chartClimateLj: "Monthly GHI Radiation & Avg Temperature Chart",
    chartYieldDailyLj: "Hourly Forecasted Yield Chart",
    chartYieldMonthlyLj: "Daily Forecasted Yield Chart for Selected Month",
    calcMode: "Calculation Mode",
    daily: "Daily",
    monthly: "Monthly",
    dayOfMonthLj: "Day of month",
    unitDay: "Day",
    totalSelectedPeriod: "Total for selected period",
    solarDeclination: "Solar Declination (δ)",
    sunsetAngle: "Sunset Angle (ωs)",
    maxDayLength: "Max Day Length (N)",
    step1Declination: "Solar Declination (δ)",
    step2Sunset: "Sunset Hour Angle (ωs)",
    step3HourlyRatio: "Hourly Ratio (rt) at 12:00 PM",
    noonNoteLj: "Example at 12:00 PM",
    importSuccessLj: "Climate data imported successfully!",
    importErrorLj: "Error importing Excel. Please check the sample format.",
    confirmClearLj: "Are you sure you want to clear imported data and reset to default?",
    thMonthLj: "Month",
    thRadLj: "Radiation",
    thTempLj: "Temp",
    yieldDaySummaryLj: "Daily Yield",
    yieldMonthSummaryLj: "Monthly Yield",
    usingLossLj: "using Loss",

    // Performance Analysis
    analysisDesc: "Analysis of actual data vs. simulation according to IEC 61724-1 standards.",
    uploadExcel: "Upload Actual Production Excel File",
    performanceMetrics: "Performance Metrics",
    analysisTitle: "System Performance Analysis",
    titlePa: "System Performance Analysis",
    iecPa: "IEC 61724-1 Standard Compliant",
    simPa: "SIMULATION",
    actualPa: "ACTUAL",
    importPa: "Import Data",
    areaPa: "Panel Area A (m2)",
    effPa: "Efficiency η (0.0 - 1.0)",
    capacityPa: "Capacity Pnom (kWp)",
    regionPa: "Region / Data Source",
    dataLoadedPa: "Data Loaded",
    noDataPa: "No Data",
    prActualPa: "Actual Performance (PR)",
    yieldActualPa: "Yield Output (Yf)",
    finalUnitPa: "h/d",
    cufRatioPa: "CUF Ratio",
    totalEnergyLabelPa: "Total AC Energy Output",
    chartTitle1Pa: "AC Energy (kWh) & PR Index (%)",
    chartTitle2Pa: "Yield Comparison: Yf (Final) vs Yr (Reference) - IEC 61724",
    step1Pa: "Calculation Formula (Numerical Substitution IEC 61724)",
    iecStep0Pa: "Step 0: Nominal Power (Pnom)",
    iecStep1Pa: "Convert to IEC Units (Sample data at",
    yieldFinalPa: "Yf (Final Yield)",
    formulaYfPa: "Yf = E_ac / Pnom / 30 days",
    yieldRefPa: "Yr (Ref Yield)",
    formulaYrPa: "Yr = H_daily / 1kW/m² (STC)",
    formulaPRPa: "PR = (Yf / Yr) * 100%",
    pleaseUploadPa: "Please upload actual data",
    uploadDescPa: "Use the 'Import Data' button above to upload an Excel file containing actual yield and radiation.",
    totalEnergyYield: "Total Energy Yield",
    refYieldYr: "Yr (Ref Yield)",
    finalYieldYf: "Yf (Final Yield)",
    chartAcPr: "AC Energy (kWh) & PR Index (%)",
    chartYieldComparison: "Yield Comparison: Yf (Final) vs Yr (Reference) - IEC 61724",
    step0NominalPower: "Step 0: Nominal Power (Pnom)",
    step1IecFormula: "Calculation Formula (Numerical Substitution IEC 61724)",
    actualPr: "Actual Performance (PR)",
    actualYf: "Yield Output (Yf)",
    cufRatio: "CUF Ratio",
    totalAcEnergy: "Total AC Energy Output",
    iecStep0: "Step 0: Nominal Power (Pnom)",
    iecStep1: "Convert to IEC Units (Sample data at",
    finalUnit: "h/d",
    formulaYf: "Yf = E_ac / Pnom / 30 days",
    formulaYr: "Yr = H_daily / 1kW/m² (STC)",
    formulaPR: "PR = (Yf / Yr) * 100%",
    downloadSampleHere: "Download sample file here",
    importActualError: "Error importing actual data!",

    // Common
    loading: "Loading...",
    error: "Error",
    success: "Success",
    province: "Province/City",
    saveProject: "Save Project",
    projectSaved: "Project saved successfully!",
    loginToSave: "Please log in to save your project.",
    projectName: "Project Name",
    enterProjectName: "Enter project name",
    loadProject: "Load Project",
    confirmDelete: "Are you sure you want to delete this record?",
    loginRequired: "Login Required",
    loginRequiredDesc: "Please login to view and save your simulation history.",
    noHistory: "No simulation history found.",
    records: "Records",
    manageHistory: "Manage your past simulations",
  }
};

type Language = 'vi' | 'en';
export const LanguageContext = createContext<{
  lang: Language;
  t: typeof translations.vi;
  setLang: (l: Language) => void;
  user: User | null;
  selectedSimulation: SimulationRecord | null;
  setSelectedSimulation: (sim: SimulationRecord | null) => void;
  setActiveTab: (tab: ModelType) => void;
}>({
  lang: 'vi',
  t: translations.vi,
  setLang: () => {},
  user: null,
  selectedSimulation: null,
  setSelectedSimulation: () => {},
  setActiveTab: () => {},
});

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ModelType>(ModelType.DASHBOARD);
  const [lang, setLang] = useState<Language>('vi');
  const [user, setUser] = useState<User | null>(null);
  const [selectedSimulation, setSelectedSimulation] = useState<SimulationRecord | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const t = translations[lang];

  const toggleLang = () => {
    setLang(lang === 'vi' ? 'en' : 'vi');
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <LanguageContext.Provider value={{ 
      lang, 
      t, 
      setLang, 
      user, 
      selectedSimulation, 
      setSelectedSimulation,
      setActiveTab
    }}>
      <div className="max-w-7xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden min-h-[90vh] flex flex-col my-4">
        {/* Header */}
        <header className="bg-[#1e40af] p-8 text-white text-center relative">
          <div className="absolute top-4 right-4 flex gap-2">
            <button 
              onClick={toggleLang}
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-sm flex items-center gap-2 border border-white/30 transition-all font-bold"
            >
              <i className="fas fa-globe"></i> {t.langBtn}
            </button>
            {user ? (
              <button 
                onClick={handleLogout}
                className="bg-red-500/20 hover:bg-red-500/40 px-4 py-2 rounded-full text-sm flex items-center gap-2 border border-red-500/30 transition-all font-bold"
              >
                <img src={user.photoURL || ''} alt="avatar" className="w-5 h-5 rounded-full" />
                {lang === 'vi' ? 'Đăng xuất' : 'Logout'}
              </button>
            ) : (
              <button 
                onClick={handleLogin}
                className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-full text-sm flex items-center gap-2 border border-emerald-400/30 transition-all font-bold"
              >
                <i className="fas fa-sign-in-alt"></i> {lang === 'vi' ? 'Đăng nhập' : 'Login'}
              </button>
            )}
          </div>
          <div className="flex justify-center items-center gap-4">
            <span className="text-4xl">☀️</span>
            <h1 className="text-3xl font-bold uppercase tracking-wide">
              {t.title}
            </h1>
          </div>
          <p className="text-blue-100 font-light italic mt-2 opacity-80">
            {t.subtitle}
          </p>
        </header>

        {/* Tabs Navigation */}
        <nav className="flex bg-gray-100 border-b border-gray-200 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab(ModelType.DASHBOARD)}
            className={`flex-1 min-w-[120px] py-4 px-6 text-center font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === ModelType.DASHBOARD 
              ? 'bg-white text-blue-700 border-b-4 border-blue-600' 
              : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-home"></i> {t.dashboard}
          </button>
          <button
            onClick={() => setActiveTab(ModelType.DIODE)}
            className={`flex-1 min-w-[180px] py-4 px-6 text-center font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === ModelType.DIODE 
              ? 'bg-white text-blue-700 border-b-4 border-blue-600' 
              : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-microchip"></i> {t.diodeModel}
          </button>
          <button
            onClick={() => setActiveTab(ModelType.TEMPERATURE)}
            className={`flex-1 min-w-[150px] py-4 px-6 text-center font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === ModelType.TEMPERATURE 
              ? 'bg-white text-blue-700 border-b-4 border-blue-600' 
              : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-thermometer-half"></i> {t.tempModel}
          </button>
          <button
            onClick={() => setActiveTab(ModelType.PR)}
            className={`flex-1 min-w-[150px] py-4 px-6 text-center font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === ModelType.PR 
              ? 'bg-white text-blue-700 border-b-4 border-blue-600' 
              : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-chart-bar"></i> {t.prModel}
          </button>
          <button
            onClick={() => setActiveTab(ModelType.LIU_JORDAN)}
            className={`flex-1 min-w-[180px] py-4 px-6 text-center font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === ModelType.LIU_JORDAN 
              ? 'bg-white text-blue-700 border-b-4 border-blue-600' 
              : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-calculator"></i> {t.liuJordan}
          </button>
          <button
            onClick={() => setActiveTab(ModelType.ANALYSIS)}
            className={`flex-1 min-w-[180px] py-4 px-6 text-center font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === ModelType.ANALYSIS 
              ? 'bg-white text-blue-700 border-b-4 border-blue-600' 
              : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-tasks"></i> {t.analysis}
          </button>
          <button
            onClick={() => setActiveTab(ModelType.HISTORY)}
            className={`flex-1 min-w-[180px] py-4 px-6 text-center font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === ModelType.HISTORY 
              ? 'bg-white text-blue-700 border-b-4 border-blue-600' 
              : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-history"></i> {t.history}
          </button>
        </nav>

        {/* Main Content Area */}
        <main className="flex-grow p-6 md:p-10 bg-[#f8fafc]">
          {activeTab === ModelType.DASHBOARD && <Dashboard />}
          {activeTab === ModelType.DIODE && <DiodeModel />}
          {activeTab === ModelType.TEMPERATURE && <TemperatureModel />}
          {activeTab === ModelType.PR && <PRModel />}
          {activeTab === ModelType.LIU_JORDAN && <LiuJordanModel />}
          {activeTab === ModelType.ANALYSIS && <PerformanceAnalysis />}
          {activeTab === ModelType.HISTORY && <SimulationHistory />}
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
