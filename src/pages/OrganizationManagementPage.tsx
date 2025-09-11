import React, { useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Spinner,
  addToast,
  Chip,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchProfile } from '../store/profileSlice';
import { selectActiveOrgId, selectActiveOrgName, selectActiveOrgStatus, setOrgName } from '../store/activeOrgSlice';
import { OrgService } from '../api/org.service';
import { UserRole } from '../types/User';
import { OrganizationSettings } from '../components/OrganizationSettings';

export default function OrganizationManagementPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.profile);
  
  // Get currently active organization from activeOrg slice
  const activeOrgId = useAppSelector(selectActiveOrgId);
  const activeOrgName = useAppSelector(selectActiveOrgName);
  const activeOrgStatus = useAppSelector(selectActiveOrgStatus);
  
  // Get current organization membership details from profile
  const userMemberships = profile.data?.memberships || [];
  const currentOrgMembership = userMemberships.find(m => m.orgId === activeOrgId);
  
  // Check if user can rename the organization
  const canRenameOrg = currentOrgMembership?.role === UserRole.OWNER || 
                       currentOrgMembership?.role === UserRole.ADMIN;

  // Load profile data on mount
  useEffect(() => {
    if (!profile.loaded) {
      dispatch(fetchProfile());
    }
  }, [dispatch, profile.loaded]);

  // Handle organization rename callback
  const handleOrgRenamed = async (newName: string) => {
    try {
      if (!activeOrgId) {
        const error = new Error('No organization selected');
        addToast({
          title: 'Error',
          description: error.message,
          color: 'danger'
        });
        throw error;
      }

      await OrgService.updateName(activeOrgId, {
        name: newName.trim(),
      });
      
      // 🔄 CRITICAL: Update both profile data AND activeOrg slice
      // Profile data updates the memberships array for permission checks
      await dispatch(fetchProfile()).unwrap();
      // ActiveOrg slice updates the displayed organization name throughout the UI
      dispatch(setOrgName(newName.trim()));
      
      addToast({
        title: 'Organization Renamed',
        description: `Organization name updated to "${newName}"`,
        color: 'success'
      });
      
    } catch (error: any) {
      console.error('Organization rename error:', error);
      
      let errorMessage = 'Failed to update organization name';
      
      // Handle specific error cases
      if (error.response?.status === 403) {
        errorMessage = 'Access denied. You don\'t have permission to rename this organization.';
      } else if (error.response?.status === 400) {
        // Handle validation errors
        const validationData = error.response.data?.data;
        if (validationData?.name) {
          errorMessage = validationData.name[0];
        } else {
          errorMessage = error.response.data?.message || 'Validation failed';
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addToast({
        title: 'Rename Failed',
        description: errorMessage,
        color: 'danger'
      });
      
      // Re-throw the error so the OrganizationSettings component can handle it
      throw new Error(errorMessage);
    }
  };

  if (profile.loading || !profile.loaded || activeOrgStatus === 'resolving') {
    return (
      <div className="flex justify-center items-center min-h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!activeOrgId) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <div className="text-center space-y-4">
          <Icon icon="lucide:building" className="h-16 w-16 mx-auto text-default-400" />
          <h2 className="text-xl font-semibold">No Organization Selected</h2>
          <p className="text-default-500">Please select an organization to manage.</p>
          <Button color="primary" onPress={() => navigate('/dashboard/home')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      {/* Back Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="light"
          size="sm"
          startContent={<Icon icon="lucide:arrow-left" className="h-4 w-4" />}
          onPress={() => navigate(-1)}
        >
          Back
        </Button>
        <Icon icon="lucide:chevron-right" className="h-4 w-4 text-default-400" />
        <span className="text-sm text-default-500">Organization Management</span>
      </div>

      {/* Header with organization context */}
      <div className="flex items-center gap-2 mb-6">
        <Icon icon="lucide:building" className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Organization Management</h1>
        <Chip size="sm" variant="flat" color="primary" className="ml-2">
          {activeOrgName}
        </Chip>
      </div>

      {/* Organization Switch Notice */}
      <Card className="border border-primary/20 bg-primary/5">
        <CardBody>
          <div className="flex items-center gap-3">
            <Icon icon="lucide:info" className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-primary">
                Managing settings for: <strong>{activeOrgName}</strong>
              </p>
              <p className="text-xs text-default-600 mt-1">
                To manage a different organization, use the organization selector in the top navigation bar.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Organization Information Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Organization Overview</h2>
            <p className="text-sm text-default-500">Current organization: <strong>{activeOrgName}</strong></p>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-6">
            {/* Current Organization Info */}
            <div className="flex items-center justify-between p-4 border border-default-200 rounded-lg bg-primary/5">
              <div className="flex items-center gap-3">
                <Icon icon="lucide:building" className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-primary">{activeOrgName}</p>
                  <p className="text-sm text-default-500">Currently selected organization</p>
                </div>
              </div>
              <Chip 
                color="primary" 
                size="sm" 
                variant="flat"
                startContent={<Icon icon="lucide:check-circle" className="h-3 w-3" />}
              >
                Active
              </Chip>
            </div>
            
            {/* User Role Section */}
            <div className="flex items-center justify-between p-4 border border-default-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Icon icon="lucide:user-check" className="h-5 w-5 text-default-400" />
                <div>
                  <p className="font-medium">{currentOrgMembership?.role || 'MEMBER'}</p>
                  <p className="text-sm text-default-500">Your role in this organization</p>
                </div>
              </div>
              <Chip 
                color={currentOrgMembership?.role === UserRole.OWNER ? 'success' : 'primary'} 
                size="sm" 
                variant="flat"
              >
                {currentOrgMembership?.role === UserRole.OWNER ? 'Full Access' : 'Limited Access'}
              </Chip>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Organization Settings Component */}
      <OrganizationSettings
        currentOrgName={activeOrgName || ''}
        canRenameOrg={canRenameOrg}
        onOrgRenamed={handleOrgRenamed}
      />

      {/* Permission Notice */}
      {!canRenameOrg && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-3 text-warning">
              <Icon icon="lucide:info" className="h-5 w-5" />
              <div>
                <p className="font-medium">Limited Access</p>
                <p className="text-sm">
                  You need OWNER or ADMIN role to rename this organization. Contact your organization administrator for access.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
