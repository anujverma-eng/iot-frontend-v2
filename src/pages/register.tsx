// src/pages/register.tsx
import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Input, Button, Link, Card, CardBody, Image } from "@heroui/react";
import { Icon } from "@iconify/react";

export function Register() {
  const [formData, setFormData] = React.useState({
    fullName: "",
    email: "",
    password: "",
    company: ""
  });

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle registration logic here
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - Hero Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary-500">
        <Image
          removeWrapper
          className="object-cover"
          src="https://img.heroui.chat/image/dashboard?w=1000&h=1000&u=2f"
          alt="IoT Dashboard"
        />
        <div className="absolute inset-0 bg-primary-500/60 flex flex-col justify-center p-12">
          <h1 className="text-white text-4xl font-bold mb-4">
            Join Motionics IoT Platform
          </h1>
          <p className="text-white/90 text-lg">
            Get started with our advanced industrial IoT solutions today.
          </p>
        </div>
      </div>

      {/* Right side - Registration Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md">
          <CardBody className="gap-4">
            <div className="flex flex-col gap-4 mb-6">
              <h2 className="text-2xl font-bold text-foreground">Create Account</h2>
              <p className="text-default-500">
                Start monitoring your industrial equipment
              </p>
            </div>

            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <Input
                label="Full Name"
                placeholder="Enter your full name"
                value={formData.fullName}
                onValueChange={(value) => setFormData({ ...formData, fullName: value })}
                startContent={
                  <Icon className="text-default-400" icon="lucide:user" width={20} />
                }
              />

              <Input
                type="email"
                label="Email"
                placeholder="Enter your email"
                value={formData.email}
                onValueChange={(value) => setFormData({ ...formData, email: value })}
                startContent={
                  <Icon className="text-default-400" icon="lucide:mail" width={20} />
                }
              />

              <Input
                label="Company Name"
                placeholder="Enter your company name"
                value={formData.company}
                onValueChange={(value) => setFormData({ ...formData, company: value })}
                startContent={
                  <Icon className="text-default-400" icon="lucide:building" width={20} />
                }
              />

              <Input
                type="password"
                label="Password"
                placeholder="Create a password"
                value={formData.password}
                onValueChange={(value) => setFormData({ ...formData, password: value })}
                startContent={
                  <Icon className="text-default-400" icon="lucide:lock" width={20} />
                }
              />

              <Button type="submit" color="primary" className="w-full">
                Create Account
              </Button>

              <p className="text-center text-default-500">
                Already have an account?{" "}
                <Link as={RouterLink} to="/dashboard" color="primary">
                  Sign in
                </Link>
              </p>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
