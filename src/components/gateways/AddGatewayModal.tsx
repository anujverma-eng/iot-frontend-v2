import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";
import { motion } from "framer-motion";

interface AddGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (mac: string) => Promise<void>;
}

export const AddGatewayModal: React.FC<AddGatewayModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      placement="center"
      backdrop="blur"
    >
      <ModalContent>
        {(onClose) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <ModalHeader className="flex flex-col gap-1">
              Add New Gateway
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
  
              </div>
            </ModalBody>
            {/* <ModalFooter>
              <Button 
                color="danger" 
                variant="light" 
                onPress={onClose}
                isDisabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                color="primary" 
                onPress={handleAdd}
                isLoading={isLoading}
              >
                Add Gateway
              </Button>
            </ModalFooter> */}
          </motion.div>
        )}
      </ModalContent>
    </Modal>
  );
};
