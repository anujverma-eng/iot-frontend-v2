import React from 'react';
import { BatteryIconWithCells } from '../components/analytics/BatteryIconWithCells';

/**
 * Battery Test Component - For testing different battery levels
 * You can temporarily add this to your app to see all battery states
 */
export const BatteryTestComponent: React.FC = () => {
  const testBatteries = [
    { level: undefined, label: 'Unknown' },
    { level: 3, label: 'Nearly Empty' },
    { level: 15, label: 'Critical' },
    { level: 35, label: 'Low' },
    { level: 55, label: 'Moderate' },
    { level: 85, label: 'Good' },
    { level: 95, label: 'Full' },
  ];

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Battery Icon Tests</h3>
      <div className="grid grid-cols-1 gap-4">
        {testBatteries.map((test, index) => (
          <div key={index} className="flex items-center gap-4 p-3 border rounded">
            <BatteryIconWithCells 
              battery={test.level}
              size={20}
            />
            <div>
              <span className="font-medium">{test.label}</span>
              {test.level !== undefined && (
                <span className="text-sm text-gray-500 ml-2">({test.level}%)</span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-gray-50 rounded">
        <h4 className="font-medium mb-2">How to use in your components:</h4>
        <pre className="text-sm text-gray-700">
{`<BatteryIconWithCells 
  battery={sensor.battery}
  size={16}
/>`}
        </pre>
      </div>
    </div>
  );
};

// To test, temporarily add this to your analytics page:
// import { BatteryTestComponent } from './path/to/BatteryTestComponent';
// Then add <BatteryTestComponent /> in your JSX
