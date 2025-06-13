import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@heroui/react";
import { Icon } from "@iconify/react";

interface CreateDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateDashboardModal: React.FC<CreateDashboardModalProps> = ({ isOpen, onClose }) => {
  const [dashboardName, setDashboardName] = React.useState("");

  const handleCreateDashboard = () => {
    // Placeholder for dashboard creation logic
    console.log("Creating dashboard:", dashboardName);
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="4xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">Create New Dashboard</ModalHeader>
            <ModalBody>
              <Input
                label="Dashboard Name"
                placeholder="Enter dashboard name"
                value={dashboardName}
                onChange={(e) => setDashboardName(e.target.value)}
              />
              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">Add Widgets</h3>
                <p className="text-default-500">
                  Drag and drop widgets to create your custom dashboard. (Placeholder for drag-and-drop functionality)
                </p>
                <div className="border-2 border-dashed border-default-300 rounded-lg h-64 mt-4 flex items-center justify-center">
                  <div className="text-center">
                    <Icon icon="lucide:layout-dashboard" className="w-12 h-12 text-default-400 mx-auto mb-2" />
                    <p className="text-default-500">Drag widgets here</p>
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleCreateDashboard}>
                Create Dashboard
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};