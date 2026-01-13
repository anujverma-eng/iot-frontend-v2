// src/components/OrgPickerModal.tsx
import React, { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  Checkbox,
  Chip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAppDispatch, useAppSelector } from "../hooks/useAppDispatch";
import { selectOrgAndFinalize } from "../store/activeOrgSlice";
import { UserService } from "../api/user.service";

interface OrgPickerModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const OrgPickerModal: React.FC<OrgPickerModalProps> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.profile);
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(undefined);
  const [rememberChoice, setRememberChoice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const memberships = profile.data?.memberships || [];

  const handleContinue = async () => {
    if (!selectedOrgId) return;

    setIsSubmitting(true);
    try {
      // Update user settings based on remember choice
      await UserService.updateMySettings({
        orgChoiceMode: rememberChoice ? "remember" : "ask-every-time",
      });

      // Switch to selected org and pass rememberChoice
      await dispatch(selectOrgAndFinalize({ 
        orgId: selectedOrgId, 
        rememberChoice 
      })).unwrap();

      onClose?.();
    } catch (error) {
      console.error("Failed to select organization:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleColor = (role: string): "primary" | "secondary" | "success" | "warning" => {
    switch (role.toUpperCase()) {
      case "OWNER":
        return "primary";
      case "ADMIN":
        return "secondary";
      case "MEMBER":
        return "success";
      case "VIEWER":
        return "warning";
      default:
        return "success";
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(isOpen) => !isOpen && onClose?.()} isDismissable={false} hideCloseButton>
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col">Select an Organization</ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-500">Choose which organization you want to access:</p>

              <div className="flex flex-col gap-2">
                {memberships.map((membership: any) => {
                  const isSelected = selectedOrgId === membership.orgId;

                  return (
                    <Card
                      key={membership.orgId}
                      isPressable
                      isHoverable
                      className={`border ${isSelected ? "border-primary" : "border-divider"}`}
                      onPress={() => setSelectedOrgId(membership.orgId)}
                    >
                      <CardBody className="flex flex-row items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-md bg-${getRoleColor(membership.role)}-100`}
                          >
                            <Icon
                              icon="lucide:building"
                              className={`h-5 w-5 text-${getRoleColor(membership.role)}-500`}
                            />
                          </div>
                          <div>
                            <p className="font-medium">{membership.orgName}</p>
                            {membership.orgDomain && <p className="text-xs text-default-500">{membership.orgDomain}</p>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Chip size="sm" color={getRoleColor(membership.role)} variant="flat">
                            {membership.role}
                          </Chip>

                          {isSelected && <Icon icon="lucide:check-circle" className="h-5 w-5 text-primary" />}
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-4">
                <Checkbox isSelected={rememberChoice} onValueChange={setRememberChoice}>
                  Remember my choice
                </Checkbox>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onPress={handleContinue} isDisabled={!selectedOrgId} isLoading={isSubmitting}>
                Continue
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
