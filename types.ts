
export enum ModelType {
  TEMPERATURE = 'TEMPERATURE',
  PR = 'PR',
  ANALYSIS = 'ANALYSIS'
}

export interface SolarInputs {
  ghi: number; // H: GHI trung bình ngày (Wh/m2/ngày)
  latitude: number; // phi: Vĩ độ địa điểm
  dayOfYear: number; // n: Ngày trong năm
  area: number; // A: Diện tích tấm pin (m2)
  efficiency: number; // eta: Hiệu suất danh định
  tempCoeff: number; // beta: Hệ số nhiệt độ (1/°C)
  noct: number; // T_noct: NOCT (°C)
  ambientTemp: number; // T_a(t): Nhiệt độ môi trường (°C)
  pr: number; // Performance Ratio (0.6 - 0.85)
}

export interface CalculationResult {
  hourlyEnergy: number[];
  totalDaily: number;
  totalMonthly: number;
}
