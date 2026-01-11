// src/components/OrgSelector.tsx
import React, { useState } from 'react';
import {
  Button,
  Chip,
  Skeleton,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { selectOrgAndFinalize, selectActiveOrgName, selectActiveOrgStatus, selectActiveOrgId } from '../store/activeOrgSlice';
import { UserService } from '../api/user.service';

export const OrgSelector: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const profile = useAppSelector(state => state.profile);
  const activeOrgName = useAppSelector(selectActiveOrgName);
  const activeOrgStatus = useAppSelector(selectActiveOrgStatus);
  const activeOrgId = useAppSelector(selectActiveOrgId);
  const [isChanging, setIsChanging] = useState(false);

  const memberships = profile.data?.memberships || [];
  const isLoading = activeOrgStatus === 'resolving' || isChanging;

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'owner': return 'success';
      case 'admin': return 'warning';
      case 'member': return 'primary';
      default: return 'default';
    }
  };

  const handleOrgChange = async (orgId: string) => {
    if (isChanging || orgId === activeOrgId) return;
    
    setIsChanging(true);
    try {
      // Only call selectOrgAndFinalize - it handles the settings update internally
      await dispatch(selectOrgAndFinalize(orgId)).unwrap();
    } catch (error) {
      console.error('Failed to change organization:', error);
    } finally {
      setIsChanging(false);
    }
  };

  // Always show dropdown to allow access to "Manage Organizations" even for single org users
  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          variant="flat"
          size="sm"
          startContent={<Icon icon="lucide:building" className="h-4 w-4" />}
          endContent={<Icon icon="lucide:chevron-down" className="h-3 w-3" />}
          className="max-w-[200px]"
          isLoading={isLoading}
        >
          {isLoading ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            <span className="truncate">{activeOrgName || 'Select Organization'}</span>
          )}
        </Button>
      </DropdownTrigger>
      <DropdownMenu 
        aria-label="Organization Switcher"
        className="min-w-[250px]"
        items={[
          { key: 'header', type: 'header' },
          ...memberships.map((membership: any) => ({
            key: membership.orgId,
            type: 'item',
            membership
          })),
          { key: 'divider', type: 'divider' },
          { key: 'manage', type: 'manage' }
        ]}
      >
        {(item: any) => {
          if (item.type === 'header') {
            return (
              <DropdownItem key="header" isReadOnly className="opacity-100">
                <p className="text-xs font-medium text-default-500 uppercase tracking-wide">
                  {memberships.length > 1 ? 'Switch Organization' : 'Current Organization'}
                </p>
              </DropdownItem>
            );
          }
          
          if (item.type === 'divider') {
            return (
              <DropdownItem key="divider" isReadOnly className="p-0">
                <div className="border-t border-divider" />
              </DropdownItem>
            );
          }
          
          if (item.type === 'manage') {
            return (
              <DropdownItem 
                key="manage" 
                startContent={<Icon icon="lucide:settings" className="h-4 w-4" />}
                onPress={() => {
                  navigate('/dashboard/settings');
                }}
              >
                Organization Settings
              </DropdownItem>
            );
          }
          
          // Regular membership item
          const { membership } = item;
          const isActive = membership.orgId === activeOrgId;
          
          return (
            <DropdownItem
              key={membership.orgId}
              startContent={
                isActive ? (
                  <Icon icon="lucide:check" className="h-4 w-4 text-default-400" />
                ) : (
                  <Icon icon="lucide:building" className="h-4 w-4 text-default-400" />
                )
              }
              endContent={
                <Chip 
                  size="sm" 
                  color={getRoleColor(membership.role) as any}
                  variant="flat"
                  className="capitalize"
                >
                  {membership.role}
                </Chip>
              }
              onPress={() => handleOrgChange(membership.orgId)}
              className={isActive ? "text-default-600 border border-secondary-50" : ""}
            >
              <div className="flex flex-col">
                <span className="font-medium">{membership.orgName}</span>
                {isActive && (
                  <span className="text-xs text-success-500">Current organization</span>
                )}
              </div>
            </DropdownItem>
          );
        }}
      </DropdownMenu>
    </Dropdown>
  );
};
