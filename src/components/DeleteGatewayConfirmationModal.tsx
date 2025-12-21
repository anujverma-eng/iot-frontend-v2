import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "primary" | "secondary" | "success" | "warning" | "danger";
  isLoading?: boolean;
  icon?: string;
}

export const DeleteGatewayConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "danger",
  isLoading = false,
  icon = "lucide:alert-triangle",
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Icon
              icon={icon}
              className={`w-6 h-6 ${
                confirmColor === "danger" ? "text-danger" : confirmColor === "warning" ? "text-warning" : "text-primary"
              }`}
            />
            <span>{title}</span>
          </div>
        </ModalHeader>
        <ModalBody>
          <h1 className="font-medium">Are you sure you want to delete the alert?</h1>
          {/* <p className="mb-3">{message}</p> */}
          {/* <p className="mb-2">This action will:</p>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>Remove all historical data for corresponding sensors</li>
            <li>Mark the sensor as ignored</li>
            <li>Make it available for others to claim</li>
          </ul> */}
          <p className="mt-3 font-medium text-danger-600">This action cannot be undone.</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button color={confirmColor} onPress={onConfirm} isLoading={isLoading} disabled={isLoading}>
            {confirmText}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
