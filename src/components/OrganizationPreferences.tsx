import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  RadioGroup,
  Radio,
  Select,
  SelectItem,
  Alert,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { UserService, UserSettings } from "../api/user.service";
import { selectActiveOrgId, selectActiveOrgName } from "../store/activeOrgSlice";
import { RootState } from "../store";

export const OrganizationPreferences: React.FC = () => {
  const dispatch = useDispatch();
  const activeOrgId = useSelector(selectActiveOrgId);
  const activeOrgName = useSelector(selectActiveOrgName);
  const profile = useSelector((state: RootState) => state.profile.data);

  const [orgChoiceMode, setOrgChoiceMode] = useState<"remember" | "ask-every-time">("ask-every-time");
  const [defaultOrgId, setDefaultOrgId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  // Get memberships from profile
  const memberships = profile?.memberships || [];
  const hasMultipleOrgs = memberships.length > 1;

  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const settings = await UserService.getMySettings();
        console.log("Loaded settings:", settings);
        console.log("defaultOrgId from backend:", settings.defaultOrgId, "type:", typeof settings.defaultOrgId);
        setUserSettings(settings);

        const choiceMode = settings.orgChoiceMode || "ask-every-time";
        setOrgChoiceMode(choiceMode);

        // Handle defaultOrgId - could be string or object from backend
        let defaultOrg = settings.defaultOrgId;
        if (defaultOrg && typeof defaultOrg === "object") {
          // Extract the ID from the object (MongoDB might send populated object)
          defaultOrg = (defaultOrg as any)._id || (defaultOrg as any).id || String(defaultOrg);
        }
        setDefaultOrgId(defaultOrg || "");
      } catch (err) {
        console.error("Failed to load user settings:", err);
        setError("Failed to load user settings");
      } finally {
        setIsLoading(false);
      }
    };

    loadUserSettings();
  }, []);

  const handleChoiceModeChange = (value: string) => {
    const newMode = value as "remember" | "ask-every-time";
    setOrgChoiceMode(newMode);

    // Clear default org if switching to ask-every-time
    if (newMode === "ask-every-time") {
      setDefaultOrgId("");
    }
  };

  const handleSavePreferences = async () => {
    setIsUpdating(true);
    setError(null);

    try {
      // Prepare payload - only include defaultOrgId if mode is 'remember' and we have a value
      const payload: any = {
        orgChoiceMode,
      };

      if (orgChoiceMode === "remember" && defaultOrgId) {
        payload.defaultOrgId = defaultOrgId;
      }

      const response = await UserService.updateMySettings(payload);

      if (response) {
        // Update local state
        setUserSettings(response);
        setError(null);
      } else {
        setError("Failed to update preferences");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while updating preferences");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <Icon icon="lucide:loader-2" className="w-4 h-4 animate-spin" />
          <span>Loading preferences...</span>
        </div>
      </div>
    );
  }

  if (!hasMultipleOrgs) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-medium">Organization Preferences</h2>
          </CardHeader>
          <CardBody>
            <div className="text-center py-6">
              <Icon icon="lucide:building" className="w-12 h-12 mx-auto text-default-300 mb-4" />
              <p className="text-default-500 mb-2">
                You currently belong to only one organization: <strong>{activeOrgName || "Unknown"}</strong>
              </p>
              <p className="text-sm text-default-400">
                Organization preferences will become available when you join additional organizations.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 border border-default-200 rounded-lg">
      {error && (
        <Alert
          color="danger"
          variant="flat"
          startContent={<Icon icon="lucide:alert-circle" />}
          isClosable
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <div className="space-y-4">
        <RadioGroup
          label="Organization Selection Mode"
          value={orgChoiceMode}
          onValueChange={handleChoiceModeChange}
          orientation="horizontal"
          classNames={{
            wrapper: "gap-6",
          }}
        >
          <Radio value="ask-every-time" className="max-w-none">
            <div className="flex flex-col">
              <span className="font-medium">Ask every time</span>
              <span className="text-sm text-default-500">Show organization picker on each login</span>
            </div>
          </Radio>

          <Radio value="remember" className="max-w-none">
            <div className="flex flex-col">
              <span className="font-medium">Remember my choice</span>
              <span className="text-sm text-default-500">Automatically use a default organization</span>
            </div>
          </Radio>
        </RadioGroup>

        {orgChoiceMode === "remember" && (
          <div className="border-l-2 border-primary/20 pl-4 ml-2">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-1">Default Organization</h4>
                <p className="text-xs text-default-500">
                  This organization will be selected automatically when you log in
                </p>
              </div>

              <Select
                label="Select Default Organization"
                placeholder="Choose your default organization"
                selectedKeys={defaultOrgId ? [defaultOrgId] : []}
                onSelectionChange={(keys: any) => {
                  const selectedKey = Array.from(keys)[0] as string;
                  setDefaultOrgId(selectedKey);
                }}
                renderValue={(items) => {
                  const selected = memberships.find((m: any) => m.orgId === defaultOrgId);
                  if (selected) {
                    return (
                      <div className="flex items-center gap-2">
                        <span>{selected.orgName}</span>
                        <span className="text-xs text-default-400 capitalize">({selected.role})</span>
                      </div>
                    );
                  }
                  return "Choose your default organization";
                }}
              >
                {memberships.map((membership: any) => (
                  <SelectItem key={membership.orgId}>
                    <div className="flex items-center justify-between w-full">
                      <span>{membership.orgName}</span>
                      <span className="text-xs text-default-400 capitalize">({membership.role})</span>
                    </div>
                  </SelectItem>
                ))}
              </Select>
            </div>
          </div>
        )}

        <Button
          color="primary"
          onPress={handleSavePreferences}
          isLoading={isUpdating}
          isDisabled={orgChoiceMode === "remember" && !defaultOrgId}
          className="mt-2"
        >
          Save Preferences
        </Button>
      </div>
    </div>
  );
};
