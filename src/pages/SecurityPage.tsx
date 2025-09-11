// src/pages/SecurityPage.tsx
import React, { useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Divider,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { UserService } from '../api/user.service';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';

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

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function SecurityPage() {
  const navigate = useNavigate();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const newPassword = watch('newPassword');

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

  const handlePasswordChange = async (data: PasswordFormData) => {
    setIsUpdating(true);
    setUpdateError('');
    setUpdateSuccess('');

    try {
      await UserService.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      
      setUpdateSuccess('Password changed successfully!');
      reset();
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
      
      setUpdateError(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const passwordRequirements = [
    { regex: /.{8,}/, label: 'At least 8 characters', met: /.{8,}/.test(newPassword || '') },
    { regex: /[a-z]/, label: 'One lowercase letter', met: /[a-z]/.test(newPassword || '') },
    { regex: /[A-Z]/, label: 'One uppercase letter', met: /[A-Z]/.test(newPassword || '') },
    { regex: /[0-9]/, label: 'One number', met: /[0-9]/.test(newPassword || '') },
    { regex: /[^a-zA-Z0-9]/, label: 'One special character', met: /[^a-zA-Z0-9]/.test(newPassword || '') },
  ];

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
        <span className="text-sm text-default-500">Security Settings</span>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Icon icon="lucide:shield" className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Security Settings</h1>
      </div>

      {/* Success/Error Messages */}
      {updateSuccess && (
        <Card className="border-success bg-success/10">
          <CardBody>
            <div className="flex items-center gap-2 text-success">
              <Icon icon="lucide:check-circle" className="h-5 w-5" />
              <span>{updateSuccess}</span>
            </div>
          </CardBody>
        </Card>
      )}

      {updateError && (
        <Card className="border-danger bg-danger/10">
          <CardBody>
            <div className="flex items-center gap-2 text-danger">
              <Icon icon="lucide:x-circle" className="h-5 w-5" />
              <span>{updateError}</span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon icon="lucide:key" className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Change Password</h2>
          </div>
        </CardHeader>
        <CardBody className="space-y-6">
          <form onSubmit={handleSubmit(handlePasswordChange)} className="space-y-4">
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
              {...register('currentPassword')}
              isInvalid={!!errors.currentPassword}
              errorMessage={errors.currentPassword?.message}
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
                {...register('newPassword')}
                isInvalid={!!errors.newPassword}
                errorMessage={errors.newPassword?.message}
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
              {...register('confirmPassword')}
              isInvalid={!!errors.confirmPassword}
              errorMessage={errors.confirmPassword?.message}
            />

            <Button
              type="submit"
              color="primary"
              isLoading={isUpdating}
              startContent={!isUpdating && <Icon icon="lucide:save" />}
              className="w-full sm:w-auto"
            >
              Change Password
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Security Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon icon="lucide:info" className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Security Information</h2>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">Password Security Tips</h3>
            <ul className="text-sm text-default-600 space-y-1 ml-4">
              <li>• Use a unique password for this account</li>
              <li>• Don't share your password with anyone</li>
              <li>• Consider using a password manager</li>
              <li>• Change your password if you suspect it's been compromised</li>
            </ul>
          </div>
          
          <Divider />
          
          <div className="space-y-2">
            <h3 className="font-medium">Account Security</h3>
            <p className="text-sm text-default-600">
              Your account is secured with AWS Cognito authentication. All password changes
              are processed securely and your passwords are never stored in plain text.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
