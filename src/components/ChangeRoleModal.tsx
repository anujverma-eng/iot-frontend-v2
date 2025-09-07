// src/components/ChangeRoleModal.tsx
import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  RadioGroup,
  Radio,
  Switch,
  Divider,
  Checkbox,
  Chip,
  Accordion,
  AccordionItem,
} from "@heroui/react";
import { CheckIcon, XMarkIcon, TrashIcon } from "@heroicons/react/20/solid";
import { useBreakpoints } from "../hooks/use-media-query";
import { UserRole } from "../types/User";
import { PermissionCategory } from "../api/permissions.service";
import { useAppDispatch, useAppSelector } from "../hooks/useAppDispatch";
import {
  fetchRolePermissions,
  selectRolePermissions,
  selectRolePermissionsLoading,
  selectPermissionsForRole,
} from "../store/rolePermissionsSlice";

interface ChangeRoleModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  memberName: string;
  currentRole: UserRole;
  currentPermissions: { allow: string[]; deny: string[] };
  permissionCategories: PermissionCategory[];
  onSave: (role: UserRole, permissions: { allow: string[]; deny: string[] }) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.OWNER]: "Complete control over the organization",
  [UserRole.ADMIN]: "Full access to all features and settings",
  [UserRole.MEMBER]: "Standard access to most features",
  [UserRole.VIEWER]: "Read-only access to view data",
};

export const ChangeRoleModal: React.FC<ChangeRoleModalProps> = ({
  isOpen,
  onOpenChange,
  memberName,
  currentRole,
  currentPermissions,
  permissionCategories,
  onSave,
  isLoading = false,
  error = null,
}) => {
  const dispatch = useAppDispatch();
  const rolePermissions = useAppSelector(selectRolePermissions);
  const rolePermissionsLoading = useAppSelector(selectRolePermissionsLoading);
  const { isMobile, isMobileDevice } = useBreakpoints();

  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [useAdvancedPermissions, setUseAdvancedPermissions] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [customPermissions, setCustomPermissions] = useState<{
    allow: string[];
    deny: string[];
  }>({
    allow: [...currentPermissions.allow],
    deny: [...currentPermissions.deny],
  });

  // Fetch role permissions when modal opens
  useEffect(() => {
    if (isOpen && !rolePermissions) {
      dispatch(fetchRolePermissions());
    }
  }, [isOpen, rolePermissions, dispatch]);

  // Get permissions for the selected role
  const selectedRolePermissions = useAppSelector(selectPermissionsForRole(selectedRole));

  const handleRoleChange = (role: string) => {
    const newRole = role as UserRole;
    setSelectedRole(newRole);

    // If advanced permissions are enabled, auto-update permissions for new role
    if (useAdvancedPermissions && rolePermissions) {
      const roleKey = newRole.toLowerCase();
      const newRolePermissions = rolePermissions.roles[roleKey]?.permissions || [];

      setCustomPermissions({
        allow: [...newRolePermissions],
        deny: [],
      });
    }
  };

  const handleAdvancedPermissionsToggle = (enabled: boolean) => {
    setUseAdvancedPermissions(enabled);

    if (enabled && rolePermissions && selectedRolePermissions.length > 0) {
      // Auto-select permissions based on selected role
      setCustomPermissions({
        allow: [...selectedRolePermissions],
        deny: [],
      });
    } else if (!enabled) {
      // Clear custom permissions when disabling advanced mode
      setCustomPermissions({
        allow: [],
        deny: [],
      });
    }
  };

  const handlePermissionChange = (permissionValue: string, type: "allow" | "deny" | "default") => {
    setCustomPermissions((prev) => {
      const newAllow = [...prev.allow];
      const newDeny = [...prev.deny];

      // Remove from both arrays first
      const allowIndex = newAllow.indexOf(permissionValue);
      if (allowIndex !== -1) newAllow.splice(allowIndex, 1);

      const denyIndex = newDeny.indexOf(permissionValue);
      if (denyIndex !== -1) newDeny.splice(denyIndex, 1);

      // Add to appropriate array based on type
      if (type === "allow") {
        newAllow.push(permissionValue);
      } else if (type === "deny") {
        newDeny.push(permissionValue);
      }

      return { allow: newAllow, deny: newDeny };
    });
  };

  const getPermissionState = (permissionValue: string): "allow" | "deny" | "default" => {
    if (customPermissions.allow.includes(permissionValue)) return "allow";
    if (customPermissions.deny.includes(permissionValue)) return "deny";
    return "default";
  };

  const handleSelectAllCategory = (category: PermissionCategory, type: "allow" | "deny") => {
    const categoryPermissions = category.permissions.map((p) => p.value);

    setCustomPermissions((prev) => {
      const newAllow = [...prev.allow];
      const newDeny = [...prev.deny];

      // Remove all category permissions from both arrays first
      categoryPermissions.forEach((perm) => {
        const allowIndex = newAllow.indexOf(perm);
        if (allowIndex !== -1) newAllow.splice(allowIndex, 1);

        const denyIndex = newDeny.indexOf(perm);
        if (denyIndex !== -1) newDeny.splice(denyIndex, 1);
      });

      // Add all to the specified type
      if (type === "allow") {
        newAllow.push(...categoryPermissions);
      } else if (type === "deny") {
        newDeny.push(...categoryPermissions);
      }

      return { allow: newAllow, deny: newDeny };
    });
  };

  const handleDeselectAllCategory = (category: PermissionCategory) => {
    const categoryPermissions = category.permissions.map((p) => p.value);

    setCustomPermissions((prev) => {
      const newAllow = prev.allow.filter((perm) => !categoryPermissions.includes(perm));
      const newDeny = prev.deny.filter((perm) => !categoryPermissions.includes(perm));

      return { allow: newAllow, deny: newDeny };
    });
  };

  const handleSelectAllPermissions = (type: "allow" | "deny") => {
    const allPermissions = permissionCategories.flatMap((cat) => cat.permissions.map((p) => p.value));

    setCustomPermissions((prev) => {
      if (type === "allow") {
        return { allow: [...allPermissions], deny: [] };
      } else {
        return { allow: [], deny: [...allPermissions] };
      }
    });
  };

  const handleClearAllPermissions = () => {
    setCustomPermissions({ allow: [], deny: [] });
  };

  const handleSave = async () => {
    const finalPermissions = useAdvancedPermissions ? customPermissions : { allow: [], deny: [] };

    try {
      setLocalError(null);
      await onSave(selectedRole, finalPermissions);
    } catch (error: any) {
      setLocalError(error.message || "Failed to update role");
    }
  };

  const handleClose = () => {
    // Reset form
    setSelectedRole(currentRole);
    setUseAdvancedPermissions(false);
    setLocalError(null);
    setCustomPermissions({
      allow: [...currentPermissions.allow],
      deny: [...currentPermissions.deny],
    });
    onOpenChange(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size={isMobile ? "full" : "2xl"}
      onClose={handleClose}
      classNames={{
        base: isMobile ? "m-0 sm:m-6" : "max-h-[90vh]",
        body: isMobile ? "p-4" : "",
        header: isMobile ? "px-4 pt-4 pb-2" : "",
        footer: isMobile ? "px-4 pb-4" : "",
      }}
    >
      <ModalContent className={isMobile ? "max-h-screen" : "max-h-[90vh] overflow-hidden flex flex-col"}>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 flex-shrink-0">Change Role for {memberName}</ModalHeader>
            <ModalBody className={isMobile ? "gap-4 overflow-y-auto" : "gap-6 overflow-y-auto flex-1 min-h-0"}>
              {/* Error Display */}
              {(error || localError) && (
                <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
                  <p className="text-sm text-danger-600">{error || localError}</p>
                </div>
              )}

              {/* Role Selection */}
              <div>
                <h4 className="text-sm font-medium mb-3">Select Role</h4>
                <RadioGroup value={selectedRole} onValueChange={handleRoleChange} className="gap-3">
                  {Object.values(UserRole)
                    .filter((role) => role !== UserRole.OWNER)
                    .map((role) => (
                      <Radio key={role} value={role} description={ROLE_DESCRIPTIONS[role]} className="max-w-full">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{role}</span>
                          {role === currentRole && (
                            <Chip size="sm" color="primary" variant="flat">
                              Current
                            </Chip>
                          )}
                        </div>
                      </Radio>
                    ))}
                </RadioGroup>
              </div>

              <Divider />

              {/* Role Permissions Summary */}
              {rolePermissions && selectedRolePermissions.length > 0 && (
                <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <h5 className="text-sm font-medium text-primary-700 mb-2">{selectedRole} Role Permissions</h5>
                  <p className="text-xs text-primary-600 mb-2">
                    This role includes {selectedRolePermissions.length} permissions by default.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedRolePermissions.slice(0, 6).map((perm) => (
                      <Chip key={perm} size="sm" variant="flat" color="primary">
                        {perm.split(".").pop()}
                      </Chip>
                    ))}
                    {selectedRolePermissions.length > 6 && (
                      <Chip size="sm" variant="flat" color="default">
                        +{selectedRolePermissions.length - 6} more
                      </Chip>
                    )}
                  </div>
                </div>
              )}

              {/* Advanced Permissions Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">Advanced Permissions</h4>
                  <p className="text-xs text-default-500 mt-1">
                    {rolePermissions && selectedRolePermissions.length > 0
                      ? `Auto-selects ${selectedRolePermissions.length} default permissions for ${selectedRole} role`
                      : "Override default role permissions with custom settings"}
                  </p>
                </div>
                <Switch
                  isSelected={useAdvancedPermissions}
                  onValueChange={handleAdvancedPermissionsToggle}
                  size="sm"
                  isDisabled={rolePermissionsLoading}
                />
              </div>

              {/* Advanced Permissions Panel */}
              {useAdvancedPermissions && (
                <div className="border rounded-lg p-4 bg-default-50">
                  <div className="mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <h5 className="text-sm font-medium">Custom Permissions</h5>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-default-500">
                          <span className={isMobile ? "hidden" : ""}>Selected:</span>
                          <Chip size="sm" color="success" variant="flat">
                            {customPermissions.allow.length} Allow
                          </Chip>
                          <Chip size="sm" color="danger" variant="flat">
                            {customPermissions.deny.length} Deny
                          </Chip>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-default-500">
                      {isMobile
                        ? "Checked Permissions (✅) are included by default"
                        : "Checked Permissions (✅) are included by default for the " + selectedRole + " role"}
                    </p>
                  </div>

                  <Accordion 
                    className={isMobile ? "max-h-[50vh] overflow-y-auto" : "max-h-60 overflow-y-auto"}
                    variant="splitted"
                  >
                    {permissionCategories.map((category) => (
                      <AccordionItem
                        key={category.key}
                        aria-label={category.label}
                        title={
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-default-700">{category.label}</span>
                              <Chip size="sm" variant="flat" color="default" className="text-xs">
                                {category.permissions.filter((p) => customPermissions.allow.includes(p.value)).length}/
                                {category.permissions.length}
                              </Chip>
                            </div>
                            {!isMobile && (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-6 px-2 text-green-700 border-green-300 bg-green-50 hover:bg-green-100 hover:border-green-400"
                                  startContent={<CheckIcon className="w-3 h-3" />}
                                  onPress={() => handleSelectAllCategory(category, "allow")}
                                >
                                  Allow All
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-6 px-2 text-red-700 border-red-300 bg-red-50 hover:bg-red-100 hover:border-red-400"
                                  startContent={<XMarkIcon className="w-3 h-3" />}
                                  onPress={() => handleSelectAllCategory(category, "deny")}
                                >
                                  Deny All
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-6 px-2 text-gray-700 border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400"
                                  startContent={<TrashIcon className="w-3 h-3" />}
                                  onPress={() => handleDeselectAllCategory(category)}
                                >
                                  Clear
                                </Button>
                              </div>
                            )}
                          </div>
                        }
                        subtitle={isMobile ? "" : category.description}
                        className="w-full"
                      >
                        <div className={isMobile ? "space-y-2" : "space-y-3 pb-2"}>
                          {category.permissions.map((permission) => {
                            const permState = getPermissionState(permission.value);
                            const isDefaultForRole = selectedRolePermissions.includes(permission.value);

                            return (
                              <div
                                key={permission.value}
                                className={
                                  isMobile
                                    ? "flex items-center justify-between py-2 px-2 bg-default-50 rounded-lg"
                                    : "flex items-center justify-between py-2 px-3 bg-default-50 rounded-lg"
                                }
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-sm text-default-700 truncate">{permission.label}</span>
                                  {isDefaultForRole && <span className="text-xs flex-shrink-0">✅</span>}
                                </div>

                                <div className={isMobile ? "flex items-center gap-4" : "flex items-center gap-3"}>
                                  <Checkbox
                                    size="sm"
                                    isSelected={permState === "allow"}
                                    onValueChange={(isSelected) => {
                                      handlePermissionChange(permission.value, isSelected ? "allow" : "default");
                                    }}
                                    color="success"
                                  >
                                    {!isMobile && <span className="text-xs">Allow</span>}
                                  </Checkbox>

                                  <Checkbox
                                    size="sm"
                                    isSelected={permState === "deny"}
                                    onValueChange={(isSelected) => {
                                      handlePermissionChange(permission.value, isSelected ? "deny" : "default");
                                    }}
                                    color="danger"
                                  >
                                    {!isMobile && <span className="text-xs">Deny</span>}
                                  </Checkbox>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}
            </ModalBody>
            <ModalFooter className={`${isMobile ? "flex-col gap-2" : ""} flex-shrink-0`}>
              <Button variant="flat" onPress={onClose} className={isMobile ? "w-full" : ""}>
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleSave}
                isLoading={isLoading}
                isDisabled={selectedRole === currentRole && !useAdvancedPermissions}
                className={isMobile ? "w-full" : ""}
              >
                Save Changes
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
