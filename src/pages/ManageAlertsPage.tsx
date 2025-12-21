// src/pages/ManageAlertsPage.tsx
import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Tooltip,
  Switch,
  Spinner,
  Pagination,
  useDisclosure,
  addToast,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  CardHeader,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import {
  fetchAlerts,
  deleteAlert,
  toggleAlert,
  selectAlerts,
  selectAlertsLoading,
  selectAlertsPagination,
  selectDeletingAlertId,
  selectTogglingAlertId,
  setAlertsPage,
  fetchAlertHistory,
  selectAlertHistory,
  selectHistoryLoading,
  selectHistoryPagination,
  setHistoryPage,
} from '../store/alertsSlice';
import { fetchGateways } from '../store/gatewaySlice';
import { fetchSensors } from '../store/sensorsSlice';
import { selectActiveOrgReady } from '../store/activeOrgSlice';
import { AddAlertModal } from '../components/alerts/AddAlertModal';
import { DeleteGatewayConfirmationModal } from '../components/DeleteGatewayConfirmationModal';
import { Alert, AlertType, AlertHistory } from '../types/alert';

export const ManageAlertsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const alerts = useAppSelector(selectAlerts);
  const loading = useAppSelector(selectAlertsLoading);
  const pagination = useAppSelector(selectAlertsPagination);
  const deletingId = useAppSelector(selectDeletingAlertId);
  const togglingId = useAppSelector(selectTogglingAlertId);
  const activeOrgReady = useAppSelector(selectActiveOrgReady);
  
  // Notifications state
  const history = useAppSelector(selectAlertHistory);
  const historyLoading = useAppSelector(selectHistoryLoading);
  const historyPagination = useAppSelector(selectHistoryPagination);

  const { isOpen: isAddModalOpen, onOpen: onAddModalOpen, onClose: onAddModalClose } = useDisclosure();
  const { isOpen: isDeleteModalOpen, onOpen: onDeleteModalOpen, onClose: onDeleteModalClose } = useDisclosure();
  const { isOpen: isNotificationsModalOpen, onOpen: onNotificationsModalOpen, onClose: onNotificationsModalClose } = useDisclosure();

  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [deletingAlert, setDeletingAlert] = useState<Alert | null>(null);

  useEffect(() => {
    if (activeOrgReady) {
      loadAlerts();
      loadNotifications();
      // Load gateways and sensors for the modal
      dispatch(fetchGateways({ page: 1, limit: 1000, search: '' }));
      dispatch(fetchSensors({ page: 1, limit: 1000, claimed: true, search: '' }));
    }
  }, [activeOrgReady, pagination.page, dispatch]);

  const loadAlerts = () => {
    dispatch(fetchAlerts({ page: pagination.page, limit: pagination.limit }));
  };
  
  const loadNotifications = () => {
    dispatch(fetchAlertHistory({ page: 1, limit: 10 }));
  };
  
  const loadAllNotifications = () => {
    dispatch(fetchAlertHistory({ page: historyPagination.page, limit: historyPagination.limit }));
  };
  
  const handleNotificationPageChange = (page: number) => {
    dispatch(setHistoryPage(page));
    loadAllNotifications();
  };

  const handleAddAlert = () => {
    setEditingAlert(null);
    onAddModalOpen();
  };

  const handleEditAlert = (alert: Alert) => {
    setEditingAlert(alert);
    onAddModalOpen();
  };

  const handleDeleteClick = (alert: Alert) => {
    setDeletingAlert(alert);
    onDeleteModalOpen();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAlert) return;

    try {
      await dispatch(deleteAlert(deletingAlert._id)).unwrap();
      addToast({
        title: 'Alert Deleted',
        description: 'Alert rule has been deleted successfully',
        color: 'success',
      });
      onDeleteModalClose();
      setDeletingAlert(null);
      loadAlerts();
    } catch (error: any) {
      addToast({
        title: 'Delete Failed',
        description: error || 'Failed to delete alert rule',
        color: 'danger',
      });
    }
  };

  const handleToggle = async (alert: Alert) => {
    try {
      await dispatch(toggleAlert({ id: alert._id, enabled: !alert.enabled })).unwrap();
      addToast({
        title: alert.enabled ? 'Alert Disabled' : 'Alert Enabled',
        description: `Alert has been ${alert.enabled ? 'disabled' : 'enabled'} successfully`,
        color: 'success',
      });
    } catch (error: any) {
      addToast({
        title: 'Toggle Failed',
        description: error || 'Failed to toggle alert',
        color: 'danger',
      });
    }
  };

  const handlePageChange = (page: number) => {
    dispatch(setAlertsPage(page));
  };

  const getEventTypeLabel = (type: AlertType): string => {
    const labels: Record<AlertType, string> = {
      'DEVICE_ONLINE': 'Device Online',
      'DEVICE_OFFLINE': 'Device Offline',
      'LOW_BATTERY': 'Low Battery',
      'DEVICE_OUT_OF_TOLERANCE': 'Out Of Tolerance',
    };
    return labels[type];
  };

  const getEventTypeColor = (type: AlertType) => {
    const colors: Record<AlertType, any> = {
      'DEVICE_ONLINE': 'success',
      'DEVICE_OFFLINE': 'danger',
      'LOW_BATTERY': 'warning',
      'DEVICE_OUT_OF_TOLERANCE': 'secondary',
    };
    return colors[type];
  };

  const getActionLabel = (alert: Alert): string => {
    const hasEmail = alert.channels.email?.enabled;
    const hasSms = alert.channels.sms?.enabled;

    if (hasEmail && hasSms) return 'Email & SMS';
    if (hasEmail) return 'Email';
    if (hasSms) return 'SMS';
    return 'None';
  };

  const getRecipients = (alert: Alert): string => {
    const recipients: string[] = [];
    
    if (alert.channels.email?.addresses) {
      recipients.push(...alert.channels.email.addresses);
    }
    
    if (alert.channels.sms?.phoneNumbers) {
      recipients.push(...alert.channels.sms.phoneNumbers);
    }
    
    return recipients.join(', ');
  };

  const getDeviceName = (alert: Alert): string => {
    // Show displayName if available, otherwise show deviceId
    if (alert.displayName) {
      return alert.displayName;
    }
    return alert.deviceId || 'N/A';
  };
  
  // Notification helper functions
  const getNotificationStats = () => {
    const stats = {
      new: 0,
      lowBattery: 0,
      outOfTolerance: 0,
      deviceOffline: 0,
    };
    
    history.forEach((item: any) => {
      if (!item.acknowledged) stats.new++;
      if (item.alertType === 'LOW_BATTERY') stats.lowBattery++;
      if (item.alertType === 'DEVICE_OUT_OF_TOLERANCE') stats.outOfTolerance++;
      if (item.alertType === 'DEVICE_OFFLINE') stats.deviceOffline++;
    });
    
    return stats;
  };
  
  const formatNotificationTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
      return `${Math.floor(diffInMinutes / 1440)} days ago`;
    } catch {
      return dateString;
    }
  };
  
  const getNotificationSourceName = (item: AlertHistory): string => {
    return item.displayName || item.deviceId || 'Unknown Device';
  };
  
  const getRuleName = (item: AlertHistory): string => {
    if (typeof item.ruleId === 'object' && item.ruleId !== null) {
      return item.ruleId.name;
    }
    return 'Unknown Rule';
  };
  
  const getNotificationActionLabel = (item: AlertHistory): string => {
    const channels = item.notifications.map(n => n.channel);
    const uniqueChannels = Array.from(new Set(channels));
    
    if (uniqueChannels.length === 2) return 'Email & SMS';
    if (uniqueChannels.includes('email')) return 'Email';
    if (uniqueChannels.includes('sms')) return 'SMS';
    return 'None';
  };
  
  const stats = getNotificationStats();

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
      {/* Notifications Section */}
      <div>
        <h1 className="text-3xl font-bold text-default-900 mb-6">Notifications</h1>
        
        {/* Stats Cards */}
        {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
            <CardBody className="p-4">
              <p className="text-sm text-default-600 mb-1">New Notifications</p>
              <p className="text-3xl font-bold text-primary">{stats.new}</p>
            </CardBody>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100">
            <CardBody className="p-4">
              <p className="text-sm text-default-600 mb-1">Low Battery</p>
              <p className="text-3xl font-bold text-warning">{stats.lowBattery}</p>
            </CardBody>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
            <CardBody className="p-4">
              <p className="text-sm text-default-600 mb-1">Reading Out of Tolerance</p>
              <p className="text-3xl font-bold text-secondary">{stats.outOfTolerance}</p>
            </CardBody>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-50 to-red-100">
            <CardBody className="p-4">
              <p className="text-sm text-default-600 mb-1">Device Offline</p>
              <p className="text-3xl font-bold text-danger">{stats.deviceOffline}</p>
            </CardBody>
          </Card>
        </div> */}
        
        {/* Recent Notifications */}
        <Card>
          <CardHeader className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-default-900">Recent Notifications</h2>
            <Button
              size="sm"
              variant="light"
              color="primary"
              onPress={() => {
                loadAllNotifications();
                onNotificationsModalOpen();
              }}
            >
              View all
            </Button>
          </CardHeader>
          <CardBody>
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-default-400">
                <Icon icon="lucide:bell-off" className="w-12 h-12 mx-auto mb-2" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {history.slice(0, 4).map((item: any) => (
                  <div key={item._id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-default-100 transition-colors">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon 
                          icon={item.alertType === 'DEVICE_ONLINE' || item.alertType === 'DEVICE_OFFLINE' ? 'lucide:router' : 'lucide:cpu'} 
                          className="w-5 h-5 text-primary" 
                        />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-default-900 text-sm">
                          {getEventTypeLabel(item.alertType)}: {getNotificationSourceName(item)}
                        </p>
                        {!item.acknowledged && (
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-default-500">{formatNotificationTime(item.triggerTime)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Manage Alerts Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-default-900">Manage Alerts</h2>
          <p className="text-default-600 mt-1">Configure alert rules for your devices</p>
        </div>
        <Button
          color="primary"
          startContent={<Icon icon="lucide:plus" className="w-5 h-5" />}
          onPress={handleAddAlert}
        >
          Add Alert
        </Button>
      </div>

      {/* Alerts Table */}
      <Card>
        <CardBody className="px-2">
          <div className="max-h-[calc(100vh-300px)] overflow-auto relative">
            {loading && (
              <div className="absolute inset-0 bg-default-100/50 backdrop-blur-sm z-20 flex items-center justify-center">
                <Spinner size="lg" />
              </div>
            )}
            <Table 
              aria-label="Alerts table"
              removeWrapper
              classNames={{
                th: "sticky top-0 z-10 bg-default-100",
              }}
            >
            <TableHeader>
              <TableColumn>EVENT</TableColumn>
              <TableColumn>DEVICE</TableColumn>
              <TableColumn>ACTION</TableColumn>
              <TableColumn>RECIPIENT(S)</TableColumn>
              <TableColumn>ON/OFF</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
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
                    <p className="text-default-400">No alerts configured yet</p>
                    <Button
                      color="primary"
                      variant="flat"
                      size="sm"
                      className="mt-4"
                      onPress={handleAddAlert}
                    >
                      Create Your First Alert
                    </Button>
                  </div>
                )
              }
            >
              {alerts.map((alert: Alert) => (
                <TableRow key={alert._id}>
                  <TableCell>
                    <Chip color={getEventTypeColor(alert.alertType)} variant="flat" size="sm">
                      {getEventTypeLabel(alert.alertType)}
                    </Chip>
                    <p className="text-sm text-default-600 mt-1">{alert.name}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      {alert.displayName && (
                        <p className="text-sm font-medium text-default-900">{alert.displayName}</p>
                      )}
                      <p className="text-xs text-default-600">{alert.deviceId}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{getActionLabel(alert)}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {alert.channels.email?.addresses?.map((email, idx) => (
                        <p key={`email-${idx}`} className="text-sm text-default-700">{email}</p>
                      ))}
                      {alert.channels.sms?.phoneNumbers?.map((phone, idx) => (
                        <p key={`phone-${idx}`} className="text-sm text-default-700">{phone}</p>
                      ))}
                      {!alert.channels.email?.addresses?.length && !alert.channels.sms?.phoneNumbers?.length && (
                        <p className="text-sm text-default-400">None</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      isSelected={alert.enabled}
                      onValueChange={() => handleToggle(alert)}
                      isDisabled={togglingId === alert._id}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Tooltip content="Edit">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => handleEditAlert(alert)}
                        >
                          <Icon icon="lucide:edit" className="w-4 h-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Delete" color="danger">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          onPress={() => handleDeleteClick(alert)}
                          isLoading={deletingId === alert._id}
                        >
                          <Icon icon="lucide:trash-2" className="w-4 h-4" />
                        </Button>
                      </Tooltip>
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
                Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} alerts
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

      {/* Add/Edit Modal */}
      <AddAlertModal
        isOpen={isAddModalOpen}
        onClose={() => {
          onAddModalClose();
          setEditingAlert(null);
        }}
        onSuccess={loadAlerts}
        editingAlert={editingAlert}
      />

      {/* Delete Confirmation Modal */}
      {deletingAlert && (
        <DeleteGatewayConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            onDeleteModalClose();
            setDeletingAlert(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="Delete Alert"
          message={`"${deletingAlert.name}"`}
          confirmText="Delete"
          cancelText="Cancel"
          confirmColor="danger"
          isLoading={deletingId === deletingAlert._id}
        />
      )}
      
      {/* All Notifications Modal */}
      <Modal
        isOpen={isNotificationsModalOpen}
        onClose={onNotificationsModalClose}
        size="5xl"
        scrollBehavior="inside"
      >
        <ModalContent className="">
          {(onClose) => (
            <>
              <ModalHeader>
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:bell-ring" className="w-6 h-6 text-primary" />
                  <span>All Notifications</span>
                </div>
              </ModalHeader>
              <ModalBody className="overflow-y-auto max-h-[calc(90vh-180px)]">
                <div className="max-h-[calc(80vh-180px)] overflow-auto relative">
                  {historyLoading && (
                    <div className="absolute inset-0 bg-default-100/50 backdrop-blur-sm z-20 flex items-center justify-center">
                      <Spinner size="lg" />
                    </div>
                  )}
                  <Table
                    aria-label="All notifications table"
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
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Icon icon="lucide:bell-off" className="w-12 h-12 text-default-400 mb-2" />
                          <p className="text-default-400">No notifications yet</p>
                        </div>
                      }
                    >
                      {history.map((item: AlertHistory) => (
                        <TableRow key={item._id}>
                          <TableCell>
                            <p className="text-sm">{format(new Date(item.triggerTime), 'MMM dd, yyyy HH:mm:ss')}</p>
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
                                  item.alertType === 'DEVICE_ONLINE' || item.alertType === 'DEVICE_OFFLINE'
                                    ? 'lucide:router'
                                    : 'lucide:cpu'
                                }
                                className="w-4 h-4 text-default-400"
                              />
                              <p className="text-sm">{getNotificationSourceName(item)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip color="secondary" variant="flat" size="sm">
                              {getNotificationActionLabel(item)}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 max-w-[300px]">
                              {item.notifications.map((notification: any, index: number) => (
                                <div key={index} className="flex items-center gap-2">
                                  <Icon
                                    icon={notification.channel === 'email' ? 'lucide:mail' : 'lucide:phone'}
                                    className={`w-3 h-3 ${notification.success ? 'text-success' : 'text-danger'}`}
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

                {historyPagination.total > 0 && (
                  <div className="flex justify-between items-center p-4 border-t border-default-200">
                    <p className="text-sm text-default-500">
                      Showing {Math.min((historyPagination.page - 1) * historyPagination.limit + 1, historyPagination.total)} to {Math.min(historyPagination.page * historyPagination.limit, historyPagination.total)} of {historyPagination.total} notifications
                    </p>
                    <Pagination
                      total={Math.max(1, historyPagination.totalPages)}
                      page={historyPagination.page}
                      onChange={handleNotificationPageChange}
                      showControls
                      size="sm"
                    />
                  </div>
                )}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </motion.div>
  );
};
