import React from 'react';
import { Button, Input } from '@heroui/react';
import { Icon } from '@iconify/react';

interface CalendarProps {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date) => void;
  onClose: () => void;
}

export const Calendar: React.FC<CalendarProps> = ({
  startDate,
  endDate,
  onChange,
  onClose
}) => {
  const [start, setStart] = React.useState(formatDateForInput(startDate));
  const [end, setEnd] = React.useState(formatDateForInput(endDate));
  const [selectionStep, setSelectionStep] = React.useState<'start' | 'end'>('start');
  
  // Reset selection step when component opens
  React.useEffect(() => {
    setSelectionStep('start');
    setStart(formatDateForInput(startDate));
    setEnd(formatDateForInput(endDate));
  }, [startDate, endDate]);
  
  function formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
  function handleStartChange(e: React.ChangeEvent<HTMLInputElement>) {
    setStart(e.target.value);
    setSelectionStep('end');
  }
  
  function handleEndChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEnd(e.target.value);
  }
  
  function handleApply() {
    const newStart = new Date(start);
    const newEnd = new Date(end);
    
    // Set end time to end of day
    newEnd.setHours(23, 59, 59, 999);
    
    // Ensure end date is not before start date
    if (newEnd < newStart) {
      newEnd.setTime(newStart.getTime());
      newEnd.setHours(23, 59, 59, 999);
    }
    
    onChange(newStart, newEnd);
    onClose();
  }
  
  // Check if we're on a mobile device
  const isMobile = React.useMemo(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  }, []);
  
  return (
    <div className="w-full max-w-md">
      <h3 className="text-lg font-medium mb-4">Custom Date Range</h3>
      
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-foreground-500">
            {selectionStep === 'start' ? 'Select Start Date' : 'Select End Date'}
          </label>
          
          {selectionStep === 'start' ? (
            <Input
              type="date"
              value={start}
              onChange={handleStartChange}
              placeholder="Start date"
              startContent={<Icon icon="lucide:calendar" className="text-default-400" />}
              autoFocus
              fullWidth
            />
          ) : (
            <Input
              type="date"
              value={end}
              onChange={handleEndChange}
              placeholder="End date"
              startContent={<Icon icon="lucide:calendar" className="text-default-400" />}
              autoFocus
              fullWidth
            />
          )}
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-foreground-500">Selected Range:</div>
            <div className="text-sm font-medium">
              {new Date(start).toLocaleDateString()} - {new Date(end).toLocaleDateString()}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleApply}>
            Apply
          </Button>
        </div>
        
        {isMobile && (
          <div className="text-xs text-center text-default-500 mt-2">
            {selectionStep === 'start' ? 'After selecting start date, you\'ll be prompted to select end date' : 'Click Apply to confirm your date range'}
          </div>
        )}
      </div>
    </div>
  );
};