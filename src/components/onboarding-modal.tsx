// src/components/onboarding-modal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Card,
  CardBody,
  CardHeader,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { createOrg } from '../store/orgSlice';
import { acceptInvite } from '../store/invitesSlice';
import { fetchProfile } from '../store/profileSlice';
import { resolveInitialActiveOrg } from '../store/activeOrgSlice';
import { EmailInput } from './email-input';
import { InvitesService } from '../api/invites.service';
import { UserRole } from '../types/User';
import { extractErrorMessage, extractErrorCode } from '../utils/errorUtils';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialStep?: 'welcome' | 'choice' | 'create' | 'join';
  isDismissable?: boolean;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialStep = 'welcome',
  isDismissable = false,
}) => {
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<'welcome' | 'choice' | 'create' | 'join'>(initialStep);
  const [orgName, setOrgName] = useState('');
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [inviteToken, setInviteToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset step when modal opens with different initialStep
  React.useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
      setError('');
    }
  }, [isOpen, initialStep]);

  const handleAddEmail = (email: string): boolean => {
    if (inviteEmails.length >= 5) {
      return false;
    }
    setInviteEmails(prev => [...prev, email]);
    return true;
  };

  const handleRemoveEmail = (email: string) => {
    setInviteEmails(prev => prev.filter(e => e !== email));
  };

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      setError('Organization name is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      
      // Create the organization first
      const orgResult = await dispatch(createOrg(orgName.trim())).unwrap();
      
      // Extract the actual organization data
      const orgData = (orgResult as any).data || orgResult;

      // Send bulk invites if emails were provided
      if (inviteEmails.length > 0 && orgData._id) {
        
        try {
          const bulkInviteData = {
            users: inviteEmails.map(email => ({
              email,
              role: UserRole.MEMBER,
            })),
          };
          
          const inviteResult = await InvitesService.bulkCreate(orgData._id, bulkInviteData);
          
          if (inviteResult.failed?.length > 0) {
          }
        } catch (inviteError: any) {
          console.error('Step 4 ERROR: Bulk invite failed:', inviteError);
          console.error('Invite error details:', {
            message: inviteError?.message,
            response: inviteError?.response?.data,
            status: inviteError?.response?.status,
          });
          
          // Organization created successfully, but invites failed
          // Don't fail the entire process if invites fail
        }
      } else {
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      
      // Use centralized error extraction utility
      const errorMessage = extractErrorMessage(err, 'Failed to create organization');
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinOrg = async () => {
    if (!inviteToken.trim()) {
      setError('Please enter an invite token');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await dispatch(acceptInvite(inviteToken.trim())).unwrap();
      
      // Refresh profile to get updated memberships
      await dispatch(fetchProfile()).unwrap();
      
      // Resolve active organization with updated profile
      await dispatch(resolveInitialActiveOrg()).unwrap();
      
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Join organization error:', err);
      
      // Use centralized error extraction utility
      const errorMessage = extractErrorMessage(err, 'Failed to join organization');
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'create' || step === 'join') {
      setStep('choice');
    } else if (step === 'choice') {
      setStep('welcome');
    }
    setError('');
  };

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-100">
                  <Icon icon="lucide:building-2" className="text-primary-600" width={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Welcome to IoT Platform</h2>
                  <p className="text-sm text-default-500">Let's get you started</p>
                </div>
              </div>
            </ModalHeader>
            <ModalBody>
              <p className="text-default-600">
                Welcome! To access the IoT Platform, you'll need to be part of an organization.
                You can either create a new organization or join an existing one.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onPress={() => setStep('choice')}>
                Get Started
              </Button>
            </ModalFooter>
          </>
        );

      case 'choice':
        return (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Choose Your Path</h2>
              <p className="text-sm text-default-500">Create or join an organization</p>
            </ModalHeader>
            <ModalBody className="space-y-4">
              <Card 
                isPressable 
                onPress={() => setStep('create')}
                className="border-2 border-transparent hover:border-primary-200 transition-colors"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-100">
                      <Icon icon="lucide:plus" className="text-primary-600" width={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Create Organization</h3>
                      <p className="text-sm text-default-500">Start fresh with a new organization</p>
                    </div>
                  </div>
                </CardHeader>
                <CardBody className="pt-0">
                  <p className="text-sm text-default-600">
                    Create your own organization and invite team members to collaborate on IoT projects.
                  </p>
                </CardBody>
              </Card>

              <Card 
                isPressable 
                onPress={() => setStep('join')}
                className="border-2 border-transparent hover:border-primary-200 transition-colors"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary-100">
                      <Icon icon="lucide:users" className="text-secondary-600" width={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Join Organization</h3>
                      <p className="text-sm text-default-500">Join an existing team</p>
                    </div>
                  </div>
                </CardHeader>
                <CardBody className="pt-0">
                  <p className="text-sm text-default-600">
                    Enter an invite token to join an existing organization and start collaborating.
                  </p>
                </CardBody>
              </Card>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={handleBack}>
                Back
              </Button>
            </ModalFooter>
          </>
        );

      case 'create':
        return (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Create Organization</h2>
              <p className="text-sm text-default-500">Set up your new organization and invite your team</p>
            </ModalHeader>
            <ModalBody className="space-y-6">
              <Input
                label="Organization Name"
                placeholder="Enter organization name"
                value={orgName}
                onValueChange={setOrgName}
                variant="bordered"
                isRequired
                startContent={
                  <Icon icon="lucide:building-2" className="text-default-400" width={18} />
                }
              />
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">Invite Team Members</h3>
                  <span className="text-xs text-default-500">(Optional)</span>
                </div>
                <EmailInput
                  label="Team Member Emails"
                  helperText="Add up to 5 team members to invite. They'll receive invitation emails after the organization is created."
                  emails={inviteEmails}
                  onAddEmail={handleAddEmail}
                  onRemoveEmail={handleRemoveEmail}
                  maxEmails={5}
                />
              </div>
              
              {error && (
                <p className="text-danger text-sm">{error}</p>
              )}
            </ModalBody>
            <ModalFooter className="justify-between">
              <Button variant="light" onPress={handleBack}>
                Back
              </Button>
              <div className="flex gap-2">
                {isDismissable && (
                  <Button variant="light" onPress={onClose}>
                    Cancel
                  </Button>
                )}
                <Button 
                  color="primary" 
                  onPress={handleCreateOrg}
                  isLoading={isLoading}
                  isDisabled={!orgName.trim()}
                >
                  Create Organization
                </Button>
              </div>
            </ModalFooter>
          </>
        );

      case 'join':
        return (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Join Organization</h2>
              <p className="text-sm text-default-500">Enter your invite token to join</p>
            </ModalHeader>
            <ModalBody className="space-y-4">
              <Input
                label="Invite Token"
                placeholder="Enter your invite token"
                value={inviteToken}
                onValueChange={setInviteToken}
                variant="bordered"
                isRequired
                description="Enter the invite token you received from your organization admin"
                startContent={
                  <Icon icon="lucide:key" className="text-default-400" width={18} />
                }
              />
              {error && (
                <p className="text-danger text-sm">{error}</p>
              )}
            </ModalBody>
            <ModalFooter className="justify-between">
              <Button variant="light" onPress={handleBack}>
                Back
              </Button>
              <div className="flex gap-2">
                {isDismissable && (
                  <Button variant="light" onPress={onClose}>
                    Cancel
                  </Button>
                )}
                <Button 
                  color="primary" 
                  onPress={handleJoinOrg}
                  isLoading={isLoading}
                  isDisabled={!inviteToken.trim()}
                >
                  Join Organization
                </Button>
              </div>
            </ModalFooter>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="lg"
      placement="center"
      backdrop="blur"
      // hideCloseButton={!isDismissable}
      isDismissable={isDismissable}
    >
      <ModalContent>
        {renderStep()}
      </ModalContent>
    </Modal>
  );
};
