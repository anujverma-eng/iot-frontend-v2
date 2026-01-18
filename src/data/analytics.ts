
// Predefined time ranges
export const timeRangePresets = [
  { label: 'Last Hour', getValue: () => ({ 
    start: new Date(Date.now() - 60 * 60 * 1000), 
    end: new Date(Date.now() + 5 * 60 * 1000)
  })},
  { label: 'Today', getValue: () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return { start: today, end: new Date(Date.now() + 5 * 60 * 1000) };
  }},
  { label: 'Last 2 Days', getValue: () => ({ 
    start: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), 
    end: new Date(Date.now() + 5 * 60 * 1000)
  })},
  { label: 'Last 7 Days', getValue: () => ({ 
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 
    end: new Date(Date.now() + 5 * 60 * 1000)
  })},
  { label: 'Last 30 Days', getValue: () => ({ 
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 
    end: new Date(Date.now() + 5 * 60 * 1000)
  })},
  { label: 'Custom', getValue: () => ({ 
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), 
    end: new Date(Date.now() + 5 * 60 * 1000)
  })}
];

// Status options for filtering
export const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'live', label: 'Online' }, // Changed from 'Live' to 'Online' for clarity
  { value: 'offline', label: 'Offline' }
];

// Sensor type options for filtering
export const sensorTypes = [
  { value: 'temperature', label: 'Temperature' },
  { value: 'humidity', label: 'Humidity' },
  { value: 'pressure', label: 'Pressure' },
  { value: 'battery', label: 'Battery' },
  { value: 'co2', label: 'CO₂' },
  { value: 'light', label: 'Light' },
  { value: 'motion', label: 'Motion' },
  { value: 'deflection', label: 'Deflection' }
];

export const chartColors = [
  "#006FEE", // primary
  "#F31260", // danger
  "#17C964", // success
  "#F5A524", // warning
  "#7828C8", // secondary
  "#0072F5",
  "#FF4ECD",
  "#9750DD",
  "#17C6AA",
  "#F5A300"
];

export const CHART_COLORS = {
  primary: '#4f46e5',
  secondary: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
  text: '#374151',
  border: '#d1d5db',
  grid: '#e5e7eb',
  background: '#f3f4f6',
  tooltipBg: '#ffffff'
};

export const axisStyle = {
  stroke: CHART_COLORS.text,
  tickColor: CHART_COLORS.text,
  fontSize: 12,
  axisLine: { stroke: CHART_COLORS.border }
};
export const tooltipStyle = {
  backgroundColor: CHART_COLORS.tooltipBg,
  border: `1px solid ${CHART_COLORS.border}`,
  borderRadius: '8px',
  fontSize: '12px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
};

export const brushConfig = {
  height: 30,
  stroke: CHART_COLORS.warning,
  fill: CHART_COLORS.background,
  travellerWidth: 10,
  gap: 1
};