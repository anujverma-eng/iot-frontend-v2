import { Card, CardBody } from "@heroui/react";

export function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardBody className="gap-6">
            <h1 className="text-3xl font-bold">Terms of Service</h1>
            <div className="space-y-4">
              <section>
                <h2 className="text-xl font-semibold mb-2">1. Introduction</h2>
                <p className="text-default-600">
                  Welcome to Motionics IoT Platform. By accessing our service, you agree to these terms.
                </p>
              </section>
              {/* Add more sections as needed */}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}