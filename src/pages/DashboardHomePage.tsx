import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { StatsCard } from "../components/stats-card";
import { AppDispatch, RootState } from "../store";
import {
  fetchGatewayStats,
  selectGatewayStats,
} from "../store/gatewaySlice";
import {
  fetchSensorStats,
  fetchSensors,
  selectSensorStats,
  selectSensors,
} from "../store/sensorsSlice";

export const DashboardHomePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const gatewayStats = useSelector(selectGatewayStats);
  const sensorStats = useSelector(selectSensorStats);
  const sensors = useSelector(selectSensors);

  React.useEffect(() => {
    dispatch(fetchGatewayStats());
    dispatch(fetchSensorStats());
    dispatch(
      fetchSensors({ page: 1, limit: 1000, claimed: true, search: "" })
    );
  }, [dispatch]);

  const totalSensors =
    (sensorStats?.claimed ?? 0) + (sensorStats?.unclaimed ?? 0);
  const liveSensors = sensors.filter((s) => s.status === "live").length;

  const alertsLowBattery = 2;
  const alertsOutOfTolerance = 1;

  return (
    <main className="space-y-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 px-4">
        <StatsCard
          title="Gateways"
          value={String(gatewayStats?.totalGateways ?? 0)}
          subtitle={`Live: ${gatewayStats?.liveGateways ?? 0}`}
          icon="lucide:router"
          color="primary"
        />
        <StatsCard
          title="Sensors"
          value={String(totalSensors)}
          subtitle={`Live: ${liveSensors}`}
          icon="lucide:cpu"
          color="secondary"
        />
        <StatsCard
          title="Alerts"
          value={String(alertsLowBattery + alertsOutOfTolerance)}
          subtitle={`Low Battery: ${alertsLowBattery}, Out of Tolerance: ${alertsOutOfTolerance}`}
          icon="lucide:bell"
          color="warning"
        />
      </div>
    </main>
  );
};
