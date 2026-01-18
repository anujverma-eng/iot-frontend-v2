import React, { useEffect, useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Spinner,
  addToast,
  Chip,
  Divider,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchProfile } from '../store/profileSlice';
import { UserService } from '../api/user.service';
import { start, clear } from '../store/confirmationSlice';
import { ConfirmBlock } from '../components/ConfirmBlock';
import { extractErrorMessage } from '../utils/errorUtils';

// Validation schemas
const profileSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  countryCode: z.string().optional(),
  phoneNumber: z.string().optional(),
  companyName: z.string().optional(),
});

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type EmailFormData = z.infer<typeof emailSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function MyProfilePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const profile = useAppSelector((state) => state.profile);
  const confirmationState = useAppSelector((state) => state.confirmation);
  
  // Check if user is in email verification mode
  const isEmailVerificationMode = confirmationState.flow === 'email-change';
  
  // State management
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');
  
  // Security section state
  const [isPasswordUpdating, setIsPasswordUpdating] = useState(false);
  const [passwordUpdateError, setPasswordUpdateError] = useState('');
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Modal controls
  const { isOpen: isEmailModalOpen, onOpen: onEmailModalOpen, onClose: onEmailModalClose } = useDisclosure();
  
  // Form setup
  const {
    control: profileControl,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
    formState: { errors: profileErrors }
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: '',
      countryCode: '',
      phoneNumber: '',
      companyName: '',
    }
  });

  const {
    control: emailControl,
    handleSubmit: handleEmailSubmit,
    reset: resetEmail,
    formState: { errors: emailErrors }
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    }
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPassword,
    watch: watchPassword,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const newPassword = watchPassword('newPassword');

  const getPasswordStrength = (password: string) => {
    if (!password) return { score: 0, label: '', color: 'default' };

    let score = 0;
    const checks = [
      { regex: /.{8,}/, label: 'At least 8 characters' },
      { regex: /[a-z]/, label: 'Lowercase letter' },
      { regex: /[A-Z]/, label: 'Uppercase letter' },
      { regex: /[0-9]/, label: 'Number' },
      { regex: /[^a-zA-Z0-9]/, label: 'Special character' },
    ];

    checks.forEach(check => {
      if (check.regex.test(password)) score++;
    });

    if (score < 2) return { score, label: 'Very Weak', color: 'danger' };
    if (score < 3) return { score, label: 'Weak', color: 'warning' };
    if (score < 4) return { score, label: 'Good', color: 'primary' };
    if (score < 5) return { score, label: 'Strong', color: 'success' };
    return { score, label: 'Very Strong', color: 'success' };
  };

  const passwordStrength = getPasswordStrength(newPassword || '');

  const passwordRequirements = [
    { regex: /.{8,}/, label: 'At least 8 characters', met: /.{8,}/.test(newPassword || '') },
    { regex: /[a-z]/, label: 'One lowercase letter', met: /[a-z]/.test(newPassword || '') },
    { regex: /[A-Z]/, label: 'One uppercase letter', met: /[A-Z]/.test(newPassword || '') },
    { regex: /[0-9]/, label: 'One number', met: /[0-9]/.test(newPassword || '') },
    { regex: /[^a-zA-Z0-9]/, label: 'One special character', met: /[^a-zA-Z0-9]/.test(newPassword || '') },
  ];

  // Load profile data on mount
  useEffect(() => {
    if (!profile.loaded) {
      dispatch(fetchProfile());
    }
  }, [dispatch, profile.loaded]);

  // Update form when profile data loads
  useEffect(() => {
    if (profile.data?.user) {
      resetProfile({
        fullName: profile.data.user.fullName || '',
        countryCode: profile.data.user.countryCode || '',
        phoneNumber: profile.data.user.phoneNumber || '',
        companyName: profile.data.user.companyName || '',
      });
    }
  }, [profile.data?.user, resetProfile]);

  // Check for pending email verification on mount
  useEffect(() => {
    const checkPendingVerification = async () => {
      try {
        const pendingCheck = await UserService.checkPendingEmailVerification();
        if (pendingCheck.hasPending && pendingCheck.pendingEmail) {
          // Resume email verification flow
          dispatch(start({
            flow: 'email-change',
            email: profile.data?.user?.email || '',
            pendingEmail: pendingCheck.pendingEmail
          }));
        }
      } catch (error) {
        console.error('Failed to check pending verification:', error);
      }
    };

    if (profile.data?.user?.email && !isEmailVerificationMode) {
      checkPendingVerification();
    }
  }, [profile.data?.user?.email, dispatch, isEmailVerificationMode]);

  // Handle profile update
  const handleProfileUpdate = async (data: ProfileFormData) => {
    try {
      setIsUpdating(true);
      setUpdateError('');
      setUpdateSuccess('');
      
      const response = await UserService.updateProfile({
        fullName: data.fullName,
        countryCode: data.countryCode || undefined,
        phoneNumber: data.phoneNumber || undefined,
        companyName: data.companyName || undefined,
      });
      
      if (response.success) {
        await dispatch(fetchProfile()).unwrap();
        setUpdateSuccess('Profile updated successfully');
        
        addToast({
          title: 'Profile Updated',
          description: 'Your profile information has been updated successfully',
          color: 'success'
        });
      }
    } catch (error: any) {
      console.error('Profile update error:', error);
      const errorMessage = extractErrorMessage(error, 'Failed to update profile');
      setUpdateError(errorMessage);
      
      addToast({
        title: 'Update Failed',
        description: errorMessage,
        color: 'danger'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle email update request
  const handleEmailUpdate = async (data: EmailFormData) => {
    try {
      setIsUpdating(true);
      setUpdateError('');
      
      // Check if it's the same email
      if (data.email === profile.data?.user?.email) {
        setUpdateError('Please enter a different email address');
        return;
      }
      
      // Request email change
      await UserService.requestEmailChange(data.email);
      
      // Start confirmation flow
      dispatch(start({
        flow: 'email-change',
        email: profile.data?.user?.email || '',
        pendingEmail: data.email
      }));
      
      onEmailModalClose();
      resetEmail();
      
      addToast({
        title: 'Verification Code Sent',
        description: `A 6-digit verification code has been sent to ${data.email}`,
        color: 'success'
      });
    } catch (error: any) {
      console.error('Email update request error:', error);
      
      // Use centralized error extraction utility
      const errorMessage = extractErrorMessage(error, 'Failed to request email change');
      
      setUpdateError(errorMessage);
      
      addToast({
        title: 'Email Change Failed',
        description: errorMessage,
        color: 'danger'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle successful email verification
  const handleEmailVerificationSuccess = async () => {
    try {
      setIsUpdating(true);
      
      // With the new Cognito configuration, the email has been automatically
      // updated after successful verification. Now we need to get the new email
      // from Cognito and update it in the backend.
      
      // Get the new verified email from Cognito
      const newVerifiedEmail = await UserService.getCurrentVerifiedEmail();
      
      if (!newVerifiedEmail) {
        throw new Error('Could not retrieve verified email from Cognito');
      }
      
      // Update email in backend database
      const response = await UserService.updateProfile({ 
        email: newVerifiedEmail 
      });
      
      if (response.success) {
        // Refresh profile data to reflect the change everywhere
        await dispatch(fetchProfile()).unwrap();
        
        // Clear confirmation state
        dispatch(clear());
        
        addToast({
          title: 'Email Updated',
          description: 'Your email address has been successfully updated and verified',
          color: 'success'
        });
      } else {
        throw new Error('Failed to update email in backend');
      }
      
    } catch (error: any) {
      console.error('Email verification completion error:', error);
      addToast({
        title: 'Update Failed',
        description: extractErrorMessage(error, 'Failed to complete email update'),
        color: 'danger'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle canceling email verification
  const handleCancelEmailVerification = async () => {
    try {
      setIsUpdating(true);
      
      // Cancel the email change process (this will revert the email back to original)
      await UserService.cancelEmailChange();
      
      // Clear confirmation state
      dispatch(clear());
      
      // Refresh profile to get current state
      await dispatch(fetchProfile()).unwrap();
      
      addToast({
        title: 'Email Change Cancelled',
        description: 'Your email change has been cancelled',
        color: 'warning'
      });
      
    } catch (error: any) {
      console.error('Cancel email change error:', error);
      
      // Even if cancellation fails, clear local state
      dispatch(clear());
      
      addToast({
        title: 'Email Change Cancelled',
        description: 'Email change cancelled. Please check your current email status.',
        color: 'warning'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle opening email modal
  const handleOpenEmailModal = () => {
    setUpdateError('');
    resetEmail({ email: '' }); // Don't pre-populate with current email
    onEmailModalOpen();
  };

  // Handle password change
  const handlePasswordChange = async (data: PasswordFormData) => {
    setIsPasswordUpdating(true);
    setPasswordUpdateError('');
    setPasswordUpdateSuccess('');

    try {
      await UserService.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      
      setPasswordUpdateSuccess('Password changed successfully!');
      resetPassword();
      
      addToast({
        title: 'Password Changed',
        description: 'Your password has been changed successfully',
        color: 'success'
      });
    } catch (error: any) {
      console.error('Password change error:', error);
      
      let errorMessage = 'Failed to change password';
      
      if (error?.message) {
        if (error.message.includes('NotAuthorizedException')) {
          errorMessage = 'Current password is incorrect';
        } else if (error.message.includes('InvalidPasswordException')) {
          errorMessage = 'New password does not meet requirements';
        } else if (error.message.includes('LimitExceededException')) {
          errorMessage = 'Too many attempts. Please try again later';
        } else {
          errorMessage = error.message;
        }
      }
      
      setPasswordUpdateError(errorMessage);
    } finally {
      setIsPasswordUpdating(false);
    }
  };

  if (profile.loading || !profile.loaded) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  // Show email verification flow if active
  if (isEmailVerificationMode) {
    return (
      <div className="container mx-auto max-w-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Icon icon="lucide:user" className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Email Verification</h1>
        </div>

        <Card>
          <CardBody className="space-y-6">
            <div className="text-center space-y-2">
              <Icon icon="lucide:mail-check" className="h-12 w-12 mx-auto text-primary" />
              <h2 className="text-xl font-semibold">Verify Your New Email</h2>
              <p className="text-default-500">
                You're changing your email from <strong>{confirmationState.email}</strong> to{' '}
                <strong>{confirmationState.pendingEmail}</strong>
              </p>
            </div>

            <ConfirmBlock onSuccess={handleEmailVerificationSuccess} />

            <div className="flex gap-2 justify-center">
              <Button
                variant="light"
                color="danger"
                onPress={handleCancelEmailVerification}
                isLoading={isUpdating}
              >
                Cancel Email Change
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-8xl p-6 space-y-6">
      {/* Back Navigation */}
      {/* <div className="flex items-center gap-2">
        <Button
          variant="light"
          size="sm"
          startContent={<Icon icon="lucide:arrow-left" className="h-4 w-4" />}
          onPress={() => navigate(-1)}
        >
          Back
        </Button>
        <Icon icon="lucide:chevron-right" className="h-4 w-4 text-default-400" />
        <span className="text-sm text-default-500">My Profile</span>
      </div> */}

      <div className="flex items-center gap-2 mb-6">
        <Icon icon="lucide:user" className="h-6 w-6" />
        <h1 className="text-2xl font-bold">My Profile</h1>
      </div>

      {/* Profile Information Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Profile Information</h2>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleProfileSubmit(handleProfileUpdate)} className="space-y-4">
            <Controller
              name="fullName"
              control={profileControl}
              render={({ field }) => (
                <Input
                  {...field}
                  label="Full Name"
                  placeholder="Enter your full name"
                  variant="bordered"
                  startContent={<Icon icon="lucide:user" className="text-default-400" />}
                  isInvalid={!!profileErrors.fullName}
                  errorMessage={profileErrors.fullName?.message}
                />
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Controller
                name="countryCode"
                control={profileControl}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="Country Code"
                    placeholder="+1"
                    variant="bordered"
                    startContent={<Icon icon="lucide:flag" className="text-default-400" />}
                    isInvalid={!!profileErrors.countryCode}
                    errorMessage={profileErrors.countryCode?.message}
                  />
                )}
              />

              <div className="md:col-span-2">
                <Controller
                  name="phoneNumber"
                  control={profileControl}
                  render={({ field }) => (
                    <Input
                      {...field}
                      label="Phone Number"
                      placeholder="Enter your phone number"
                      variant="bordered"
                      startContent={<Icon icon="lucide:phone" className="text-default-400" />}
                      isInvalid={!!profileErrors.phoneNumber}
                      errorMessage={profileErrors.phoneNumber?.message}
                    />
                  )}
                />
              </div>
            </div>

            <Controller
              name="companyName"
              control={profileControl}
              render={({ field }) => (
                <Input
                  {...field}
                  label="Company Name"
                  placeholder="Enter your company name"
                  variant="bordered"
                  startContent={<Icon icon="lucide:building-2" className="text-default-400" />}
                  isInvalid={!!profileErrors.companyName}
                  errorMessage={profileErrors.companyName?.message}
                />
              )}
            />

            {updateError && (
              <div className="flex items-center gap-2 text-danger text-sm">
                <Icon icon="lucide:x-circle" className="h-4 w-4" />
                <span>{updateError}</span>
              </div>
            )}

            {updateSuccess && (
              <div className="flex items-center gap-2 text-success text-sm">
                <Icon icon="lucide:check-circle" className="h-4 w-4" />
                <span>{updateSuccess}</span>
              </div>
            )}

            <Button
              type="submit"
              color="primary"
              isLoading={isUpdating}
              className="w-full md:w-auto"
            >
              Update Profile
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Email Settings Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Email Settings</h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-default-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Icon icon="lucide:mail" className="h-5 w-5 text-default-400" />
                <div>
                  <p className="font-medium">{profile.data?.user?.email}</p>
                  <p className="text-sm text-default-500">Primary email address</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Chip color="success" size="sm" variant="flat">
                  Verified
                </Chip>
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={handleOpenEmailModal}
                >
                  Change Email
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Phone Number Settings Card */}
      {/* <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Phone Number</h2>
            <p className="text-sm text-default-500">Your contact phone number</p>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-default-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Icon icon="lucide:phone" className="h-5 w-5 text-default-400" />
                <div>
                  {profile.data?.user?.phoneNumber && profile.data?.user?.countryCode ? (
                    <>
                      <p className="font-medium">
                        {profile.data.user.countryCode} {profile.data.user.phoneNumber}
                      </p>
                      <p className="text-sm text-default-500">Phone number</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-default-400">NOT SET</p>
                      <p className="text-sm text-default-500">No phone number configured</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {profile.data?.user?.phoneNumber && profile.data?.user?.countryCode ? (
                  <Chip color="success" size="sm" variant="flat">
                    Set
                  </Chip>
                ) : (
                  <Chip color="default" size="sm" variant="flat">
                    Not Set
                  </Chip>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card> */}

      {/* Security Section - Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon icon="lucide:shield" className="h-5 w-5" />
            <div>
              <h2 className="text-xl font-semibold">Security</h2>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-6">
          {/* Success/Error Messages */}
          {passwordUpdateSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success">
              <Icon icon="lucide:check-circle" className="h-5 w-5" />
              <span>{passwordUpdateSuccess}</span>
            </div>
          )}

          {passwordUpdateError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 text-danger">
              <Icon icon="lucide:x-circle" className="h-5 w-5" />
              <span>{passwordUpdateError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit(handlePasswordChange)} className="space-y-4">
            {/* Current Password */}
            <Input
              label="Current Password"
              placeholder="Enter your current password"
              variant="bordered"
              type={showCurrentPassword ? 'text' : 'password'}
              startContent={<Icon icon="lucide:lock" className="text-default-400" />}
              endContent={
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  <Icon
                    icon={showCurrentPassword ? 'lucide:eye-off' : 'lucide:eye'}
                    className="text-default-400"
                  />
                </Button>
              }
              {...registerPassword('currentPassword')}
              isInvalid={!!passwordErrors.currentPassword}
              errorMessage={passwordErrors.currentPassword?.message}
            />

            <Divider />

            {/* New Password */}
            <div className="space-y-2">
              <Input
                label="New Password"
                placeholder="Enter your new password"
                variant="bordered"
                type={showNewPassword ? 'text' : 'password'}
                startContent={<Icon icon="lucide:key" className="text-default-400" />}
                endContent={
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <Icon
                      icon={showNewPassword ? 'lucide:eye-off' : 'lucide:eye'}
                      className="text-default-400"
                    />
                  </Button>
                }
                {...registerPassword('newPassword')}
                isInvalid={!!passwordErrors.newPassword}
                errorMessage={passwordErrors.newPassword?.message}
              />

              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-default-500">Password Strength:</span>
                    <span className={`text-sm font-medium text-${passwordStrength.color}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="w-full bg-default-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full bg-${passwordStrength.color} transition-all duration-300`}
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Password Requirements */}
              {newPassword && (
                <div className="space-y-1">
                  <p className="text-sm text-default-500">Password Requirements:</p>
                  <div className="grid grid-cols-1 gap-1">
                    {passwordRequirements.map((req, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Icon
                          icon={req.met ? 'lucide:check' : 'lucide:x'}
                          className={`h-3 w-3 ${req.met ? 'text-success' : 'text-default-400'}`}
                        />
                        <span className={`text-xs ${req.met ? 'text-success' : 'text-default-500'}`}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <Input
              label="Confirm New Password"
              placeholder="Confirm your new password"
              variant="bordered"
              type={showConfirmPassword ? 'text' : 'password'}
              startContent={<Icon icon="lucide:key" className="text-default-400" />}
              endContent={
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Icon
                    icon={showConfirmPassword ? 'lucide:eye-off' : 'lucide:eye'}
                    className="text-default-400"
                  />
                </Button>
              }
              {...registerPassword('confirmPassword')}
              isInvalid={!!passwordErrors.confirmPassword}
              errorMessage={passwordErrors.confirmPassword?.message}
            />

            <Button
              type="submit"
              color="primary"
              isLoading={isPasswordUpdating}
              startContent={!isPasswordUpdating && <Icon icon="lucide:save" />}
              className="w-full sm:w-auto"
            >
              Change Password
            </Button>
          </form>

          <Divider />

          {/* Security Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">Password Security Tips</h3>
              <ul className="text-sm text-default-600 space-y-1 ml-4">
                <li>• Use a unique password for this account</li>
                <li>• Don't share your password with anyone</li>
                <li>• Consider using a password manager</li>
                <li>• Change your password if you suspect it's been compromised</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium">Account Security</h3>
              <p className="text-sm text-default-600">
                Your account is secured with AWS Cognito authentication. All password changes
                are processed securely and your passwords are never stored in plain text.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Email Change Modal */}
      <Modal isOpen={isEmailModalOpen} onClose={onEmailModalClose} placement="center">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <Icon icon="lucide:mail" className="h-5 w-5" />
              Change Email Address
            </div>
          </ModalHeader>
          
          <form onSubmit={handleEmailSubmit(handleEmailUpdate)}>
            <ModalBody className="space-y-4">
              <p className="text-sm text-default-500">
                Enter your new email address. You'll receive a verification code to confirm the change.
              </p>
              
              <Controller
                name="email"
                control={emailControl}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="New Email Address"
                    placeholder="Enter new email"
                    variant="bordered"
                    type="email"
                    startContent={<Icon icon="lucide:mail" className="text-default-400" />}
                    isInvalid={!!emailErrors.email}
                    errorMessage={emailErrors.email?.message}
                  />
                )}
              />

              {updateError && (
                <div className="flex items-center gap-2 text-danger text-sm">
                  <Icon icon="lucide:x-circle" className="h-4 w-4" />
                  <span>{updateError}</span>
                </div>
              )}
            </ModalBody>
            
            <ModalFooter>
              <Button
                variant="light"
                onPress={onEmailModalClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="primary"
                isLoading={isUpdating}
              >
                Send Verification Code
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
