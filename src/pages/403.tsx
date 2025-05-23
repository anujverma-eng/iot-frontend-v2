import React from "react";
import { Button, Link } from "@heroui/react";
import { Link as RouterLink } from "react-router-dom";
import { Icon } from "@iconify/react";

export function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6">
        <div className="relative">
          <Icon
            icon="lucide:shield-off"
            className="w-32 h-32 mx-auto text-danger-500"
          />
        </div>
        
        <h1 className="text-4xl font-bold text-foreground">403 - Access Denied</h1>
        <p className="text-large text-default-500 max-w-md mx-auto">
          You don't have permission to access this resource. Please contact your administrator for assistance.
        </p>
        
        <div className="flex gap-4 justify-center">
          <Button
            as={RouterLink}
            to="/"
            color="primary"
            variant="flat"
            startContent={<Icon icon="lucide:home" />}
          >
            Return Home
          </Button>
          <Button
            as={Link}
            href="mailto:support@motionics.com"
            color="primary"
            startContent={<Icon icon="lucide:mail" />}
          >
            Contact Support
          </Button>
        </div>
      </div>
    </div>
  );
}