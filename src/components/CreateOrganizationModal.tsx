// src/components/CreateOrganizationModal.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Spinner,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { createOrgAndActivate } from '../store/activeOrgSlice';

const createOrgSchema = z.object({
  orgName: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(50, 'Organization name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Organization name can only contain letters, numbers, spaces, hyphens, and underscores'),
});

type CreateOrgFormValues = z.infer<typeof createOrgSchema>;

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const dispatch = useAppDispatch();
  const [isCreating, setIsCreating] = React.useState(false);

  const form = useForm<CreateOrgFormValues>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      orgName: '',
    },
  });

  const handleCreateOrg = async (data: CreateOrgFormValues) => {
    setIsCreating(true);
    try {
      // Create org and activate it - this handles everything
      await dispatch(createOrgAndActivate(data.orgName)).unwrap();

      // Reset form and close modal
      form.reset();
      onClose();
      
      // Call success callback if provided
      onSuccess?.();
      
    } catch (error: any) {
      // Error handling is done by the toast in the calling component
      console.error('Failed to create organization:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose}
      size="md"
      classNames={{
        backdrop: "bg-black/80 backdrop-blur-sm",
        base: "border border-border bg-background",
      }}
    >
      <ModalContent>
        <form onSubmit={form.handleSubmit(handleCreateOrg)}>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:building" className="text-2xl text-primary" />
              <h2 className="text-xl font-semibold">Create Organization</h2>
            </div>
            <p className="text-sm text-foreground-600 font-normal">
              Create your own organization to manage sensors and gateways
            </p>
          </ModalHeader>
          
          <ModalBody>
            <div className="space-y-4">
              <Input
                {...form.register('orgName')}
                label="Organization Name"
                placeholder="Enter organization name"
                isInvalid={!!form.formState.errors.orgName}
                errorMessage={form.formState.errors.orgName?.message}
                isDisabled={isCreating}
                autoFocus
              />
            </div>
          </ModalBody>

          <ModalFooter>
            <Button 
              variant="light" 
              onPress={handleClose}
              isDisabled={isCreating}
            >
              Cancel
            </Button>
            <Button 
              color="primary" 
              type="submit"
              isLoading={isCreating}
              spinner={<Spinner size="sm" />}
            >
              {isCreating ? 'Creating...' : 'Create Organization'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
