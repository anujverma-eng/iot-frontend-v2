import { Button, Drawer, Tooltip } from '@heroui/react';
import { Icon } from '@iconify/react';
import React from 'react';
import { FilterState } from '../../types/sensor';
import { FilterBar } from './filter-bar';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  isSoloMode: boolean;
  isComparing: boolean;
  selectedSensorCount: number;
  onToggleCompareSheet: () => void;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  filters,
  onFiltersChange,
  isSoloMode,
  isComparing,
  selectedSensorCount,
  onToggleCompareSheet
}) => {
  const [isMobileFilterOpen, setIsMobileFilterOpen] = React.useState(false);
  const [isMobileSensorListOpen, setIsMobileSensorListOpen] = React.useState(false);
  
  // Replace useMediaQuery with a simple window check
  const [isMobile, setIsMobile] = React.useState(false);
  
  // Check window width on mount and resize
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return (
    <div className="relative h-full">
      {/* Mobile Filter Button */}
      {isMobile && !isSoloMode && (
        <div className="fixed bottom-20 right-4 z-30">
          <Tooltip content="Filters" placement="left">
            <Button
              isIconOnly
              color="primary"
              variant="solid"
              radius="full"
              size="lg"
              onPress={() => setIsMobileFilterOpen(true)}
              className="shadow-lg"
            >
              <Icon icon="lucide:filter" width={24} />
            </Button>
          </Tooltip>
        </div>
      )}
      
      {/* Mobile Sensor List Button */}
      {isMobile && !isSoloMode && (
        <div className="fixed bottom-4 right-4 z-30">
          <Tooltip content="Sensors" placement="left">
            <Button
              isIconOnly
              color="primary"
              variant="solid"
              radius="full"
              size="lg"
              onPress={() => setIsMobileSensorListOpen(true)}
              className="shadow-lg"
            >
              <Icon icon="lucide:list" width={24} />
            </Button>
          </Tooltip>
        </div>
      )}
      
      {/* Mobile Compare Button */}
      {isMobile && isComparing && (
        <div className="fixed bottom-4 left-4 z-30">
          <Tooltip content="Compare Sensors" placement="right">
            <Button
              isIconOnly
              color="secondary"
              variant="solid"
              radius="full"
              size="lg"
              onPress={onToggleCompareSheet}
              className="shadow-lg"
            >
              <div className="relative">
                <Icon icon="lucide:bar-chart-2" width={24} />
                {selectedSensorCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-danger text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    {selectedSensorCount}
                  </div>
                )}
              </div>
            </Button>
          </Tooltip>
        </div>
      )}
      
      {/* Mobile Filter Sheet - Changed to Drawer */}
      <Drawer
        isOpen={isMobileFilterOpen}
        onOpenChange={setIsMobileFilterOpen}
        placement="bottom"
        className="h-3/4"
      >
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Filters</h3>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => setIsMobileFilterOpen(false)}
            >
              <Icon icon="lucide:x" width={16} />
            </Button>
          </div>
          
          <FilterBar
            filters={filters}
            onFiltersChange={(newFilters) => {
              onFiltersChange(newFilters);
              setIsMobileFilterOpen(false);
            }}
          />
        </div>
      </Drawer>
      
      {/* Main Content */}
      {children}
    </div>
  );
};