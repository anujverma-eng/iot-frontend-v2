import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import React from "react";

interface DeleteSensorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sensorName: string;
  sensorMac: string;
  isLoading?: boolean;
}

export const DeleteSensorModal: React.FC<DeleteSensorModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  sensorName,
  sensorMac,
  isLoading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        {(onCloseModal) => (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <ModalHeader className="flex flex-col gap-1 text-danger-600">
              <div className="flex items-center gap-3">
                <Icon 
                  icon="lucide:alert-triangle" 
                  className="w-6 h-6 text-danger" 
                />
                <span>Confirm Un-claim</span>
              </div>
            </ModalHeader>
            <ModalBody>
              <p className="mb-3">
                Are you sure you want to un-claim the sensor <strong>{sensorName}</strong> ({sensorMac})? 
              </p>
              <p className="mb-2">This action will:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>Remove all historical data for this sensor</li>
                <li>Mark the sensor as ignored</li>
                <li>Make it available for others to claim</li>
              </ul>
              <p className="mt-3 font-medium text-danger-600">This action cannot be undone.</p>
            </ModalBody>
            <ModalFooter>
              <Button 
                variant="light" 
                onPress={onCloseModal}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                color="danger" 
                onPress={onConfirm}
                isLoading={isLoading}
                disabled={isLoading}
              >
                Un-claim Sensor
              </Button>
            </ModalFooter>
          </motion.div>
        )}
      </ModalContent>
    </Modal>
  );
};
