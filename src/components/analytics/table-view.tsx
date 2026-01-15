import {
  Badge,
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Pagination
} from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../store';
import { fetchTableData, selectTableData, selectTableLoading } from '../../store/telemetrySlice';
import { ChartConfig, DataPoint } from '../../types/sensor';
import { formatNumericValue } from "../../utils/numberUtils";

type GroupByOption = 'none' | 'hourly' | 'daily' | 'weekly';

// Export controls state interface for parent components
export interface TableControlsState {
  searchQuery: string;
  groupBy: GroupByOption;
  rowsPerPage: number;
  onSearchChange: (value: string) => void;
  onGroupByChange: (key: React.Key) => void;
  onRowsPerPageChange: (key: React.Key) => void;
}

interface TableViewProps {
  config: ChartConfig;
  onDownloadCSV?: () => void;
  sensorId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  onControlsReady?: (controls: TableControlsState) => void;
  hideInternalControls?: boolean; // Option to hide built-in controls when rendered externally
  /** Per-sensor live mode - when true, use live chart data. When false, fetch from API */
  isLiveMode?: boolean;
}

interface TableDataItem {
  id: string;
  timestamp: number;
  date: string;
  time: string;
  value: number;
  min?: number;
  max?: number;
  avg?: number;
  count?: number;
}

export const TableView: React.FC<TableViewProps> = ({ 
  config, 
  onDownloadCSV, 
  sensorId, 
  timeRange,
  onControlsReady,
  hideInternalControls = false,
  isLiveMode: externalIsLiveMode,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  
  // Use external isLiveMode if provided (per-sensor mode from parent)
  // This is the preferred approach - parent knows the sensor's actual mode
  const isLiveMode = externalIsLiveMode ?? false; // Default to historical mode for safety
  
  const tableData = useSelector(selectTableData);
  const isTableLoading = useSelector(selectTableLoading);

  // Store the unit from API response for accuracy
  const [actualUnit, setActualUnit] = React.useState<string>(config.unit || '');

  const [page, setPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(100);
  const [groupBy, setGroupBy] = React.useState<GroupByOption>('none');
  const [sortDescriptor, setSortDescriptor] = React.useState({ column: 'timestamp', direction: 'descending' });
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('');

  // Fetch paginated table data when component mounts or parameters change
  React.useEffect(() => {
    if (sensorId && timeRange && !isLiveMode && groupBy === 'none') {
      // Only fetch server-side data when not in live mode and no grouping
      dispatch(fetchTableData({
        sensorIds: [sensorId],
        timeRange: {
          start: timeRange.start.toISOString(),
          end: timeRange.end.toISOString()
        },
        pagination: {
          page,
          limit: rowsPerPage
        },
        sortBy: sortDescriptor.column as 'timestamp' | 'value',
        sortOrder: sortDescriptor.direction as 'asc' | 'desc',
        search: debouncedSearchQuery || undefined // Include search if provided
      }));
    }
  }, [dispatch, sensorId, timeRange, page, rowsPerPage, sortDescriptor, isLiveMode, groupBy, debouncedSearchQuery]);

  // Get current sensor's paginated table data
  const currentSensorTableData = sensorId && tableData[sensorId] ? tableData[sensorId] : null;

  // Helper function to format date and time
  const formatDateTime = React.useCallback((timestamp: number | string) => {
    const date = new Date(timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return {
        date: 'Invalid Date',
        time: 'Invalid Time'
      };
    }
    
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
  }, []);

  // Helper function to process grouped data (used for both live and offline modes with grouping)
  const processGroupedData = React.useCallback((dataSource: DataPoint[], groupBy: GroupByOption) => {
    // Group data based on selected option
    const groupedData: Record<string, DataPoint[]> = {};
    
    dataSource.forEach((point: DataPoint) => {
      const date = new Date(point.timestamp);
      let groupKey: string;
      
      if (groupBy === 'hourly') {
        // Group by hour
        groupKey = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          date.getHours()
        ).toISOString();
      } else if (groupBy === 'daily') {
        // Group by day
        groupKey = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        ).toISOString();
      } else {
        // Group by week
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday
        const startOfWeek = new Date(date.setDate(diff));
        groupKey = new Date(
          startOfWeek.getFullYear(),
          startOfWeek.getMonth(),
          startOfWeek.getDate()
        ).toISOString();
      }
      
      if (!groupedData[groupKey]) {
        groupedData[groupKey] = [];
      }
      
      groupedData[groupKey].push(point);
    });
    
    // Calculate statistics for each group
    return Object.entries(groupedData).map(([key, points], index) => {
      const values = points.map(p => p.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      const timestamp = new Date(key).getTime();
      const { date, time } = formatDateTime(timestamp);
      
      let displayDate: string;
      if (groupBy === 'hourly') {
        displayDate = `${date} ${new Date(timestamp).getHours()}:00`;
      } else if (groupBy === 'daily') {
        displayDate = date;
      } else {
        // Weekly
        const endOfWeek = new Date(timestamp);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        displayDate = `${date} - ${endOfWeek.toLocaleDateString()}`;
      }
      
      return {
        id: `group-${index}`,
        timestamp,
        date: displayDate,
        time: groupBy === 'hourly' ? `${new Date(timestamp).getHours()}:00 - ${new Date(timestamp).getHours()}:59` : '',
        value: avg,
        min,
        max,
        avg,
        count: points.length
      };
    });
  }, [formatDateTime]);

  // Process data for table display
  const processedData = React.useMemo(() => {

    // OFFLINE MODE: Use server-side paginated table data (primary data source)
    if (!isLiveMode) {
      if (!currentSensorTableData || !currentSensorTableData.data || !Array.isArray(currentSensorTableData.data)) {
        return []; // Return empty array if no server data - let loading/empty state handle display
      }

      // Extract the sensor data from the API response structure
      // API returns: { status, success, message, data: [{ sensorId, mac, type, unit, data: [...] }], pagination: {...} }
      let sensorDataArray: any[] = [];
      let actualDataPoints: any[] = [];
      
      // Check if we have the full API response or just the processed data
      if (currentSensorTableData.data && Array.isArray(currentSensorTableData.data)) {
        sensorDataArray = currentSensorTableData.data;
        
        // Find the matching sensor data (should be the first one since we query by specific sensor ID)
        if (sensorDataArray.length > 0) {
          const sensorEntry = sensorDataArray.find((sensor: any) => sensor.sensorId === sensorId || sensor.mac === sensorId);
          if (sensorEntry && sensorEntry.data && Array.isArray(sensorEntry.data)) {
            actualDataPoints = sensorEntry.data;
            // Update unit from API response
            if (sensorEntry.unit && sensorEntry.unit !== actualUnit) {
              setActualUnit(sensorEntry.unit);
            }
          } else if (sensorDataArray[0] && sensorDataArray[0].data) {
            // Fallback: use first sensor's data if exact match not found
            actualDataPoints = sensorDataArray[0].data;
            // Update unit from API response
            if (sensorDataArray[0].unit && sensorDataArray[0].unit !== actualUnit) {
              setActualUnit(sensorDataArray[0].unit);
            }
          }
        }
      } else if (Array.isArray(currentSensorTableData)) {
        // Handle case where data is directly an array of data points
        actualDataPoints = currentSensorTableData;
      }

      if (actualDataPoints.length === 0) {
        return []; // No actual data points found
      }

      // For server-side data, use paginated results directly
      // Server handles pagination, sorting, and filtering, so no client-side grouping
      if (groupBy === 'none') {
        return actualDataPoints.map((point: any, index: number) => {
          const { date, time } = formatDateTime(point.timestamp);
          const timestamp = new Date(point.timestamp).getTime();
          
          return {
            id: `row-${index}`,
            timestamp: isNaN(timestamp) ? Date.now() : timestamp, // Fallback for invalid timestamps
            date,
            time,
            value: typeof point.value === 'number' ? point.value : 0, // Ensure value is a number
            min: undefined,
            max: undefined,
            avg: undefined,
            count: undefined
          };
        });
      }
      
      // For offline mode with grouping, convert server data to client format for grouping
      const dataSource = actualDataPoints.map((point: any) => ({
        timestamp: new Date(point.timestamp).getTime(),
        value: point.value
      }));
      
      return processGroupedData(dataSource, groupBy);
    }

    // LIVE MODE: Use chart config series data (fallback data source)
    if (!config.series || config.series.length === 0) return [];
    
    if (groupBy === 'none') {
      // No grouping for live data, just format each point
      return config.series.map((point: DataPoint, index: number) => {
        const { date, time } = formatDateTime(point.timestamp);
        return {
          id: `row-${index}`,
          timestamp: point.timestamp,
          date,
          time,
          value: point.value,
          min: undefined,
          max: undefined,
          avg: undefined,
          count: undefined
        };
      });
    }
    
    return processGroupedData(config.series, groupBy);
  }, [isLiveMode, currentSensorTableData, config.series, groupBy, processGroupedData]);

  // Apply search filter
  const filteredData = React.useMemo(() => {
    if (!searchQuery) return processedData;
    
    return processedData.filter((item: any) => 
      item.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.time.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.value.toString().includes(searchQuery)
    );
  }, [processedData, searchQuery]);

  // Apply sorting
  const sortedData = React.useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const first = sortDescriptor.column === 'timestamp' ? a.timestamp : 
                   sortDescriptor.column === 'value' ? a.value :
                   sortDescriptor.column === 'min' ? (a.min || 0) :
                   sortDescriptor.column === 'max' ? (a.max || 0) : 
                   a.timestamp;
                   
      const second = sortDescriptor.column === 'timestamp' ? b.timestamp : 
                    sortDescriptor.column === 'value' ? b.value :
                    sortDescriptor.column === 'min' ? (b.min || 0) :
                    sortDescriptor.column === 'max' ? (b.max || 0) : 
                    b.timestamp;
      
      const cmp = first < second ? -1 : first > second ? 1 : 0;
      
      return sortDescriptor.direction === 'descending' ? -cmp : cmp;
    });
  }, [filteredData, sortDescriptor]);

  // Pagination logic: server-side for offline mode without grouping, client-side otherwise
  const paginatedData = React.useMemo(() => {
    // Server-side pagination: offline mode without grouping
    if (!isLiveMode && groupBy === 'none' && currentSensorTableData) {
      // Server already handled pagination, sorting, and filtering
      return processedData;
    } 
    
    // Client-side pagination: live mode or grouping enabled
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return sortedData.slice(start, end);
  }, [isLiveMode, groupBy, currentSensorTableData, processedData, sortedData, page, rowsPerPage]);

  // Get total count for pagination
  const totalItems = React.useMemo(() => {
    // Server-side total: offline mode without grouping
    if (!isLiveMode && groupBy === 'none' && currentSensorTableData) {
      return currentSensorTableData.pagination.totalRecords;
    }
    
    // Client-side total: live mode or grouping enabled
    return sortedData.length;
  }, [isLiveMode, groupBy, currentSensorTableData, sortedData.length]);

  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  const handleGroupByChange = (key: React.Key) => {
    setGroupBy(key as GroupByOption);
    setPage(1); // Reset to first page when changing grouping - this will trigger new API call if needed
  };

  const handleRowsPerPageChange = (key: React.Key) => {
    setRowsPerPage(Number(key));
    setPage(1); // Reset to first page when changing page size - this will trigger new API call if needed
  };

  // Debounce search query to avoid too many API calls
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1); // Reset to first page when searching - this will trigger new API call if needed
  };

  // Notify parent component about controls state when ready
  React.useEffect(() => {
    if (onControlsReady) {
      onControlsReady({
        searchQuery,
        groupBy,
        rowsPerPage,
        onSearchChange: handleSearchChange,
        onGroupByChange: handleGroupByChange,
        onRowsPerPageChange: handleRowsPerPageChange
      });
    }
  }, [onControlsReady, searchQuery, groupBy, rowsPerPage]);

  const handleSortChange = (column: string) => {
    setSortDescriptor(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'ascending' ? 'descending' : 'ascending'
    }));
    
    // Reset to first page when changing sort - this will trigger useEffect to fetch new data
    setPage(1);
  };

  const handleDownloadCSV = () => {
    if (onDownloadCSV) {
      onDownloadCSV();
    } else {
      // Fallback implementation if no handler provided
      const headers = groupBy === 'none' 
        ? ['Date', 'Time', 'Value']
        : ['Date', 'Time', 'Min', 'Max', 'Average', 'Count'];
      
      const csvContent = [
        headers.join(','),
        ...sortedData.map(item => {
          if (groupBy === 'none') {
            return `"${item.date}","${item.time}",${item.value}`;
          } else {
            return `"${item.date}","${item.time}",${item.min},${item.max},${item.avg},${item.count}`;
          }
        })
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `sensor_data_${new Date().toISOString()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderCell = (item: TableDataItem, columnKey: string) => {
    switch (columnKey) {
      case 'timestamp':
        return (
          <div>
            <div>{item.date}</div>
            {item.time && <div className="text-xs text-default-500">{item.time}</div>}
          </div>
        );
      case 'value':
        return (
          <Badge color="primary" variant="flat">
            {formatNumericValue(item.value, 4)} {actualUnit}
          </Badge>
        );
      case 'min':
        return item.min !== undefined ? (
          <span className="text-danger">{formatNumericValue(item.min, 4)} {actualUnit}</span>
        ) : null;
      case 'max':
        return item.max !== undefined ? (
          <span className="text-success">{formatNumericValue(item.max, 4)} {actualUnit}</span>
        ) : null;
      case 'avg':
        return item.avg !== undefined ? (
          <span>{formatNumericValue(item.avg, 4)} {actualUnit}</span>
        ) : null;
      case 'count':
        return item.count !== undefined ? (
          <Chip size="sm" variant="flat">{item.count}</Chip>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {!hideInternalControls && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2">
            {/* <Input
              placeholder="Search data..."
              value={searchQuery}
              onValueChange={handleSearchChange}
              startContent={<Icon icon="lucide:search" className="text-default-400" />}
              size="sm"
              className="w-48 md:w-64"
              isClearable
            /> */}
            
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="flat"
                  color="primary"
                  size="sm"
                  endContent={<Icon icon="lucide:chevron-down" width={16} />}
                >
                  {groupBy === 'none'
                    ? "No Grouping"
                    : groupBy === 'hourly'
                      ? "Group by Hour"
                      : groupBy === 'daily'
                        ? "Group by Day"
                        : "Group by Week"}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Group By Options"
                onAction={(key) => handleGroupByChange(key as string)}
              >
                <DropdownItem key="none">No Grouping</DropdownItem>
                <DropdownItem key="hourly">Group by Hour</DropdownItem>
                <DropdownItem key="daily">Group by Day</DropdownItem>
                <DropdownItem key="weekly">Group by Week</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>

          <div className="flex items-center gap-2">
            <Dropdown>
              <DropdownTrigger>
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  endContent={<Icon icon="lucide:chevron-down" width={16} />}
                >
                  Rows: {rowsPerPage}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Rows Per Page"
                onAction={handleRowsPerPageChange}
              >
                <DropdownItem key="100">100 rows</DropdownItem>
                <DropdownItem key="200">200 rows</DropdownItem>
                <DropdownItem key="500">500 rows</DropdownItem>
                <DropdownItem key="100">1000 rows</DropdownItem>
              </DropdownMenu>
            </Dropdown>

            {/* <Tooltip content="Download as CSV">
              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={handleDownloadCSV}
                startContent={<Icon icon="lucide:download" width={16} />}
              >
                Export
              </Button>
            </Tooltip> */}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm relative">
        {/* Loading overlay for when refreshing data */}
        {isTableLoading && paginatedData.length > 0 && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center z-10">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-2"></div>
              <p className="text-sm text-primary-600 dark:text-primary-400">Refreshing data...</p>
            </div>
          </div>
        )}
        
        <table className="w-full min-w-full table-auto border-collapse">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-100/20">
              <th 
                className="px-4 py-3 text-left text-sm font-medium text-dark cursor-pointer"
                onClick={() => handleSortChange('timestamp')}
              >
                <div className="flex items-center gap-1">
                  Date/Time
                  {sortDescriptor.column === 'timestamp' && (
                    <Icon 
                      icon={sortDescriptor.direction === 'ascending' ? "lucide:arrow-up" : "lucide:arrow-down"} 
                      width={14} 
                      className="text-primary-500"
                    />
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-medium text-dark cursor-pointer"
                onClick={() => handleSortChange('value')}
              >
                <div className="flex items-center gap-1">
                  Value
                  {sortDescriptor.column === 'value' && (
                    <Icon 
                      icon={sortDescriptor.direction === 'ascending' ? "lucide:arrow-up" : "lucide:arrow-down"} 
                      width={14}
                      className="text-primary-500"
                    />
                  )}
                </div>
              </th>
              {groupBy !== 'none' && (
                <>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium text-primary-700 dark:text-primary-300 cursor-pointer"
                    onClick={() => handleSortChange('min')}
                  >
                    <div className="flex items-center gap-1">
                      Min
                      {sortDescriptor.column === 'min' && (
                        <Icon 
                          icon={sortDescriptor.direction === 'ascending' ? "lucide:arrow-up" : "lucide:arrow-down"} 
                          width={14}
                          className="text-primary-500"
                        />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium text-primary-700 dark:text-primary-300 cursor-pointer"
                    onClick={() => handleSortChange('max')}
                  >
                    <div className="flex items-center gap-1">
                      Max
                      {sortDescriptor.column === 'max' && (
                        <Icon 
                          icon={sortDescriptor.direction === 'ascending' ? "lucide:arrow-up" : "lucide:arrow-down"} 
                          width={14}
                          className="text-primary-500"
                        />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-primary-700 dark:text-primary-300">Count</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((item: any) => (
                <tr 
                  key={item.id} 
                  className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="px-4 py-3 text-sm">{renderCell(item, 'timestamp')}</td>
                  <td className="px-4 py-3 text-sm">{renderCell(item, 'value')}</td>
                  {groupBy !== 'none' && (
                    <>
                      <td className="px-4 py-3 text-sm">{renderCell(item, 'min')}</td>
                      <td className="px-4 py-3 text-sm">{renderCell(item, 'max')}</td>
                      <td className="px-4 py-3 text-sm">{renderCell(item, 'count')}</td>
                    </>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td 
                  colSpan={groupBy === 'none' ? 2 : 5} 
                  className="px-4 py-8 text-center text-default-500"
                >
                  <div className="flex flex-col items-center justify-center">
                    {isTableLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mb-2"></div>
                        <p>Loading table data...</p>
                      </>
                    ) : (
                      <>
                        <Icon icon="lucide:database-x" className="text-default-300 mb-2" width={24} height={24} />
                        <p>No data available</p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center mt-4">
        <Pagination
          isCompact
          showControls
          showShadow
          color="primary"
          page={page}
          total={totalPages}
          onChange={setPage}
        />
      </div>
    </div>
  );
};