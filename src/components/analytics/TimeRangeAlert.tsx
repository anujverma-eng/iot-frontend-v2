/**
 * ⏰ Time Range Alert Modal
 * 
 * Displays modal dialog for time range validation:
 * - Error blocking for ranges > 30 days
 * - Performance impact indicators  
 * - Data point and memory usage estimates
 * - Auto-fix suggestions with quick action buttons
 * - User-friendly explanations and guidance
 */

import React from 'react';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Button, 
  Chip,
  Card,
  CardBody
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { 
  TimeRangeValidationResult, 
  createTimeRangeAlert, 
  TIME_RANGE_LIMITS,
  getRecommendedTimeRanges 
} from '../../utils/timeRangeValidator';

interface TimeRangeAlertProps {
  validation: TimeRangeValidationResult;
  isOpen: boolean;
  onAdjustRange?: (suggestedEndDate: Date) => void;
  onUseRecommendedRange?: (start: Date, end: Date) => void;
  onClose: () => void;
  showRecommendations?: boolean;
}

export const TimeRangeAlert: React.FC<TimeRangeAlertProps> = ({
  validation,
  isOpen,
  onAdjustRange,
  onUseRecommendedRange,
  onClose,
  showRecommendations = true
}) => {
  const alertData = createTimeRangeAlert(validation);
  const recommendations = getRecommendedTimeRanges();
  
  // Don't render modal for normal ranges
  if (validation.severity === 'info') {
    return null;
  }
  
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="2xl"
      placement="center"
      backdrop="blur"
      isDismissable={validation.severity !== 'error'}
      hideCloseButton={validation.severity === 'error'}
      classNames={{
        header: "border-b border-divider",
        footer: "border-t border-divider",
        closeButton: "hover:bg-default-100"
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3 pb-4">
          <div className={`p-2 rounded-full ${getModalIconBg()}`}>
            <Icon 
              icon={alertData.icon} 
              className={getAlertIconColor()}
              width={24} 
            />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{alertData.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Chip 
                size="sm" 
                color={alertData.color as any}
                variant="flat"
              >
                {validation.dayCount} days
              </Chip>
              <Chip
                size="sm"
                color={getPerformanceColor()}
                variant="flat"
                startContent={<Icon icon={alertData.performanceIcon} width={12} />}
              >
                {validation.performanceImpact} impact
              </Chip>
            </div>
          </div>
        </ModalHeader>
        
        <ModalBody className="py-6">
          {/* Main message */}
          <div className="text-default-700 mb-4">
            {alertData.message}
          </div>
          
          {/* Data estimates card */}
          {(validation.estimatedDataPoints || validation.estimatedMemoryMB) && (
            <Card className="mb-4">
              <CardBody className="p-4">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Icon icon="lucide:bar-chart-3" width={16} />
                  Estimated Resource Usage
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {validation.estimatedDataPoints && (
                    <div>
                      <span className="text-default-500 text-sm">Data points:</span>
                      <div className="font-mono font-bold text-lg">
                        ~{validation.estimatedDataPoints.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {validation.estimatedMemoryMB && (
                    <div>
                      <span className="text-default-500 text-sm">Memory usage:</span>
                      <div className="font-mono font-bold text-lg">
                        ~{validation.estimatedMemoryMB.toFixed(1)} MB
                      </div>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          )}
          
          {/* Auto-fix suggestion for error states */}
          {validation.severity === 'error' && alertData.showSuggestion && (
            <Card className="border-danger-200 bg-danger-50">
              <CardBody className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-danger-100 rounded-full">
                    <Icon icon="lucide:lightbulb" className="text-danger-600" width={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-danger-700 mb-2">
                      ⚡ Quick Fix Available
                    </h4>
                    <p className="text-danger-600 mb-4">
                      We can automatically adjust your end date to <strong>{alertData.suggestedEndDate?.toLocaleDateString()}</strong> 
                      to create a valid {TIME_RANGE_LIMITS.MAX_DAYS}-day range while keeping your start date.
                    </p>
                    
                    {onAdjustRange && alertData.suggestedEndDate && (
                      <Button
                        color="danger"
                        variant="flat"
                        onPress={() => {
                          onAdjustRange(alertData.suggestedEndDate!);
                          onClose();
                        }}
                        startContent={<Icon icon="lucide:calendar-check" width={18} />}
                        className="font-semibold"
                      >
                        Apply Quick Fix
                      </Button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </ModalBody>
        
        <ModalFooter className="pt-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-default-400">
              💡 Tip: Keep ranges under 30 days for optimal performance
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="light"
                onPress={onClose}
                startContent={<Icon icon="lucide:x" width={16} />}
              >
                {validation.severity === 'error' ? 'Cancel' : 'Close'}
              </Button>
              
              {validation.severity !== 'error' && (
                <Button
                  color="primary"
                  onPress={onClose}
                  startContent={<Icon icon="lucide:check" width={16} />}
                >
                  Continue
                </Button>
              )}
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
  
  function getAlertBorderColor() {
    switch (validation.severity) {
      case 'error': return 'border-l-danger-500';
      case 'critical': return 'border-l-warning-500';
      case 'warning': return 'border-l-warning-400';
      default: return 'border-l-primary-500';
    }
  }
  
  function getAlertIconColor() {
    switch (validation.severity) {
      case 'error': return 'text-danger-500';
      case 'critical': return 'text-warning-500';
      case 'warning': return 'text-warning-400';
      default: return 'text-primary-500';
    }
  }
  
  function getPerformanceColor() {
    switch (validation.performanceImpact) {
      case 'severe': return 'danger';
      case 'high': return 'warning';
      case 'moderate': return 'primary';
      default: return 'success';
    }
  }
  
  function getModalIconBg() {
    switch (validation.severity) {
      case 'error': return 'bg-danger-100';
      case 'critical': return 'bg-warning-100';
      case 'warning': return 'bg-warning-100';
      default: return 'bg-primary-100';
    }
  }
};