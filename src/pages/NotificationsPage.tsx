// src/pages/NotificationsPage.tsx
import React, { useEffect } from "react";
import {
  Card,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Spinner,
  Pagination,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { useAppDispatch, useAppSelector } from "../hooks/useAppDispatch";
import {
  fetchAlertHistory,
  selectAlertHistory,
  selectHistoryLoading,
  selectHistoryPagination,
  setHistoryPage,
} from "../store/alertsSlice";
import { selectActiveOrgReady } from "../store/activeOrgSlice";
import { AlertType, AlertHistory } from "../types/alert";
import { useBreakpoints } from "../hooks/use-media-query";

export const NotificationsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const history = useAppSelector(selectAlertHistory);
  const loading = useAppSelector(selectHistoryLoading);
  const pagination = useAppSelector(selectHistoryPagination);
  const activeOrgReady = useAppSelector(selectActiveOrgReady);

  useEffect(() => {
    if (activeOrgReady) {
      loadHistory();
    }
  }, [activeOrgReady, pagination.page, dispatch]);

  const loadHistory = () => {
    dispatch(fetchAlertHistory({ page: pagination.page, limit: pagination.limit }));
  };

  const {
    isMobile,
    isSmallScreen,
    isLandscape,
    isShortHeight,
    isVeryShortHeight,
    isIPhone14Pro,
    isIPhoneLandscape,
    isPixelLandscape,
  } = useBreakpoints();

  const handlePageChange = (page: number) => {
    dispatch(setHistoryPage(page));
  };

  const getEventTypeLabel = (type: AlertType): string => {
    const labels: Record<AlertType, string> = {
      DEVICE_ONLINE: "Device Online",
      DEVICE_OFFLINE: "Device Offline",
      LOW_BATTERY: "Low Battery",
      DEVICE_OUT_OF_TOLERANCE: "Out Of Tolerance",
    };
    return labels[type];
  };

  const getEventTypeColor = (type: AlertType) => {
    const colors: Record<AlertType, any> = {
      DEVICE_ONLINE: "success",
      DEVICE_OFFLINE: "danger",
      LOW_BATTERY: "warning",
      DEVICE_OUT_OF_TOLERANCE: "secondary",
    };
    return colors[type];
  };

  const getSourceName = (item: AlertHistory): string => {
    if (item.displayName) {
      return item.displayName;
    }
    if (item.deviceId) {
      return item.deviceId;
    }
    return "N/A";
  };

  const getActionLabel = (item: AlertHistory): string => {
    const channels = item.notifications.map((n) => n.channel);
    const uniqueChannels = Array.from(new Set(channels));

    if (uniqueChannels.length === 2) return "Email & SMS";
    if (uniqueChannels.includes("email")) return "Email";
    if (uniqueChannels.includes("sms")) return "SMS";
    return "None";
  };

  const getRecipients = (item: AlertHistory): string => {
    const recipients = item.notifications.map((n) => n.recipient);
    return recipients.join(", ");
  };

  const formatTime = (dateString: string): string => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy HH:mm:ss");
    } catch (error) {
      return dateString;
    }
  };

  const getRuleName = (item: AlertHistory): string => {
    if (typeof item.ruleId === "object" && item.ruleId !== null) {
      return item.ruleId.name;
    }
    return "Unknown Rule";
  };

  if (!activeOrgReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="container mx-auto p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-2xl sm:text-3xl font-bold ${
              isMobile
                ? "mb-3 px-1" // Mobile: reduced margin and padding
                : "mb-4 sm:mb-6 px-2 sm:px-0" // Desktop: normal spacing
            }`}
          >
            Notifications
          </motion.h1>
          <p className="text-default-600 mt-1">View all triggered alerts and notifications</p>
        </div>
        <div className="flex items-center gap-2">
          <Chip color="primary" variant="flat">
            {pagination.total} Total
          </Chip>
        </div>
      </div>

      {/* Notifications Table */}
      <Card>
        <CardBody className="p-0">
          <div className="max-h-[calc(100vh-300px)] overflow-auto relative">
            {loading && (
              <div className="absolute inset-0 bg-default-100/50 backdrop-blur-sm z-20 flex items-center justify-center">
                <Spinner size="lg" />
              </div>
            )}
            <Table
              aria-label="Notifications table"
              removeWrapper
              classNames={{
                th: "sticky top-0 z-10 bg-default-100",
              }}
            >
              <TableHeader>
                <TableColumn>TIME</TableColumn>
                <TableColumn>EVENT TYPE</TableColumn>
                <TableColumn>ALERT RULE</TableColumn>
                <TableColumn>SOURCE</TableColumn>
                <TableColumn>ACTION</TableColumn>
                <TableColumn>RECIPIENT(S)</TableColumn>
              </TableHeader>
              <TableBody
                emptyContent={
                  loading ? (
                    <div className="flex justify-center py-8">
                      <Spinner />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Icon icon="lucide:bell-off" className="w-12 h-12 text-default-400 mb-2" />
                      <p className="text-default-400">No notifications found</p>
                      <p className="text-sm text-default-400 mt-1">
                        Notifications will appear here when alerts are triggered
                      </p>
                    </div>
                  )
                }
              >
                {history.map((item: AlertHistory) => (
                  <TableRow key={item._id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <p className="text-sm font-medium">{formatTime(item.triggerTime)}</p>
                        <p className="text-xs text-default-500">{format(new Date(item.triggerTime), "EEEE")}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip color={getEventTypeColor(item.alertType)} variant="flat" size="sm">
                        {getEventTypeLabel(item.alertType)}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{getRuleName(item)}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon
                          icon={
                            item.alertType === "DEVICE_ONLINE" || item.alertType === "DEVICE_OFFLINE"
                              ? "lucide:router"
                              : "lucide:cpu"
                          }
                          className="w-4 h-4 text-default-400"
                        />
                        <p className="text-sm">{getSourceName(item)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip color="secondary" variant="flat" size="sm">
                        {getActionLabel(item)}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 max-w-[300px]">
                        {item.notifications.map((notification: any, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <Icon
                              icon={notification.channel === "email" ? "lucide:mail" : "lucide:phone"}
                              className={`w-3 h-3 ${notification.success ? "text-success" : "text-danger"}`}
                            />
                            <p className="text-xs truncate">{notification.recipient}</p>
                            {!notification.success && (
                              <Chip color="danger" size="sm" variant="flat">
                                Failed
                              </Chip>
                            )}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pagination.total > 0 && (
            <div className="flex justify-between items-center p-4 border-t border-default-200">
              <p className="text-sm text-default-500">
                Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} notifications
              </p>
              <Pagination
                total={Math.max(1, pagination.totalPages)}
                page={pagination.page}
                onChange={handlePageChange}
                showControls
                size="sm"
              />
            </div>
          )}
        </CardBody>
      </Card>
    </motion.div>
  );
};
