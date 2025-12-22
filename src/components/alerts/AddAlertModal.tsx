// src/components/alerts/AddAlertModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  addToast,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { EmailInput } from '../email-input';
import { PhoneInput } from '../phone-input';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { createAlert, updateAlert, selectCreatingAlert, selectUpdatingAlertId } from '../../store/alertsSlice';
import { selectGateways } from '../../store/gatewaySlice';
import { selectSensors } from '../../store/sensorsSlice';
import { Alert, AlertType, ConditionOperator, CreateAlertRequest, UpdateAlertRequest } from '../../types/alert';

interface AddAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingAlert?: Alert | null;
}

const THROTTLE_OPTIONS = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
  { value: 360, label: '6 hours' },
  { value: 720, label: '12 hours' },
  { value: 1440, label: '1 day' },
  { value: 2880, label: '2 days' },
  { value: 10080, label: '7 days' },
  { value: 20160, label: '14 days' },
  { value: 43200, label: '30 days' },
];

const EVENT_TYPES: { value: AlertType; label: string }[] = [
  { value: 'DEVICE_ONLINE', label: 'Device Online' },
  { value: 'DEVICE_OFFLINE', label: 'Device Offline' },
  { value: 'LOW_BATTERY', label: 'Low Battery' },
  { value: 'DEVICE_OUT_OF_TOLERANCE', label: 'Device Out Of Tolerance' },
];

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'gt', label: 'Greater than' },
  { value: 'lt', label: 'Less than' },
  // { value: 'gte', label: 'Greater than or equal to' },
  // { value: 'lte', label: 'Less than or equal to' },
  // { value: 'eq', label: 'Equal to' },
  { value: 'between', label: 'Between' },
];

export const AddAlertModal: React.FC<AddAlertModalProps> = ({ isOpen, onClose, onSuccess, editingAlert }) => {
  const dispatch = useAppDispatch();
  const creatingAlert = useAppSelector(selectCreatingAlert);
  const updatingAlertId = useAppSelector(selectUpdatingAlertId);
  const gateways = useAppSelector(selectGateways);
  const sensors = useAppSelector(selectSensors);
  const profile = useAppSelector((state: any) => state.profile);

  const [alertName, setAlertName] = useState('');
  const [eventType, setEventType] = useState<AlertType>('DEVICE_ONLINE');
  const [selectedDevice, setSelectedDevice] = useState('');
  
  // Tolerance range fields
  const [operator, setOperator] = useState<ConditionOperator>('gt');
  const [value1, setValue1] = useState('');
  const [value2, setValue2] = useState('');
  
  // Recipients
  const [emails, setEmails] = useState<string[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([]);
  
  // Throttle
  const [throttleMinutes, setThrottleMinutes] = useState('10');
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Helper function to validate phone number
  const isValidUSPhone = (phone: string): boolean => {
    const digits = phone.replace(/\D/g, '');
    if (!phone.startsWith('+1')) return false;
    if (digits.length !== 11 || !digits.startsWith('1')) return false;
    
    const areaCode = digits.substring(1, 4);
    const centralOffice = digits.substring(4, 7);
    
    if (areaCode[0] < '2' || areaCode[0] > '9') return false;
    if (centralOffice[0] < '2' || centralOffice[0] > '9') return false;
    
    return /^\d{3}$/.test(areaCode) && /^\d{3}$/.test(centralOffice);
  };

  // Reset form when modal opens/closes or editing alert changes
  useEffect(() => {
    if (isOpen && editingAlert) {
      // Populate form with existing alert data
      setAlertName(editingAlert.name);
      setEventType(editingAlert.alertType);
      setSelectedDevice(editingAlert.deviceId || '');
      
      if (editingAlert.condition) {
        setOperator(editingAlert.condition.operator);
        setValue1(editingAlert.condition.value.toString());
        if (editingAlert.condition.value2) {
          setValue2(editingAlert.condition.value2.toString());
        }
      }
      
      setEmails(editingAlert.channels.email?.addresses || []);
      setPhoneNumbers(editingAlert.channels.sms?.phoneNumbers || []);
      setThrottleMinutes(editingAlert.throttleMinutes.toString());
    } else if (isOpen && !editingAlert) {
      // Reset form for new alert and prefill user email and phone
      resetForm();
      prefillUserContact();
    }
  }, [isOpen, editingAlert, profile.data]);

  const prefillUserContact = () => {
    const user = profile.data?.user;
    if (!user) return;
    
    // Prefill email if available
    if (user.email) {
      setEmails([user.email]);
    }
    
    // Prefill phone if available and valid
    if (user.phoneNumber) {
      const fullPhone = `${user?.countryCode || '+1'}${user.phoneNumber}`;
      // Only add if it's a valid US phone number
      console.log('Prefilling phone number:', fullPhone);
      if (isValidUSPhone(fullPhone)) {
        setPhoneNumbers([fullPhone]);
      }
    }
  };

  const resetForm = () => {
    setAlertName('');
    setEventType('DEVICE_ONLINE');
    setSelectedDevice('');
    setOperator('gt');
    setValue1('');
    setValue2('');
    setEmails([]);
    setPhoneNumbers([]);
    setThrottleMinutes('10');
    setErrors({});
  };

  const isGatewayBased = eventType === 'DEVICE_ONLINE' || eventType === 'DEVICE_OFFLINE';
  const isSensorBased = eventType === 'LOW_BATTERY' || eventType === 'DEVICE_OUT_OF_TOLERANCE';
  const showToleranceRange = eventType === 'DEVICE_OUT_OF_TOLERANCE';

  const sourceList = isGatewayBased 
    ? gateways.map(g => ({ id: g._id, label: g.label || g.mac, mac: g.mac }))
    : sensors.map(s => ({ id: s._id, label: s.displayName || s.mac, mac: s.mac }));

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!alertName.trim()) {
      newErrors.alertName = 'Alert name is required';
    }

    if (!selectedDevice) {
      newErrors.source = isGatewayBased ? 'Please select a gateway' : 'Please select a sensor';
    }

    if (showToleranceRange) {
      if (!value1 || isNaN(Number(value1))) {
        newErrors.value1 = 'Please enter a valid number';
      }
      if (operator === 'between' && (!value2 || isNaN(Number(value2)))) {
        newErrors.value2 = 'Please enter a valid number';
      }
      if (operator === 'between' && Number(value1) >= Number(value2)) {
        newErrors.value2 = 'Second value must be greater than first value';
      }
    }

    if (eventType === 'LOW_BATTERY' && (!value1 || isNaN(Number(value1)))) {
      newErrors.value1 = 'Please enter a valid battery threshold';
    }

    if (emails.length === 0 && phoneNumbers.length === 0) {
      newErrors.recipients = 'At least one email or phone number is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      addToast({
        title: 'Validation Error',
        description: 'Please fix the errors before submitting',
        color: 'danger',
      });
      return;
    }

    const channels: any = {};
    
    if (emails.length > 0) {
      channels.email = {
        enabled: true,
        addresses: emails,
      };
    }
    
    if (phoneNumbers.length > 0) {
      channels.sms = {
        enabled: true,
        phoneNumbers: phoneNumbers,
      };
    }

    const baseData: any = {
      name: alertName,
      channels,
      throttleMinutes: parseInt(throttleMinutes),
      enabled: true,
    };

    if (editingAlert) {
      // Update existing alert
      const updateData: UpdateAlertRequest = {
        ...baseData,
        deviceId: selectedDevice,
      };

      if (showToleranceRange || eventType === 'LOW_BATTERY') {
        updateData.condition = {
          operator,
          value: parseFloat(value1),
          ...(operator === 'between' && { value2: parseFloat(value2) }),
        };
      }

      try {
        await dispatch(updateAlert({ id: editingAlert._id, data: updateData })).unwrap();
        addToast({
          title: 'Alert Updated',
          description: 'Alert rule has been updated successfully',
          color: 'success',
        });
        onSuccess?.();
        onClose();
      } catch (error: any) {
        addToast({
          title: 'Update Failed',
          description: error || 'Failed to update alert rule',
          color: 'danger',
        });
      }
    } else {
      // Create new alert
      const createData: CreateAlertRequest = {
        ...baseData,
        alertType: eventType,
        deviceId: selectedDevice,
      };

      if (showToleranceRange || eventType === 'LOW_BATTERY') {
        createData.condition = {
          operator,
          value: parseFloat(value1),
          ...(operator === 'between' && { value2: parseFloat(value2) }),
        };
      }

      try {
        await dispatch(createAlert(createData)).unwrap();
        addToast({
          title: 'Alert Created',
          description: 'Alert rule has been created successfully',
          color: 'success',
        });
        onSuccess?.();
        onClose();
        resetForm();
      } catch (error: any) {
        addToast({
          title: 'Creation Failed',
          description: error || 'Failed to create alert rule',
          color: 'danger',
        });
      }
    }
  };

  const handleAddEmail = (email: string): boolean => {
    if (emails.length >= 3) {
      return false;
    }
    setEmails([...emails, email]);
    return true;
  };

  const handleRemoveEmail = (email: string) => {
    setEmails(emails.filter(e => e !== email));
  };

  const handleAddPhone = (phone: string): boolean => {
    if (phoneNumbers.length >= 5) {
      return false;
    }
    setPhoneNumbers([...phoneNumbers, phone]);
    return true;
  };

  const handleRemovePhone = (phone: string) => {
    setPhoneNumbers(phoneNumbers.filter(p => p !== phone));
  };

  const isLoading = creatingAlert || updatingAlertId === editingAlert?._id;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="3xl" 
      scrollBehavior="inside"
      isDismissable={!isLoading}
      hideCloseButton={isLoading}
    >
      <ModalContent className="max-h-[90vh]">
        {(onModalClose) => (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <Icon icon="lucide:bell" className="w-6 h-6 text-primary" />
                <span>{editingAlert ? 'Edit Alert' : 'Add Alert'}</span>
              </div>
            </ModalHeader>
            <ModalBody className="overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="space-y-4">
                {/* Alert Name */}
                <Input
                  label="Alert Name"
                  placeholder="Enter alert name"
                  value={alertName}
                  onValueChange={setAlertName}
                  variant="bordered"
                  isInvalid={!!errors.alertName}
                  errorMessage={errors.alertName}
                  isRequired
                />

                {/* Event Type */}
                <Select
                  label="Event Type"
                  placeholder="Select event type"
                  selectedKeys={[eventType]}
                  onChange={(e) => {
                    setEventType(e.target.value as AlertType);
                    setSelectedDevice('');
                    setErrors({});
                  }}
                  variant="bordered"
                  isRequired
                  isDisabled={!!editingAlert} // Can't change event type when editing
                >
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </Select>

                {/* Source Selection */}
                {isGatewayBased && (
                  <Select
                    label="Gateway"
                    placeholder="Select a gateway"
                    selectedKeys={selectedDevice ? [selectedDevice] : []}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    variant="bordered"
                    isInvalid={!!errors.source}
                    errorMessage={errors.source}
                    isRequired
                    scrollShadowProps={{
                      isEnabled: sourceList.length > 4
                    }}
                    className="max-h-[200px]"
                  >
                    {sourceList.map((item) => (
                      <SelectItem key={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </Select>
                )}

                {isSensorBased && (
                  <Select
                    label="Sensor"
                    placeholder="Select a sensor"
                    selectedKeys={selectedDevice ? [selectedDevice] : []}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    variant="bordered"
                    isInvalid={!!errors.source}
                    errorMessage={errors.source}
                    isRequired
                    scrollShadowProps={{
                      isEnabled: sourceList.length > 4
                    }}
                    className="max-h-[200px]"
                  >
                    {sourceList.map((item) => (
                      <SelectItem key={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </Select>
                )}

                {/* Tolerance Range (for DEVICE_OUT_OF_TOLERANCE only) */}
                {showToleranceRange && (
                  <div className="space-y-3 p-4 border rounded-lg border-default-200">
                    <p className="text-sm font-medium text-default-700">Tolerance Range</p>
                    
                    <Select
                      label="Condition"
                      selectedKeys={[operator]}
                      onChange={(e) => {
                        setOperator(e.target.value as ConditionOperator);
                        setValue2('');
                      }}
                      variant="bordered"
                      isRequired
                    >
                      {OPERATORS.map((op) => (
                        <SelectItem key={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </Select>

                    <div className="flex gap-2">
                      <Input
                        label="Value"
                        type="number"
                        placeholder="Enter value"
                        value={value1}
                        onValueChange={setValue1}
                        variant="bordered"
                        isInvalid={!!errors.value1}
                        errorMessage={errors.value1}
                        isRequired
                      />

                      {operator === 'between' && (
                        <Input
                          label="Second Value"
                          type="number"
                          placeholder="Enter second value"
                          value={value2}
                          onValueChange={setValue2}
                          variant="bordered"
                          isInvalid={!!errors.value2}
                          errorMessage={errors.value2}
                          isRequired
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Battery Threshold (for LOW_BATTERY only) */}
                {eventType === 'LOW_BATTERY' && (
                  <Input
                    label="Battery Threshold (%)"
                    type="number"
                    placeholder="Enter battery threshold"
                    value={value1}
                    onValueChange={setValue1}
                    variant="bordered"
                    isInvalid={!!errors.value1}
                    errorMessage={errors.value1}
                    description="Alert will trigger when battery falls below this value"
                    isRequired
                  />
                )}

                {/* Recipients */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-default-700">Recipients</p>
                  
                  <EmailInput
                    label="Email Addresses"
                    helperText={
                      emails.length === 0 
                        ? "Add up to 2 email addresses"
                        : emails.length === 1
                        ? "You can add one more email"
                        : "Maximum emails added"
                    }
                    emails={emails}
                    onAddEmail={handleAddEmail}
                    onRemoveEmail={handleRemoveEmail}
                    maxEmails={2}
                  />

                  <PhoneInput
                    label="Phone Numbers"
                    helperText={
                      phoneNumbers.length === 0
                        ? "Add up to 2 phone numbers (US only)"
                        : phoneNumbers.length === 1
                        ? "You can add one more phone number"
                        : "Maximum phone numbers added"
                    }
                    phoneNumbers={phoneNumbers}
                    onAddPhone={handleAddPhone}
                    onRemovePhone={handleRemovePhone}
                    maxPhones={2}
                  />

                  {errors.recipients && (
                    <p className="text-sm text-danger">{errors.recipients}</p>
                  )}
                </div>

                {/* Throttle Notifications */}
                <Select
                  label="Ignore Repeat Notifications for the next"
                  placeholder="Select throttle period"
                  selectedKeys={[throttleMinutes]}
                  onChange={(e) => setThrottleMinutes(e.target.value)}
                  variant="bordered"
                  isRequired
                  description="Minimum time between notifications for the same alert"
                  classNames={{
                    listbox: "max-h-[200px] overflow-y-auto"
                  }}
                >
                  {THROTTLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button 
                variant="light" 
                onPress={onModalClose}
                isDisabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                color="primary" 
                onPress={handleSubmit}
                isLoading={isLoading}
                isDisabled={isLoading}
              >
                {editingAlert ? 'Update Alert' : 'Add Alert'}
              </Button>
            </ModalFooter>
          </motion.div>
        )}
      </ModalContent>
    </Modal>
  );
};
