import { Card, CardBody } from "@heroui/react";

export function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardBody className="gap-6">
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
            <div className="space-y-4">
              <section>
                <h2 className="text-xl font-semibold mb-2">1. Data Collection</h2>
                <p className="text-default-600">
                  We collect information to provide better services to our users.
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