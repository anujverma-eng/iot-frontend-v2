import {
  Badge,
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Pagination,
  Tooltip
} from '@heroui/react';
import { Icon } from '@iconify/react';
import React from 'react';
import { ChartConfig, DataPoint } from '../../types/sensor';

type GroupByOption = 'none' | 'hourly' | 'daily' | 'weekly';

interface TableViewProps {
  config: ChartConfig;
  onDownloadCSV?: () => void;
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

export const TableView: React.FC<TableViewProps> = ({ config, onDownloadCSV }) => {
  const [page, setPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [groupBy, setGroupBy] = React.useState<GroupByOption>('none');
  const [sortDescriptor, setSortDescriptor] = React.useState({ column: 'timestamp', direction: 'descending' });
  const [searchQuery, setSearchQuery] = React.useState('');

  // Process data for table display
  const processedData = React.useMemo(() => {
    if (!config.series || config.series.length === 0) return [];

    // Function to format date and time
    const formatDateTime = (timestamp: number) => {
      const date = new Date(timestamp);
      return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    };

    // Group data if needed
    if (groupBy === 'none') {
      // No grouping, just format each point
      return config.series.map((point: DataPoint, index) => {
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
    } else {
      // Group data based on selected option
      const groupedData: Record<string, DataPoint[]> = {};
      
      config.series.forEach((point: DataPoint) => {
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
    }
  }, [config.series, groupBy]);

  // Apply search filter
  const filteredData = React.useMemo(() => {
    if (!searchQuery) return processedData;
    
    return processedData.filter(item => 
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

  // Pagination
  const paginatedData = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return sortedData.slice(start, end);
  }, [sortedData, page, rowsPerPage]);

  const handleGroupByChange = (key: string) => {
    setGroupBy(key as GroupByOption);
    setPage(1); // Reset to first page when changing grouping
  };

  const handleSortChange = (column: string) => {
    setSortDescriptor(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'ascending' ? 'descending' : 'ascending'
    }));
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
            {item.value.toFixed(2)} {config.unit}
          </Badge>
        );
      case 'min':
        return item.min !== undefined ? (
          <span className="text-danger">{item.min.toFixed(2)} {config.unit}</span>
        ) : null;
      case 'max':
        return item.max !== undefined ? (
          <span className="text-success">{item.max.toFixed(2)} {config.unit}</span>
        ) : null;
      case 'avg':
        return item.avg !== undefined ? (
          <span>{item.avg.toFixed(2)} {config.unit}</span>
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
      <div className="flex justify-between items-center mb-4 bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search data..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            startContent={<Icon icon="lucide:search" className="text-default-400" />}
            size="sm"
            className="w-48 md:w-64"
            isClearable
          />
          
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
              onAction={(key) => setRowsPerPage(Number(key))}
            >
              <DropdownItem key="5">5 rows</DropdownItem>
              <DropdownItem key="10">10 rows</DropdownItem>
              <DropdownItem key="25">25 rows</DropdownItem>
              <DropdownItem key="50">50 rows</DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Tooltip content="Download as CSV">
            <Button
              size="sm"
              variant="flat"
              color="primary"
              onPress={handleDownloadCSV}
              startContent={<Icon icon="lucide:download" width={16} />}
            >
              Export
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <table className="w-full min-w-full table-auto border-collapse">
          <thead>
            <tr className="bg-primary-50 dark:bg-primary-900/20">
              <th 
                className="px-4 py-3 text-left text-sm font-medium text-primary-700 dark:text-primary-300 cursor-pointer"
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
                className="px-4 py-3 text-left text-sm font-medium text-primary-700 dark:text-primary-300 cursor-pointer"
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
              paginatedData.map((item) => (
                <tr 
                  key={item.id} 
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
                    <Icon icon="lucide:database-x" className="text-default-300 mb-2" width={24} height={24} />
                    <p>No data available</p>
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
          total={Math.ceil(sortedData.length / rowsPerPage)}
          onChange={setPage}
        />
      </div>
    </div>
  );
};