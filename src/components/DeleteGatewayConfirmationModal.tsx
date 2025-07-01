import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
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
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Icon 
              icon={icon} 
              className={`w-6 h-6 ${
                confirmColor === "danger" ? "text-danger" : 
                confirmColor === "warning" ? "text-warning" : 
                "text-primary"
              }`} 
            />
            <span>{title}</span>
          </div>
        </ModalHeader>
        <ModalBody>
          <p className="text-default-600">{message}</p>
        </ModalBody>
        <ModalFooter>
          <Button 
            variant="light" 
            onPress={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button 
            color={confirmColor} 
            onPress={onConfirm}
            isLoading={isLoading}
            disabled={isLoading}
          >
            {confirmText}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
