import React from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Chip,
  Button,
  Breadcrumbs,
  BreadcrumbItem,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { useBreadcrumbNavigation } from '../hooks/useBreadcrumbNavigation';
import { OrganizationPreferences } from '../components/OrganizationPreferences';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { getPageBreadcrumb } = useBreadcrumbNavigation();

  // Get breadcrumb items
  const breadcrumbItems = getPageBreadcrumb('Settings', 'lucide:settings');

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Header with Breadcrumbs */}
      <div className="flex flex-col gap-4">
        <Breadcrumbs className="mb-2">
          {breadcrumbItems.map((item, index) => (
            <BreadcrumbItem 
              key={index}
              onPress={item.action}
              className={index === 0 ? "cursor-pointer hover:text-primary transition-colors" : ""}
              title={index === 0 ? `Go back to ${item.label}` : undefined}
            >
              <Icon icon={item.icon} className="w-4 h-4 mr-1" />
              {item.label}
            </BreadcrumbItem>
          ))}
        </Breadcrumbs>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-default-500 mt-1">
              Configure your personal preferences and account settings
            </p>
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="grid gap-6">
        {/* Organization Settings Notice */}
        {/* <Card className="shadow-sm border border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon icon="lucide:building" className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-foreground">Organization Settings</h2>
                <p className="text-sm text-default-500">
                  Sensor monitoring and organization management settings have been moved
                </p>
              </div>
              <Button
                color="primary"
                variant="flat"
                onPress={() => navigate('/dashboard/organization')}
                endContent={<Icon icon="lucide:arrow-right" className="w-4 h-4" />}
              >
                Go to Organization
              </Button>
            </div>
          </CardHeader>
          <Divider />
          <CardBody className="gap-4">
            <div className="flex items-start gap-3">
              <Icon icon="lucide:info" className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-primary mb-2">Settings have been reorganized</h4>
                <ul className="text-sm text-default-600 space-y-2">
                  <li className="flex items-center gap-2">
                    <Icon icon="lucide:activity" className="w-4 h-4 text-default-400" />
                    <span><strong>Sensor offline detection</strong> is now in Organization Management</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon icon="lucide:edit" className="w-4 h-4 text-default-400" />
                    <span><strong>Organization rename</strong> is now in Organization Management</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon icon="lucide:user" className="w-4 h-4 text-default-400" />
                    <span><strong>Personal preferences</strong> remain here in Settings</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card> */}

        {/* Organization Preferences */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon icon="lucide:building" className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Organization Preferences</h2>
                <p className="text-sm text-default-500">
                  Manage how you interact with multiple organizations
                </p>
              </div>
            </div>
          </CardHeader>
          <Divider />
          <CardBody className="gap-6">
            <OrganizationPreferences />
          </CardBody>
        </Card>

        {/* Future Settings Sections */}
        <Card className="shadow-sm opacity-60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-default-100 rounded-lg">
                <Icon icon="lucide:bell" className="w-5 h-5 text-default-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-default-400">Notifications</h2>
                <p className="text-sm text-default-400">
                  Configure alerts and notification preferences
                </p>
              </div>
              <Chip size="sm" variant="flat" color="default">
                Coming Soon
              </Chip>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm opacity-60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-default-100 rounded-lg">
                <Icon icon="lucide:palette" className="w-5 h-5 text-default-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-default-400">Appearance</h2>
                <p className="text-sm text-default-400">
                  Customize theme, colors, and display preferences
                </p>
              </div>
              <Chip size="sm" variant="flat" color="default">
                Coming Soon
              </Chip>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};
