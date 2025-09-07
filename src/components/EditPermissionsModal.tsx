// src/components/EditPermissionsModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Checkbox,
  Divider,
  Chip,
  Card,
  CardBody,
  Accordion,
  AccordionItem
} from '@heroui/react';
import { 
  CheckIcon,
  XMarkIcon,
  TrashIcon
} from '@heroicons/react/20/solid';
import { useBreakpoints } from '../hooks/use-media-query';
import { UserRole } from '../types/User';
import { PermissionCategory } from '../api/permissions.service';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import {
  fetchRolePermissions,
  selectRolePermissions,
  selectRolePermissionsLoading,
  selectPermissionsForRole
} from '../store/rolePermissionsSlice';

interface EditPermissionsModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  memberName: string;
  memberRole: UserRole;
  currentPermissions: { allow: string[]; deny: string[] };
  permissionCategories: PermissionCategory[];
  onSave: (permissions: { allow: string[]; deny: string[] }) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export const EditPermissionsModal: React.FC<EditPermissionsModalProps> = ({
  isOpen,
  onOpenChange,
  memberName,
  memberRole,
  currentPermissions,
  permissionCategories,
  onSave,
  isLoading = false,
  error = null
}) => {
  const dispatch = useAppDispatch();
  const { isMobile } = useBreakpoints();
  const rolePermissions = useAppSelector(selectRolePermissions);
  const rolePermissionsLoading = useAppSelector(selectRolePermissionsLoading);
  
  const [customPermissions, setCustomPermissions] = useState<{
    allow: string[];
    deny: string[];
  }>({
    allow: [...currentPermissions.allow],
    deny: [...currentPermissions.deny]
  });
  const [localError, setLocalError] = useState<string | null>(null);

  // Fetch role permissions when modal opens
  useEffect(() => {
    if (isOpen && !rolePermissions) {
      dispatch(fetchRolePermissions());
    }
  }, [isOpen, rolePermissions, dispatch]);

  // Get permissions for the member's role
  const memberRolePermissions = useAppSelector(selectPermissionsForRole(memberRole));

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCustomPermissions({
        allow: [...currentPermissions.allow],
        deny: [...currentPermissions.deny]
      });
      setLocalError(null);
    }
  }, [isOpen, currentPermissions]);

  const handlePermissionChange = (permissionValue: string, type: 'allow' | 'deny' | 'default') => {
    setCustomPermissions(prev => {
      const newAllow = [...prev.allow];
      const newDeny = [...prev.deny];
      
      // Remove from both arrays first
      const allowIndex = newAllow.indexOf(permissionValue);
      if (allowIndex !== -1) newAllow.splice(allowIndex, 1);
      
      const denyIndex = newDeny.indexOf(permissionValue);
      if (denyIndex !== -1) newDeny.splice(denyIndex, 1);
      
      // Add to appropriate array based on type
      if (type === 'allow') {
        newAllow.push(permissionValue);
      } else if (type === 'deny') {
        newDeny.push(permissionValue);
      }
      
      return { allow: newAllow, deny: newDeny };
    });
  };

  const getPermissionState = (permissionValue: string): 'allow' | 'deny' | 'default' => {
    if (customPermissions.allow.includes(permissionValue)) return 'allow';
    if (customPermissions.deny.includes(permissionValue)) return 'deny';
    
    // If the permission is in the role baseline and not explicitly denied, treat it as allowed
    if (isPermissionInRole(permissionValue)) return 'allow';
    
    return 'default';
  };

  const getRoleBaselinePermissions = (role: UserRole): string[] => {
    // This would typically come from your role configuration
    // For now, returning empty array - you can implement role-based defaults
    switch (role) {
      case UserRole.ADMIN:
        return permissionCategories.flatMap(cat => cat.permissions.map(p => p.value));
      case UserRole.MEMBER:
        return permissionCategories
          .flatMap(cat => cat.permissions)
          .filter(p => !p.value.includes('delete') && !p.value.includes('admin'))
          .map(p => p.value);
      case UserRole.VIEWER:
        return permissionCategories
          .flatMap(cat => cat.permissions)
          .filter(p => p.value.includes('view') || p.value.includes('read'))
          .map(p => p.value);
      default:
        return [];
    }
  };

  const isPermissionInRole = (permissionValue: string): boolean => {
    // Use API data if available, fallback to hardcoded logic
    if (rolePermissions && memberRolePermissions.length > 0) {
      return memberRolePermissions.includes(permissionValue);
    }
    
    // Fallback to hardcoded role permissions
    const fallbackRolePermissions = getRoleBaselinePermissions(memberRole);
    return fallbackRolePermissions.includes(permissionValue);
  };

  const handleSelectAllCategory = (category: PermissionCategory, type: 'allow' | 'deny') => {
    const categoryPermissions = category.permissions.map(p => p.value);
    
    setCustomPermissions(prev => {
      const newAllow = [...prev.allow];
      const newDeny = [...prev.deny];
      
      // Remove all category permissions from both arrays first
      categoryPermissions.forEach(perm => {
        const allowIndex = newAllow.indexOf(perm);
        if (allowIndex !== -1) newAllow.splice(allowIndex, 1);
        
        const denyIndex = newDeny.indexOf(perm);
        if (denyIndex !== -1) newDeny.splice(denyIndex, 1);
      });
      
      // Add all to the specified type
      if (type === 'allow') {
        newAllow.push(...categoryPermissions);
      } else if (type === 'deny') {
        newDeny.push(...categoryPermissions);
      }
      
      return { allow: newAllow, deny: newDeny };
    });
  };

  const handleDeselectAllCategory = (category: PermissionCategory) => {
    const categoryPermissions = category.permissions.map(p => p.value);
    
    setCustomPermissions(prev => {
      const newAllow = prev.allow.filter(perm => !categoryPermissions.includes(perm));
      const newDeny = prev.deny.filter(perm => !categoryPermissions.includes(perm));
      
      return { allow: newAllow, deny: newDeny };
    });
  };

  const handleSelectAllPermissions = (type: 'allow' | 'deny') => {
    const allPermissions = permissionCategories.flatMap(cat => cat.permissions.map(p => p.value));
    
    setCustomPermissions(prev => {
      if (type === 'allow') {
        return { allow: [...allPermissions], deny: [] };
      } else {
        return { allow: [], deny: [...allPermissions] };
      }
    });
  };

  const handleClearAllPermissions = () => {
    setCustomPermissions({ allow: [], deny: [] });
  };

  // Helper functions to calculate effective permission counts
  const getEffectiveAllowCount = () => {
    const allPermissions = permissionCategories.flatMap(cat => cat.permissions.map(p => p.value));
    return allPermissions.filter(perm => {
      const state = getPermissionState(perm);
      return state === 'allow';
    }).length;
  };

  const getEffectiveDenyCount = () => {
    const allPermissions = permissionCategories.flatMap(cat => cat.permissions.map(p => p.value));
    return allPermissions.filter(perm => {
      const state = getPermissionState(perm);
      return state === 'deny';
    }).length;
  };

  const handleSave = async () => {
    try {
      setLocalError(null);
      await onSave(customPermissions);
    } catch (error: any) {
      setLocalError(error.message || 'Failed to update permissions');
    }
  };

  const handleClose = () => {
    setCustomPermissions({
      allow: [...currentPermissions.allow],
      deny: [...currentPermissions.deny]
    });
    setLocalError(null);
    onOpenChange(false);
  };

  const getPermissionStateColor = (state: 'allow' | 'deny' | 'default') => {
    switch (state) {
      case 'allow': return 'success';
      case 'deny': return 'danger';
      default: return 'default';
    }
  };

  const getPermissionStateText = (state: 'allow' | 'deny' | 'default', inRole: boolean, isExplicit: boolean) => {
    switch (state) {
      case 'allow': 
        if (isExplicit) return 'Explicitly Allowed';
        return inRole ? 'Role Permission' : 'Allowed';
      case 'deny': return 'Explicitly Denied';
      default: return inRole ? 'Role Default' : 'Not Allowed';
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={onOpenChange} 
      size={isMobile ? "full" : "3xl"}
      className={isMobile ? "m-0" : ""}
      classNames={{
        wrapper: isMobile ? "p-0" : "",
        base: isMobile ? "m-0 max-h-screen h-screen" : "",
        body: isMobile ? "p-4 overflow-hidden" : "",
        header: isMobile ? "p-4 pb-2" : "",
        footer: isMobile ? "p-4 pt-2" : ""
      }}
      onClose={handleClose}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <span>Edit Permissions for {memberName}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-default-500">Role:</span>
                <Chip size="sm" color="primary" variant="flat">
                  {memberRole}
                </Chip>
              </div>
            </ModalHeader>
            <ModalBody className={isMobile ? "overflow-hidden flex flex-col" : ""}>
              {/* Error Display */}
              {(error || localError) && (
                <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg mb-4">
                  <p className="text-sm text-danger-600">
                    {error || localError}
                  </p>
                </div>
              )}
              
              {isMobile ? (
                <div className="flex flex-col min-h-0 flex-1">
                  <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-default-500">
                        <span>Effective:</span>
                        <Chip size="sm" color="success" variant="flat">
                          {getEffectiveAllowCount()} Allow
                        </Chip>
                        <Chip size="sm" color="danger" variant="flat">
                          {getEffectiveDenyCount()} Deny
                        </Chip>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <Accordion variant="splitted" className="">
                  {/* <Accordion variant="splitted" className=""> */}
                    {permissionCategories.map((category) => (
                      <AccordionItem
                        key={category.key}
                        title={
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-default-800">
                                {category.label}
                              </h4>
                              <Chip size="sm" variant="flat" color="default" className="text-xs">
                                {category.permissions.filter(p => {
                                  const permState = getPermissionState(p.value);
                                  return permState === 'allow';
                                }).length}
                                /
                                {category.permissions.length}
                              </Chip>
                            </div>
                          </div>
                        }
                        className="w-full"
                      >
                        <div className="space-y-3">
                          {category.permissions.map((permission) => {
                            const permState = getPermissionState(permission.value);
                            const inRole = isPermissionInRole(permission.value);
                            const isExplicit = customPermissions.allow.includes(permission.value) || 
                                             customPermissions.deny.includes(permission.value);
                            
                            return (
                              <div 
                                key={permission.value} 
                                className="p-3 bg-default-100 rounded-lg"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-medium text-default-700 ${
                                      isMobile ? 'text-xs' : 'text-sm'
                                    }`}>
                                      {permission.label}
                                    </span>
                                    {inRole && (
                                      <span className="text-xs">✅</span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      size="sm"
                                      isSelected={permState === 'allow'}
                                      onValueChange={(isSelected) => {
                                        handlePermissionChange(
                                          permission.value, 
                                          isSelected ? 'allow' : 'default'
                                        );
                                      }}
                                      color="success"
                                    >
                                      {!isMobile && <span className="text-xs">Allow</span>}
                                    </Checkbox>
                                    
                                    <Checkbox
                                      size="sm"
                                      isSelected={permState === 'deny'}
                                      onValueChange={(isSelected) => {
                                        handlePermissionChange(
                                          permission.value, 
                                          isSelected ? 'deny' : 'default'
                                        );
                                      }}
                                      color="danger"
                                    >
                                      {!isMobile && <span className="text-xs">Deny</span>}
                                    </Checkbox>
                                  </div>
                                </div>
                                
                                <div className="mt-2">
                                  <Chip 
                                    size="sm" 
                                    color={getPermissionStateColor(permState)}
                                    variant="flat"
                                    className="text-xs"
                                  >
                                    {getPermissionStateText(permState, inRole, isExplicit)}
                                  </Chip>
                                  {!isMobile && (
                                    <p className="text-xs text-default-500 mt-1">
                                      {permission.value}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionItem>
                    ))}
                    </Accordion>
                  </div>
                </div>
              ) : (
                <Card>
                  <CardBody>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-default-600">
                          Customize permissions beyond the default <strong>{memberRole.toLowerCase()}</strong> role.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-default-500">
                          <span>Effective:</span>
                          <Chip size="sm" color="success" variant="flat">
                            {getEffectiveAllowCount()} Allow
                          </Chip>
                          <Chip size="sm" color="danger" variant="flat">
                            {getEffectiveDenyCount()} Deny
                          </Chip>
                        </div>
                      </div>
                    </div>
                    
                    <Accordion variant="splitted" className="px-0 max-h-96 overflow-y-auto">
                      {permissionCategories.map((category) => (
                        <AccordionItem
                          key={category.key}
                          title={
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-default-800">
                                  {category.label}
                                </h4>
                                <Chip size="sm" variant="flat" color="default" className="text-xs">
                                  {category.permissions.filter(p => {
                                    const permState = getPermissionState(p.value);
                                    return permState === 'allow';
                                  }).length}
                                  /
                                  {category.permissions.length}
                                </Chip>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-6 px-2 text-green-700 border-green-300 bg-green-50 hover:bg-green-100 hover:border-green-400"
                                  startContent={<CheckIcon className="w-3 h-3" />}
                                  onPress={() => handleSelectAllCategory(category, 'allow')}
                                >
                                  Allow All
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-6 px-2 text-red-700 border-red-300 bg-red-50 hover:bg-red-100 hover:border-red-400"
                                  startContent={<XMarkIcon className="w-3 h-3" />}
                                  onPress={() => handleSelectAllCategory(category, 'deny')}
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
                            </div>
                          }
                          subtitle={category.description}
                          className="w-full"
                        >
                          <div className="space-y-3">
                            {category.permissions.map((permission) => {
                              const permState = getPermissionState(permission.value);
                              const inRole = isPermissionInRole(permission.value);
                              const isExplicit = customPermissions.allow.includes(permission.value) || 
                                               customPermissions.deny.includes(permission.value);
                              
                              return (
                                <div 
                                  key={permission.value} 
                                  className="flex items-center justify-between p-3 bg-default-100 rounded-lg"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-medium text-default-700">
                                        {permission.label}
                                      </span>
                                      {inRole && (
                                        <span className="text-xs">✅</span>
                                      )}
                                      <Chip 
                                        size="sm" 
                                        color={getPermissionStateColor(permState)}
                                        variant="flat"
                                        className="text-xs"
                                      >
                                        {getPermissionStateText(permState, inRole, isExplicit)}
                                      </Chip>
                                    </div>
                                    <p className="text-xs text-default-500">
                                      {permission.value}
                                    </p>
                                  </div>
                                  
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      size="sm"
                                      isSelected={permState === 'allow'}
                                      onValueChange={(isSelected) => {
                                        handlePermissionChange(
                                          permission.value, 
                                          isSelected ? 'allow' : 'default'
                                        );
                                      }}
                                      color="success"
                                    >
                                      <span className="text-xs">Allow</span>
                                    </Checkbox>
                                    
                                    <Checkbox
                                      size="sm"
                                      isSelected={permState === 'deny'}
                                      onValueChange={(isSelected) => {
                                        handlePermissionChange(
                                          permission.value, 
                                          isSelected ? 'deny' : 'default'
                                        );
                                      }}
                                      color="danger"
                                    >
                                      <span className="text-xs">Deny</span>
                                    </Checkbox>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardBody>
                </Card>
              )}
            </ModalBody>
            <ModalFooter className={isMobile ? "flex-col gap-2" : ""}>
              <Button 
                variant="flat" 
                onPress={onClose}
                className={isMobile ? "w-full" : ""}
              >
                Cancel
              </Button>
              <Button 
                color="primary" 
                onPress={handleSave}
                isLoading={isLoading}
                className={isMobile ? "w-full" : ""}
              >
                Save Permissions
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
