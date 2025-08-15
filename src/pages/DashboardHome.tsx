// src/pages/DashboardHome.tsx
import React from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { formatNumericValue } from "../utils/numberUtils";
import { AppDispatch } from "../store";
import {
  fetchGateways,
  fetchGatewayStats,
  selectGateways,
  selectGatewayStats,
} from "../store/gatewaySlice";
import {
  fetchSensors,
  fetchSensorStats,
  selectSensors,
  selectSensorStats,
  toggleSensorStar,
  addSelectedSensorId,
  selectSelectedSensorIds,
} from "../store/sensorsSlice";
import { Gateway } from "../types/gateway";
import { Sensor } from "../types/sensor";
import { StatsCard } from "../components/stats-card";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  Progress,
} from "@heroui/react";

interface Alert {
  id: string;
  severity: "high" | "medium" | "low";
  message: string;
  timestamp: string;
}

export const DashboardHome: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Get state from Redux
  const gateways = useSelector(selectGateways);
  const sensors = useSelector(selectSensors);
  const gatewayStats = useSelector(selectGatewayStats);
  const sensorStats = useSelector(selectSensorStats);
  const starredSensorIds = useSelector(selectSelectedSensorIds);

  // Local state for alerts and loading
  const [isLoading, setIsLoading] = React.useState(true);
  const [alerts, setAlerts] = React.useState<Alert[]>([]); // We'll need to implement an alerts API/redux slice later

  // Get favorite sensors
  const favoriteSensors = React.useMemo(
    () => sensors.filter((sensor) => sensor.isStarred),
    [sensors]
  );

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          dispatch(fetchGateways({ page: 1, limit: 5, search: "" }) as any),
          dispatch(
            fetchSensors({
              page: 1,
              limit: 5,
              claimed: true,
              search: "",
            }) as any
          ),
          dispatch(fetchGatewayStats() as any),
          dispatch(fetchSensorStats() as any),
        ]);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dispatch]);
  const stats = React.useMemo(
    () => ({
      totalGateways: gatewayStats?.totalGateways || 0,
      activeGateways: gatewayStats?.liveGateways || 0,
      totalSensors: sensorStats?.claimed || 0,
      activeSensors: sensorStats?.liveSensors || 0,
    }),
    [gatewayStats, sensorStats]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Progress
          size="sm"
          isIndeterminate
          aria-label="Loading..."
          className="max-w-md"
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl p-4 space-y-6">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-bold mb-6"
      >
        Dashboard Overview
      </motion.h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Gateways"
          value={stats.totalGateways.toString()}
          icon="lucide:cpu"
          color="primary"
        />
        <StatsCard
          title="Active Gateways"
          value={stats.activeGateways.toString()}
          icon="lucide:activity"
          color="success"
        />
        <StatsCard
          title="Total Sensors"
          value={stats.totalSensors.toString()}
          icon="lucide:radio"
          color="secondary"
        />
        <StatsCard
          title="Active Sensors"
          value={stats.activeSensors.toString()}
          icon="lucide:signal"
          color="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gateways Card */}
        <Card>
          <CardHeader className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Recent Gateways</h2>
            <Button
              as={Link}
              to="/dashboard/gateways"
              color="primary"
              variant="light"
              endContent={<Icon icon="lucide:chevron-right" />}
            >
              View All
            </Button>
          </CardHeader>
          <CardBody>
            <Table removeWrapper aria-label="Recent Gateways">
              <TableHeader>
                <TableColumn>GATEWAY</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>LAST SEEN</TableColumn>
              </TableHeader>
              <TableBody>
                {gateways.slice(0, 5).map((gateway) => (
                  <TableRow key={gateway._id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-bold text-small">
                          {gateway.label || gateway.mac}
                        </span>
                        <span className="text-tiny text-default-400">
                          {gateway.mac}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip
                        className="capitalize"
                        color={gateway.status === "active" ? "success" : "warning"}
                        size="sm"
                        variant="flat"
                      >
                        {gateway.status}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      {gateway.lastSeen
                        ? formatDistanceToNow(new Date(gateway.lastSeen), {
                            addSuffix: true,
                          })
                        : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

        {/* Sensors Card */}
        <Card>
          <CardHeader className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Recent Sensors</h2>
            <Button
              as={Link}
              to="/dashboard/sensors"
              color="primary"
              variant="light"
              endContent={<Icon icon="lucide:chevron-right" />}
            >
              View All
            </Button>
          </CardHeader>
          <CardBody>
            <Table removeWrapper aria-label="Recent Sensors">
              <TableHeader>
                <TableColumn>SENSOR</TableColumn>
                <TableColumn>TYPE</TableColumn>
                <TableColumn>LAST VALUE</TableColumn>
              </TableHeader>
              <TableBody>
                {sensors.slice(0, 5).map((sensor) => (
                  <TableRow key={sensor._id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-bold text-small">
                          {sensor.displayName || sensor.mac}
                        </span>
                        <span className="text-tiny text-default-400">
                          {sensor.mac}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip
                        className="capitalize"
                        color={
                          sensor.type === "temperature" ? "primary" : "secondary"
                        }
                        size="sm"
                        variant="flat"
                      >
                        {sensor.type}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      {formatNumericValue(sensor.lastValue, 4)} {sensor.lastUnit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </div>

      {/* Alerts Section */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Recent Alerts</h2>
        </CardHeader>
        <CardBody>
          {alerts.length > 0 ? (
            <div className="space-y-4">
              {alerts.map((alert, index) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg ${
                    alert.severity === "high"
                      ? "bg-danger-100 text-danger-700"
                      : alert.severity === "medium"
                      ? "bg-warning-100 text-warning-700"
                      : "bg-info-100 text-info-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon
                        icon={
                          alert.severity === "high"
                            ? "lucide:alert-triangle"
                            : alert.severity === "medium"
                            ? "lucide:alert-circle"
                            : "lucide:info"
                        }
                        className="w-5 h-5"
                      />
                      <span className="font-medium">{alert.message}</span>
                    </div>
                    <Tooltip content={new Date(alert.timestamp).toLocaleString()}>
                      <span className="text-sm">
                        {formatDistanceToNow(new Date(alert.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-default-400">No recent alerts</div>
          )}
        </CardBody>
      </Card>

       {/* Favorite Dashboard Section */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Favorite Dashboard</h2>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col items-center justify-center py-12">
            <Icon icon="lucide:layout-dashboard" className="w-16 h-16 text-default-300 mb-4" />
            <p className="text-default-600 mb-4">No favorite dashboard available</p>
            <Button color="primary" startContent={<Icon icon="lucide:plus" />}>
              Add Favorite Dashboard
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Favorite Sensors Section */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Favorite Sensors</h2>
          <Button
            as={Link}
            to="/dashboard/sensors"
            color="primary"
            variant="light"
            endContent={<Icon icon="lucide:chevron-right" />}
          >
            View All
          </Button>
        </CardHeader>
        <CardBody>
          {favoriteSensors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {favoriteSensors.map((sensor) => (
                <Card key={sensor._id} shadow="sm">
                  <CardBody>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{sensor.displayName || sensor.mac}</span>
                      <Chip
                        className="capitalize"
                        color={sensor.type === "temperature" ? "primary" : "secondary"}
                        size="sm"
                        variant="flat"
                      >
                        {sensor.type}
                      </Chip>
                    </div>
                    <div className="text-2xl font-bold mb-2">
                      {formatNumericValue(sensor.lastValue, 4)} {sensor.lastUnit}
                    </div>
                    <div className="text-sm text-default-400">
                      Last updated: {formatDistanceToNow(new Date(sensor.lastSeen), { addSuffix: true })}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-default-400">No favorite sensors added</div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};