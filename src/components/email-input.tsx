// src/components/email-input.tsx
import React, { useState } from 'react';
import { Input, Chip, Button } from '@heroui/react';
import { Icon } from '@iconify/react';

interface EmailInputProps {
  label?: string;
  helperText?: string;
  emails: string[];
  onAddEmail: (email: string) => boolean;
  onRemoveEmail: (email: string) => void;
  maxEmails?: number;
}

export const EmailInput: React.FC<EmailInputProps> = ({
  label = "Email Addresses",
  helperText,
  emails,
  onAddEmail,
  onRemoveEmail,
  maxEmails = 3
}) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddEmail = () => {
    const email = inputValue.trim().toLowerCase();
    setError('');

    if (!email) return;

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (emails.includes(email)) {
      setError('This email has already been added');
      return;
    }

    if (emails.length >= maxEmails) {
      setError(`Maximum ${maxEmails} emails allowed`);
      return;
    }

    const success = onAddEmail(email);
    if (success) {
      setInputValue('');
    } else {
      setError(`Maximum ${maxEmails} emails allowed`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Input
          label={label}
          placeholder="Enter email address"
          value={inputValue}
          onValueChange={setInputValue}
          onKeyPress={handleKeyPress}
          variant="bordered"
          type="email"
          errorMessage={error}
          isInvalid={!!error}
          endContent={
            <Button
              size="sm"
              color="primary"
              variant="flat"
              onPress={handleAddEmail}
              isDisabled={!inputValue.trim() || emails.length >= maxEmails}
              className="min-w-0 px-3"
            >
              Add
            </Button>
          }
          startContent={
            <Icon icon="lucide:mail" className="text-default-400" width={18} />
          }
        />
        {helperText && (
          <p className="text-sm text-default-500 mt-1">{helperText}</p>
        )}
      </div>

      {emails.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Added emails:</p>
          <div className="flex flex-wrap gap-2">
            {emails.map((email) => (
              <Chip
                key={email}
                onClose={() => onRemoveEmail(email)}
                variant="flat"
                color="primary"
                size="sm"
              >
                {email}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
