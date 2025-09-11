import http from "./http";
import { UserRole } from "../types/User";
import { ApiResponse, unwrapApiResponse } from "./types";
import { CognitoUser, CognitoUserPool, CognitoUserAttribute, AuthenticationDetails } from "amazon-cognito-identity-js";

export interface UserDTO {
  id: string;
  email: string;
  displayName?: string;
  fullName?: string;
  phoneNumber?: string;
  countryCode?: string;
  cognitoSub: string;
}

export interface MembershipDTO {
  orgId: string;
  orgName: string;
  role: UserRole;
  status: string;
  permissions: {
    allow: string[];
    deny: string[];
    effective: string[];
  };
}

export interface CurrentOrgDTO {
  orgId: string;
  role: UserRole;
  permissions: string[];
}

export interface MeDTO {
  user: UserDTO;
  memberships: MembershipDTO[];
  currentOrg: CurrentOrgDTO | null;
  pendingInvites: number;
}

export interface UpdateUserRequest {
  email?: string;
  fullName?: string;
  phoneNumber?: string;
  countryCode?: string;
}

export interface UpdateUserResponse {
  status: number;
  success: boolean;
  message: string;
  data: {
    user: UserDTO;
  };
  from: string;
  error: null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface MyPermissionsDTO {
  organizationId: string;
  role: string;
  permissions: string[];
}

export interface UserSettings {
  userId: string;
  defaultOrgId?: string;
  orgChoiceMode: 'remember' | 'ask-every-time';
}

export interface UpdateUserSettingsRequest {
  defaultOrgId?: string;
  orgChoiceMode?: 'remember' | 'ask-every-time';
}

export const UserService = {
  async me(): Promise<MeDTO> {
    const response = await http.get<ApiResponse<MeDTO>>("/users/me");
    return unwrapApiResponse(response.data);
  },
  async myPermissions(): Promise<MyPermissionsDTO> {
    const response = await http.get<ApiResponse<MyPermissionsDTO>>("/users/me/permissions");
    return unwrapApiResponse(response.data);
  },
  async getMySettings(): Promise<UserSettings> {
    const response = await http.get<ApiResponse<UserSettings>>("/settings/me");
    return unwrapApiResponse(response.data);
  },
  async updateMySettings(request: UpdateUserSettingsRequest, orgId?: string): Promise<UserSettings> {
    const config = orgId ? { headers: { 'X-Org-Id': orgId } } : {};
    const response = await http.put<ApiResponse<UserSettings>>("/settings/me", request, config);
    return unwrapApiResponse(response.data);
  },
  async updateProfile(request: UpdateUserRequest): Promise<UpdateUserResponse> {
    const response = await http.put<UpdateUserResponse>("/users/me", request);
    return response.data;
  },
  async changePassword(request: ChangePasswordRequest): Promise<void> {
    // Use Cognito directly for password change
    return new Promise((resolve, reject) => {
      const pool = new CognitoUserPool({
        UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
      });
      
      const cognitoUser = pool.getCurrentUser();
      if (!cognitoUser) {
        reject(new Error("No authenticated user"));
        return;
      }

      cognitoUser.getSession((err: any, session: any) => {
        if (err) {
          reject(err);
          return;
        }

        cognitoUser.changePassword(
          request.currentPassword,
          request.newPassword,
          (err: any) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });
    });
  },
  async requestEmailChange(newEmail: string): Promise<void> {
    // Use Cognito's built-in email change with verification requirement
    return new Promise((resolve, reject) => {
      const pool = new CognitoUserPool({
        UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
      });
      
      const currentUser = pool.getCurrentUser();
      if (!currentUser) {
        reject(new Error("No authenticated user"));
        return;
      }

      currentUser.getSession((err: any, session: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!session || !session.isValid()) {
          reject(new Error("Invalid session"));
          return;
        }

        // Get current user details
        currentUser.getUserAttributes((err: any, attributes: any) => {
          if (err) {
            reject(err);
            return;
          }

          const currentEmail = attributes.find((attr: any) => attr.Name === 'email')?.Value;
          
          if (!currentEmail) {
            reject(new Error("No current email found"));
            return;
          }

          if (currentEmail === newEmail) {
            reject(new Error("New email is the same as current email"));
            return;
          }

          // With AttributesRequireVerificationBeforeUpdate, this will:
          // 1. Keep old email active for login
          // 2. Send verification code to new email  
          // 3. Only update email after successful verification
          const attributeList = [
            new CognitoUserAttribute({
              Name: 'email',
              Value: newEmail,
            }),
          ];

          currentUser.updateAttributes(attributeList, (err: any, result: any) => {
            if (err) {
              if (err.code === "AliasExistsException") {
                reject(new Error("EMAIL_ALREADY_IN_USE"));
              } else {
                reject(err);
              }
              return;
            }

            // Store the email change request for UI state management
            const emailChangeState = {
              originalEmail: currentEmail, // This remains active for login
              pendingEmail: newEmail,
              timestamp: Date.now(),
            };
            
            sessionStorage.setItem('emailChangeState', JSON.stringify(emailChangeState));
            console.log('Email verification code sent to:', newEmail);
            resolve();
          });
        });
      });
    });
  },

  async checkPendingEmailVerification(): Promise<{ hasPending: boolean; pendingEmail?: string; originalEmail?: string }> {
    return new Promise((resolve, reject) => {
      // Check sessionStorage for email change state
      const emailChangeStateStr = sessionStorage.getItem('emailChangeState');
      if (!emailChangeStateStr) {
        resolve({ hasPending: false });
        return;
      }

      try {
        const emailChangeState = JSON.parse(emailChangeStateStr);
        
        // Check if the state is not too old (24 hours max)
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        if (Date.now() - emailChangeState.timestamp > maxAge) {
          sessionStorage.removeItem('emailChangeState');
          resolve({ hasPending: false });
          return;
        }

        // Verify the user still exists and has a session
        const pool = new CognitoUserPool({
          UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
          ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
        });
        
        const cognitoUser = pool.getCurrentUser();
        if (!cognitoUser) {
          sessionStorage.removeItem('emailChangeState');
          resolve({ hasPending: false });
          return;
        }

        cognitoUser.getSession((err: any, session: any) => {
          if (err) {
            sessionStorage.removeItem('emailChangeState');
            resolve({ hasPending: false });
            return;
          }

          // Check if email is verified - if yes, the change was completed
          cognitoUser.getUserAttributes((err: any, attributes: any) => {
            if (err) {
              reject(err);
              return;
            }

            const emailVerified = attributes.find((attr: any) => attr.Name === 'email_verified')?.Value === 'true';
            const currentEmail = attributes.find((attr: any) => attr.Name === 'email')?.Value;

            // If email is verified and matches pending email, change was completed
            if (emailVerified && currentEmail === emailChangeState.pendingEmail) {
              sessionStorage.removeItem('emailChangeState');
              resolve({ hasPending: false });
              return;
            }

            // Email change is still pending
            resolve({ 
              hasPending: true,
              pendingEmail: emailChangeState.pendingEmail,
              originalEmail: emailChangeState.originalEmail,
            });
          });
        });
      } catch (error) {
        sessionStorage.removeItem('emailChangeState');
        resolve({ hasPending: false });
      }
    });
  },

  async getCurrentVerifiedEmail(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const pool = new CognitoUserPool({
        UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
      });
      
      const cognitoUser = pool.getCurrentUser();
      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession((err: any, session: any) => {
        if (err) {
          reject(err);
          return;
        }

        cognitoUser.getUserAttributes((err: any, attributes: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (!attributes) {
            resolve(null);
            return;
          }

          // Find the current email and verification status
          const email = attributes.find((attr: any) => attr.Name === 'email')?.Value;
          const emailVerified = attributes.find((attr: any) => attr.Name === 'email_verified')?.Value === 'true';
          
          // Return email only if it's verified
          resolve(emailVerified ? email : null);
        });
      });
    });
  },

  async cancelEmailChange(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get email change state from sessionStorage
      const emailChangeStateStr = sessionStorage.getItem('emailChangeState');
      if (!emailChangeStateStr) {
        // No pending change to cancel
        resolve();
        return;
      }

      let emailChangeState;
      try {
        emailChangeState = JSON.parse(emailChangeStateStr);
      } catch (error) {
        // Invalid state, just clear it
        sessionStorage.removeItem('emailChangeState');
        resolve();
        return;
      }

      const pool = new CognitoUserPool({
        UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
      });

      const currentUser = pool.getCurrentUser();
      if (!currentUser) {
        // Clear sessionStorage and resolve
        sessionStorage.removeItem('emailChangeState');
        resolve();
        return;
      }

      currentUser.getSession((err: any, session: any) => {
        if (err) {
          // Clear sessionStorage and resolve
          sessionStorage.removeItem('emailChangeState');
          resolve();
          return;
        }

        if (!session || !session.isValid()) {
          // Clear sessionStorage and resolve
          sessionStorage.removeItem('emailChangeState');
          resolve();
          return;
        }

        // Revert the email back to the original email
        // This will cancel the pending email verification
        const attributeList = [
          new CognitoUserAttribute({
            Name: 'email',
            Value: emailChangeState.originalEmail,
          }),
        ];

        currentUser.updateAttributes(attributeList, (err: any, result: any) => {
          // Clear sessionStorage regardless of outcome
          sessionStorage.removeItem('emailChangeState');
          
          if (err) {
            console.warn('Could not revert email, but clearing state:', err);
          } else {
            console.log('Email change cancelled successfully');
          }
          
          resolve();
        });
      });
    });
  },

  async verifyEmailChange(verificationCode: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get email change state from sessionStorage
      const emailChangeStateStr = sessionStorage.getItem('emailChangeState');
      if (!emailChangeStateStr) {
        reject(new Error("No pending email change found"));
        return;
      }

      let emailChangeState;
      try {
        emailChangeState = JSON.parse(emailChangeStateStr);
      } catch (error) {
        sessionStorage.removeItem('emailChangeState');
        reject(new Error("Invalid email change state"));
        return;
      }

      const pool = new CognitoUserPool({
        UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
      });

      const currentUser = pool.getCurrentUser();
      if (!currentUser) {
        reject(new Error("No authenticated user"));
        return;
      }

      currentUser.getSession((err: any, session: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!session || !session.isValid()) {
          reject(new Error("Invalid session"));
          return;
        }

        // Verify the email attribute - Cognito will automatically update the email
        currentUser.verifyAttribute('email', verificationCode, {
          onSuccess: () => {
            // Clear the email change state
            sessionStorage.removeItem('emailChangeState');
            console.log('Email successfully verified and updated');
            resolve();
          },
          onFailure: (err: any) => {
            console.error('Email verification failed:', err);
            reject(err);
          },
        });
      });
    });
  },
};
