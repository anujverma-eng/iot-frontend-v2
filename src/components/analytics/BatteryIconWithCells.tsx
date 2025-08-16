import React from 'react';
import { Battery, BatteryWarning } from 'lucide-react';
import { getBatteryColor } from '../../utils/battery';

interface BatteryIconWithCellsProps {
  battery: number | undefined;
  className?: string;
  size?: number;
}

/**
 * Custom Battery Icon Component with visual fill cells based on percentage
 */
export const BatteryIconWithCells: React.FC<BatteryIconWithCellsProps> = ({ 
  battery, 
  className = '', 
  size = 16 
}) => {
  if (battery === undefined) {
    return (
      <div className={`relative inline-block ${className}`} style={{ width: size, height: size }}>
        <BatteryWarning size={size} className="text-gray-400" />
      </div>
    );
  }

  const fillPercentage = Math.max(0, Math.min(100, battery));
  const colorClass = getBatteryColor(battery);
  
  return (
    <div className={`relative inline-block ${className}`} style={{ width: size * 1.2, height: size }}>
      {/* Base battery outline - we'll create a custom SVG for better control */}
      <svg 
        width={size * 1.2} 
        height={size} 
        viewBox="0 0 24 18" 
        className={colorClass}
        style={{ overflow: 'visible' }}
      >
        {/* Battery body outline */}
        <rect 
          x="1" 
          y="3" 
          width="18" 
          height="12" 
          rx="2" 
          ry="2" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.5"
        />
        
        {/* Battery terminal */}
        <rect 
          x="19" 
          y="7" 
          width="3" 
          height="4" 
          rx="1" 
          ry="1" 
          fill="currentColor"
        />
        
        {/* Battery fill cells based on percentage */}
        {/* Cell 1: 0-25% */}
        {fillPercentage > 5 && (
          <rect 
            x="3" 
            y="5" 
            width="3" 
            height="8" 
            rx="0.5" 
            fill="currentColor"
            opacity={fillPercentage >= 25 ? 1 : 0.6}
          />
        )}
        
        {/* Cell 2: 25-50% */}
        {fillPercentage > 25 && (
          <rect 
            x="7" 
            y="5" 
            width="3" 
            height="8" 
            rx="0.5" 
            fill="currentColor"
            opacity={fillPercentage >= 50 ? 1 : 0.6}
          />
        )}
        
        {/* Cell 3: 50-75% */}
        {fillPercentage > 50 && (
          <rect 
            x="11" 
            y="5" 
            width="3" 
            height="8" 
            rx="0.5" 
            fill="currentColor"
            opacity={fillPercentage >= 75 ? 1 : 0.6}
          />
        )}
        
        {/* Cell 4: 75-100% */}
        {fillPercentage > 75 && (
          <rect 
            x="15" 
            y="5" 
            width="3" 
            height="8" 
            rx="0.5" 
            fill="currentColor"
          />
        )}
      </svg>
    </div>
  );
};
