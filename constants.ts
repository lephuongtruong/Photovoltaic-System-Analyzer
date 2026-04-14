
export const VIETNAM_PROVINCES: Record<string, {lat: number, lon: number}> = {
  "Hà Nội": { lat: 21.0285, lon: 105.8542 },
  "Hồ Chí Minh": { lat: 10.8231, lon: 106.6297 },
  "Đà Nẵng": { lat: 16.0544, lon: 108.2022 },
  "Hải Phòng": { lat: 20.8449, lon: 106.6881 },
  "Cần Thơ": { lat: 10.0333, lon: 105.7833 },
  "Huế": { lat: 16.4637, lon: 107.5909 },
  "An Giang": { lat: 10.3759, lon: 105.4323 },
  "Bắc Ninh": { lat: 21.1861, lon: 106.0763 },
  "Cà Mau": { lat: 9.1769, lon: 105.1524 },
  "Cao Bằng": { lat: 22.6667, lon: 106.25 },
  "Đắk Lắk": { lat: 12.6667, lon: 108.05 },
  "Điện Biên": { lat: 21.3833, lon: 103.0167 },
  "Đồng Nai": { lat: 10.9575, lon: 106.8427 },
  "Đồng Tháp": { lat: 10.4542, lon: 105.6378 },
  "Gia Lai": { lat: 13.9833, lon: 108 },
  "Hà Tĩnh": { lat: 18.3333, lon: 105.9 },
  "Hưng Yên": { lat: 20.6464, lon: 106.0511 },
  "Khánh Hòa": { lat: 12.2467, lon: 109.1942 },
  "Lai Châu": { lat: 22.3167, lon: 103.4667 },
  "Lâm Đồng": { lat: 11.9464, lon: 108.4419 },
  "Lạng Sơn": { lat: 21.85, lon: 106.75 },
  "Lào Cai": { lat: 22.4833, lon: 103.9667 },
  "Nghệ An": { lat: 18.6667, lon: 105.6667 },
  "Ninh Bình": { lat: 20.2539, lon: 105.975 },
  "Phú Thọ": { lat: 21.3236, lon: 105.402 },
  "Quảng Ngãi": { lat: 15.1205, lon: 108.8045 },
  "Quảng Ninh": { lat: 20.95, lon: 107.0833 },
  "Quảng Trị": { lat: 16.75, lon: 107.2 },
  "Sơn La": { lat: 21.3167, lon: 103.9 },
  "Tây Ninh": { lat: 11.312, lon: 106.101 },
  "Thái Nguyên": { lat: 21.5939, lon: 105.8481 },
  "Thanh Hóa": { lat: 19.8, lon: 105.7667 },
  "Tuyên Quang": { lat: 21.8167, lon: 105.2167 },
  "Vĩnh Long": { lat: 10.2541, lon: 105.9723 }
};

export const DEFAULT_REGIONAL_DATA = Object.keys(VIETNAM_PROVINCES).reduce((acc, name) => {
  acc[name] = {
    lat: VIETNAM_PROVINCES[name].lat,
    lon: VIETNAM_PROVINCES[name].lon,
    months: Array(12).fill(null).map(() => ({ 
      ghi_daily: 4.5, 
      temp: 25,
      hourlyProfile: Array(24).fill(null).map((_, h) => ({ ghi: 0, temp: 25 }))
    })),
    dailyGhi: Array(366).fill(4.5),
    dailyTemp: Array(366).fill(25),
    hasNasa: false
  };
  return acc;
}, {} as any);

export const LIU_JORDAN_DEFAULT_DATA: any = {
  "Tây Ninh": {
    lat: 11.312, lon: 106.101,
    months: [
      { rad: 156.38, temp: 26.50 }, { rad: 178.64, temp: 27.27 }, { rad: 202.64, temp: 28.67 },
      { rad: 190.92, temp: 29.68 }, { rad: 174.85, temp: 29.28 }, { rad: 167.19, temp: 28.44 },
      { rad: 180.45, temp: 27.91 }, { rad: 180.84, temp: 27.82 }, { rad: 155.87, temp: 27.63 },
      { rad: 132.53, temp: 27.38 }, { rad: 145.49, temp: 27.16 }, { rad: 136.32, temp: 26.36 }
    ]
  },
  "Đồng Nai": {
    lat: 10.9575, lon: 106.8427,
    months: [
      { rad: 152.60, temp: 25.97 }, { rad: 150.50, temp: 27.55 }, { rad: 166.70, temp: 29.08 },
      { rad: 152.70, temp: 29.71 }, { rad: 163.70, temp: 28.27 }, { rad: 160.50, temp: 26.69 },
      { rad: 162.20, temp: 26.09 }, { rad: 162.80, temp: 25.92 }, { rad: 138.10, temp: 25.75 },
      { rad: 147.20, temp: 25.74 }, { rad: 139.00, temp: 25.65 }, { rad: 138.30, temp: 25.27 }
    ]
  },
  "Hà Nội": {
    lat: 21.0285, lon: 105.8542,
    months: [
      { rad: 68.80, temp: 17.69 }, { rad: 93.94, temp: 18.95 }, { rad: 104.89, temp: 21.72 },
      { rad: 145.57, temp: 25.43 }, { rad: 152.18, temp: 28.50 }, { rad: 177.77, temp: 29.82 },
      { rad: 169.89, temp: 29.90 }, { rad: 145.69, temp: 29.44 }, { rad: 137.06, temp: 28.52 },
      { rad: 118.81, temp: 26.01 }, { rad: 85.53, temp: 22.94 }, { rad: 98.58, temp: 19.36 }
    ]
  }
};
