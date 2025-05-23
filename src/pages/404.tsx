import React from "react";
import { Button, Link } from "@heroui/react";
import { Link as RouterLink } from "react-router-dom";
import { Icon } from "@iconify/react";

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6">
        <div className="relative">
          <Icon
            icon="lucide:wifi-off"
            className="w-32 h-32 mx-auto text-primary-500 animate-pulse"
          />
        </div>
        
        <h1 className="text-4xl font-bold text-foreground">404 - Page Not Found</h1>
        <p className="text-large text-default-500 max-w-md mx-auto">
          Oops! It seems like the page you're looking for has disconnected from our IoT network.
        </p>
        
        <Button
          as={RouterLink}
          to="/"
          color="primary"
          variant="flat"
          startContent={<Icon icon="lucide:home" />}
        >
          Return Home
        </Button>
      </div>
    </div>
  );
}