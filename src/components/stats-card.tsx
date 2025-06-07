// src/components/stats-card.tsx
import React from "react";
import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

interface StatsCardProps {
  title: string;
  value: string;
  unit?: string;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  subtitle?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  unit,
  icon,
  trend,
  color = 'primary',
  subtitle
}) => {
  const getColorClass = () => {
    switch (color) {
      case 'primary': return 'bg-primary-50 text-primary';
      case 'secondary': return 'bg-secondary-50 text-secondary';
      case 'success': return 'bg-success-50 text-success';
      case 'warning': return 'bg-warning-50 text-warning';
      case 'danger': return 'bg-danger-50 text-danger';
      default: return 'bg-primary-50 text-primary';
    }
  };

  const getCardStyle = () => {
    switch (color) {
      case 'primary':
        return 'bg-primary-50 border-primary-200';
      case 'secondary':
        return 'bg-secondary-50 border-secondary-200';
      case 'success':
        return 'bg-success-50 border-success-200';
      case 'warning':
        return 'bg-warning-50 border-warning-200';
      case 'danger':
        return 'bg-danger-50 border-danger-200';
      default:
        return 'bg-primary-50 border-primary-200';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return 'lucide:trending-up';
      case 'down': return 'lucide:trending-down';
      default: return 'lucide:minus';
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-success';
      case 'down': return 'text-danger';
      default: return 'text-default-500';
    }
  };

  return (
    <Card className={`shadow-sm border hover:shadow-md transition-shadow ${getCardStyle()}`}>
      <CardBody>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-default-500">{title}</p>
            <div className="flex items-baseline mt-1">
              <h3 className="text-2xl font-semibold">{value}</h3>
              {unit && <span className="ml-1 text-default-500">{unit}</span>}
            </div>
            {subtitle && (
              <p className="text-xs text-default-400 mt-1">{subtitle}</p>
            )}
          </div>
          
          <div className={`p-2 rounded-lg ${getColorClass()}`}>
            <Icon icon={icon} width={20} height={20} />
          </div>
        </div>
        
        {trend && (
          <div className={`flex items-center mt-3 text-xs ${getTrendColor()}`}>
            <Icon icon={getTrendIcon()} className="mr-1" width={14} />
            <span>
              {trend === 'up' ? 'Increasing' : trend === 'down' ? 'Decreasing' : 'Stable'}
            </span>
          </div>
        )}
      </CardBody>
    </Card>
  );
};