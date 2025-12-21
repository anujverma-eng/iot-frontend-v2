// src/components/phone-input.tsx
import React, { useState } from 'react';
import { Input, Chip, Button, Select, SelectItem } from '@heroui/react';
import { Icon } from '@iconify/react';

interface PhoneInputProps {
  label?: string;
  helperText?: string;
  phoneNumbers: string[];
  onAddPhone: (phone: string) => boolean;
  onRemovePhone: (phone: string) => void;
  maxPhones?: number;
}

// Phone validation for US and India
const COUNTRY_CODES = [
  { code: '+1', country: 'US', flag: '🇺🇸', format: '+1 (XXX) XXX-XXXX', length: 10 },
  // { code: '+91', country: 'IN', flag: '🇮🇳', format: '+91 XXXXX XXXXX', length: 10 }
];

export const PhoneInput: React.FC<PhoneInputProps> = ({
  label = "Phone Numbers",
  helperText,
  phoneNumbers,
  onAddPhone,
  onRemovePhone,
  maxPhones = 5
}) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('+1');
  const [error, setError] = useState('');

  const isValidPhone = (phone: string): boolean => {
    // Remove all non-digit characters for validation
    const digits = phone.replace(/\D/g, '');
    
    // Check if it starts with country code
    if (phone.startsWith('+1')) {
      // US NANP Validation: +1 followed by 10 digits (total 11 digits)
      // Format: +1 (NXX) NXX-XXXX
      // Rules:
      // - Area code (NXX): First digit 2-9, second digit 0-9, third digit 0-9
      // - Central office code (NXX): First digit 2-9, second digit 0-9, third digit 0-9
      // - Line number (XXXX): Any 4 digits
      if (digits.length !== 11 || !digits.startsWith('1')) {
        return false;
      }
      
      const areaCode = digits.substring(1, 4);
      const centralOffice = digits.substring(4, 7);
      const lineNumber = digits.substring(7, 11);
      
      // Area code validation: first digit 2-9
      if (areaCode[0] < '2' || areaCode[0] > '9') {
        return false;
      }
      
      // Central office code validation: first digit 2-9
      if (centralOffice[0] < '2' || centralOffice[0] > '9') {
        return false;
      }
      
      // Valid US number
      return /^\d{3}$/.test(areaCode) && /^\d{3}$/.test(centralOffice) && /^\d{4}$/.test(lineNumber);
      
    } else if (phone.startsWith('+91')) {
      // India: +91 followed by 10 digits (total 12 digits)
      // Format: +91 XXXXX XXXXX (starts with 6-9)
      return digits.length === 12 && digits.startsWith('91') && /^91[6-9]\d{9}$/.test(digits);
    }
    
    return false;
  };

  const formatPhoneNumber = (value: string, countryCode: string): string => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    if (countryCode === '+1') {
      // US format: +1 (XXX) XXX-XXXX
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    } else if (countryCode === '+91') {
      // India format: +91 XXXXX XXXXX
      if (digits.length <= 5) return digits;
      return `${digits.slice(0, 5)} ${digits.slice(5, 10)}`;
    }
    
    return digits;
  };

  const handleAddPhone = () => {
    setError('');
    
    if (!inputValue.trim()) return;

    if (phoneNumbers.length >= maxPhones) {
      setError(`Maximum ${maxPhones} phone numbers allowed`);
      return;
    }

    // Format the complete phone number with country code
    const digits = inputValue.replace(/\D/g, '');
    const fullPhone = `${selectedCountry}${digits}`;

    if (!isValidPhone(fullPhone)) {
      const country = COUNTRY_CODES.find(c => c.code === selectedCountry);
      if (country?.code === '+1') {
        setError(`Invalid US number. Area code and exchange must start with 2-9 (10 digits required)`);
      } else {
        setError(`Please enter a valid ${country?.country} phone number (${country?.length} digits). Must start with 6-9`);
      }
      return;
    }

    if (phoneNumbers.includes(fullPhone)) {
      setError('This phone number has already been added');
      return;
    }

    const success = onAddPhone(fullPhone);
    if (success) {
      setInputValue('');
    } else {
      setError(`Maximum ${maxPhones} phone numbers allowed`);
    }
  };

  const handleInputChange = (value: string) => {
    const formatted = formatPhoneNumber(value, selectedCountry);
    setInputValue(formatted);
    setError('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPhone();
    }
  };

  const getCountryInfo = (code: string) => {
    return COUNTRY_CODES.find(c => c.code === code);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {/* <Select
          label="Country"
          selectedKeys={[selectedCountry]}
          onChange={(e) => {
            setSelectedCountry(e.target.value);
            setInputValue('');
            setError('');
          }}
          className="w-32"
          variant="bordered"
          size="sm"
        >
          {COUNTRY_CODES.map((country) => (
            <SelectItem key={country.code}>
              {country.flag} {country.code}
            </SelectItem>
          ))}
        </Select> */}

        <Input
          label={label}
          placeholder={getCountryInfo(selectedCountry)?.format || 'Enter phone number'}
          value={inputValue}
          onValueChange={handleInputChange}
          onKeyPress={handleKeyPress}
          variant="bordered"
          type="tel"
          errorMessage={error}
          isInvalid={!!error}
          isDisabled={phoneNumbers.length >= maxPhones}
          className="flex-1"
          endContent={
            <Button
              size="sm"
              color="primary"
              variant="flat"
              onPress={handleAddPhone}
              isDisabled={!inputValue.trim() || phoneNumbers.length >= maxPhones}
              className="min-w-0 px-3"
            >
              Add
            </Button>
          }
          startContent={
            <Icon icon="lucide:phone" className="text-default-400" width={18} />
          }
        />
      </div>

      {helperText && (
        <p className="text-sm text-default-500">{helperText}</p>
      )}

      {phoneNumbers.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {phoneNumbers.map((phone) => (
            <Chip
              key={phone}
              onClose={() => onRemovePhone(phone)}
              variant="flat"
              color="primary"
              size="sm"
            >
              {phone}
            </Chip>
          ))}
        </div>
      )}

      {phoneNumbers.length > 0 && (
        <p className="text-sm text-default-400">
          {phoneNumbers.length} / {maxPhones} phone number{phoneNumbers.length !== 1 ? 's' : ''} added
        </p>
      )}
    </div>
  );
};
