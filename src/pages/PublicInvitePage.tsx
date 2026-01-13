// src/pages/PublicInvitePage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Spinner,
  Divider,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { useBreakpoints } from '../hooks/use-media-query';
import { InvitesService } from '../api/invites.service';
import { acceptInvite, declineInvite } from '../store/invitesSlice';
import { fetchProfile } from '../store/profileSlice';
import { selectOrgAndFinalize } from '../store/activeOrgSlice';
import { UserRole } from '../types/User';
import { EmailInput } from '../components/email-input';
import { createOrg } from '../store/orgSlice';

interface PublicInviteInfo {
  email: string;
  orgName: string;
  role: string;
  expiresAt: string;
  status: string;
  expired: boolean;
  invitedBy?: string;
}

type InvitationView = "invitation" | "create";

export const PublicInvitePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isMobile } = useBreakpoints();
  const { isOpen: isCreateModalOpen, onOpen: onCreateModalOpen, onOpenChange: onCreateModalChange } = useDisclosure();
  
  // State
  const [inviteInfo, setInviteInfo] = useState<PublicInviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'accept' | 'decline' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<InvitationView>("invitation");
  const [orgName, setOrgName] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<'accept' | 'decline' | null>(null);
  const [shouldRedirect, setShouldRedirect] = useState<boolean | null>(null); // null = undetermined, true = redirect, false = show page
  
  // User state
  const profile = useAppSelector((s) => s.profile);
  const isLoggedIn = profile.loaded && profile.data;
  
  // Get intent from URL params
  const intent = searchParams.get('intent') as 'accept' | 'decline' | null;
  
  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      setShouldRedirect(false);
      return;
    }
    
    loadInviteInfo();
  }, [token]);
  
  // Make decision once we have all the data we need
  useEffect(() => {
    
    // Don't make decision until we have invitation info
    if (!inviteInfo) {
      return;
    }

    // If we already made a decision, don't change it
    if (shouldRedirect !== null) {
      return;
    }

    // Now we have invite info, let's decide what to do based on user state
    
    // Case 1: User is clearly logged in (profile loaded and has data)
    if (profile.loaded && isLoggedIn) {
      const memberships = profile.data?.memberships || [];
      const hasExistingOrgs = memberships.length > 0;
      
      
      if (hasExistingOrgs && !intent && !actionLoading && !actionSuccess) {
        // User has existing organizations and no specific intent - redirect immediately
        setShouldRedirect(true);
        navigate(`/dashboard/team?tab=myinvitations&token=${token}`, { replace: true });
        return;
      } else {
        // Logged in but either new user or has intent - show public page
        setShouldRedirect(false);
        setLoading(false);
        return;
      }
    }
    
    // Case 2: Profile is loaded but user is not logged in
    if (profile.loaded && !isLoggedIn) {
      setShouldRedirect(false);
      setLoading(false);
      return;
    }
    
    // Case 3: Profile is still loading - wait a bit more, but set a timeout
    if (!profile.loaded) {
      // Set a timeout to prevent infinite loading for logged-out users
      const timeoutId = setTimeout(() => {
        if (shouldRedirect === null) {
          setShouldRedirect(false);
          setLoading(false);
        }
      }, 2000); // 2 second timeout
      
      return () => clearTimeout(timeoutId);
    }
  }, [profile.loaded, isLoggedIn, inviteInfo, intent, actionLoading, actionSuccess, profile.data?.memberships?.length, token, navigate, shouldRedirect, loading]);

  // Auto-handle intent only for users with existing memberships
  useEffect(() => {
    if (isLoggedIn && intent && inviteInfo && !actionLoading && shouldRedirect === false) {
      const memberships = profile.data?.memberships || [];
      const hasExistingOrgs = memberships.length > 0;
      
      if (hasExistingOrgs) {
        // User has existing organizations - respect their intent
        if (intent === 'accept') {
          handleAccept();
        } else if (intent === 'decline') {
          handleDecline();
        }
        // Clear intent from URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('intent');
        navigate(`/invites/${token}?${newParams.toString()}`, { replace: true });
      }
    }
  }, [isLoggedIn, intent, inviteInfo, actionLoading, shouldRedirect, profile.data?.memberships?.length]);
  
  const loadInviteInfo = async () => {
    // Don't reload if we just successfully processed the invitation
    if (actionSuccess) return;
    
    try {
      setError(null);
      const info = await InvitesService.getPublicInvite(token!);
      setInviteInfo(info);
      // Don't set loading to false here - let the decision logic handle it
    } catch (err: any) {
      console.error('Failed to load invite info:', err);
      if (err.response?.status === 404) {
        setError('Invitation not found or invalid link');
      } else {
        setError('Failed to load invitation details');
      }
      // Only on error, set loading to false and prevent redirect
      setLoading(false);
      setShouldRedirect(false);
    }
  };
  
  const handleAccept = async () => {
    if (!token || !inviteInfo) return;
    
    try {
      setActionLoading('accept');
      setActionError(null);
      
      await dispatch(acceptInvite(token)).unwrap();
      
      // Mark as successful to prevent further API calls
      setActionSuccess('accept');
      
      // Clear postAuth to prevent AuthBootstrap from redirecting back
      localStorage.removeItem('postAuth');
      
      // Refresh profile to get new membership
      const updatedProfile = await dispatch(fetchProfile()).unwrap();
      const memberships = updatedProfile.memberships || [];
      
      if (memberships.length === 1) {
        // Single membership - set as active and go to dashboard
        const membership = memberships[0];
        await dispatch(selectOrgAndFinalize(membership.orgId));
        navigate('/dashboard/home');
      } else {
        // Multiple memberships - show org picker
        navigate('/dashboard/home'); // This will trigger the org picker modal
      }
      
    } catch (error: any) {
      console.error('Failed to accept invitation:', error);
      
      // Handle specific error cases
      let errorMessage = 'Failed to accept invitation. Please try again.';
      
      if (error?.response?.data?.message) {
        const backendError = error.response.data.message;
        if (typeof backendError === 'object' && backendError.code) {
          switch (backendError.code) {
            case 'EMAIL_MISMATCH':
              errorMessage = `You're signed in as ${profile.data?.user?.email} but this invite is for ${inviteInfo.email}. Please switch accounts or sign in with the correct email.`;
              break;
            case 'INVITE_EXPIRED':
              errorMessage = 'This invitation has expired. Please ask the admin to send a new invitation.';
              break;
            case 'INVITE_REVOKED':
              errorMessage = 'This invitation has been revoked by the organization admin.';
              break;
            case 'ALREADY_MEMBER':
              errorMessage = "You're already a member of this organization.";
              // Redirect to dashboard
              setTimeout(() => navigate('/dashboard/home'), 2000);
              break;
            default:
              errorMessage = backendError.message || errorMessage;
          }
        }
      }
      
      setActionError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };
  
  const handleDecline = async () => {
    if (!token) return;
    
    try {
      setActionLoading('decline');
      setActionError(null);
      
      await dispatch(declineInvite(token)).unwrap();
      
      // Mark as successful to prevent further API calls
      setActionSuccess('decline');
      
      // Clear postAuth to prevent AuthBootstrap from redirecting back
      localStorage.removeItem('postAuth');
      
      if (isLoggedIn) {
        // Redirect to team page with success message
        navigate('/dashboard/team?tab=myinvitations', {
          state: { message: 'Invitation declined successfully' }
        });
      } else {
        // Show success message for logged out users
        setActionError(null);
        setInviteInfo(prev => prev ? { ...prev, status: 'DECLINED' } : null);
      }
      
    } catch (error: any) {
      console.error('Failed to decline invitation:', error);
      setActionError('Failed to decline invitation. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };
  
  const handleSignInWithIntent = (intentType: 'accept' | 'decline') => {
    // Store post-auth action
    localStorage.setItem('postAuth', JSON.stringify({
      kind: 'invite',
      token,
      intent: intentType
    }));
    
    // Navigate to login with return path
    const returnPath = encodeURIComponent(`/invites/${token}?intent=${intentType}`);
    navigate(`/login?next=${returnPath}`);
  };
  
  const handleCreateAccount = () => {
    // Navigate to normal signup without any special invitation handling
    navigate('/login?tab=signup');
  };

  const handleJustSignIn = () => {
    // Simply navigate to login without any special handling
    // User will go to normal dashboard flow
    navigate('/login');
  };
  
  const handleCreateOrg = () => {
    setCurrentView("create");
    onCreateModalOpen();
  };
  
  const handleSubmitCreateOrg = async () => {
    if (!orgName) return;
    
    try {
      setIsCreatingOrg(true);
      
      // Create the organization first
      const orgResult = await dispatch(createOrg(orgName)).unwrap();
      
      // Extract the actual organization data
      const orgData = (orgResult as any).data || orgResult;
      
      // Send bulk invites if emails were provided
      if (emails.length > 0 && orgData._id) {
        try {
          const bulkInviteData = {
            users: emails.map(email => ({
              email,
              role: UserRole.MEMBER,
            })),
          };
          
          await InvitesService.bulkCreate(orgData._id, bulkInviteData);
        } catch (inviteError) {
          console.warn('Organization created but some invites failed:', inviteError);
          // Don't fail the entire process if invites fail
        }
      }
      
      // Clear postAuth to prevent redirect loops
      localStorage.removeItem('postAuth');
      
      // Redirect to dashboard home page
      navigate('/dashboard/home', { replace: true });
      
    } catch (error) {
      console.error('Failed to create organization:', error);
    } finally {
      setIsCreatingOrg(false);
    }
  };
  
  const handleAddEmail = (email: string) => {
    if (emails.length < 3 && !emails.includes(email)) {
      setEmails([...emails, email]);
      return true;
    }
    return false;
  };
  
  const handleRemoveEmail = (email: string) => {
    setEmails(emails.filter(e => e !== email));
  };
  
  // Show loading while we're determining what to do
  if (loading || shouldRedirect === null || !inviteInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">
            {!inviteInfo ? 'Loading invitation...' : 'Determining access...'}
          </p>
        </div>
      </div>
    );
  }

  // Show redirecting message if we decided to redirect
  if (shouldRedirect === true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Redirecting to teams page...</p>
        </div>
      </div>
    );
  }
  
  if (error || !inviteInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardBody className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon icon="lucide:x-circle" className="text-red-500" width={32} />
            </div>
            <h2 className="text-xl font-semibold mb-2">Invalid Invitation</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button
              color="primary"
              onPress={() => navigate('/')}
            >
              Go Home
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }
  
  // Check if invite is expired or revoked
  const isExpiredOrRevoked = inviteInfo.expired || 
    inviteInfo.status === 'EXPIRED' || 
    inviteInfo.status === 'REVOKED';
  
  const isAlreadyProcessed = inviteInfo.status === 'ACCEPTED' || 
    inviteInfo.status === 'DECLINED';
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className={`max-w-lg w-full ${isMobile ? 'mx-2' : 'mx-4'}`}>
        <CardBody className="py-8">
          {isExpiredOrRevoked ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon icon="lucide:clock-x" className="text-yellow-500" width={32} />
              </div>
              <h2 className="text-xl font-semibold mb-2">Invitation No Longer Valid</h2>
              <p className="text-gray-600 mb-4">
                This invitation has {inviteInfo.status === 'REVOKED' ? 'been revoked' : 'expired'}.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Please contact the organization admin to request a new invitation.
              </p>
              <Button
                color="primary"
                onPress={() => navigate('/')}
              >
                Go Home
              </Button>
            </div>
          ) : isAlreadyProcessed ? (
            <div className="text-center">
              <div className={`w-16 h-16 ${inviteInfo.status === 'ACCEPTED' ? 'bg-green-100' : 'bg-gray-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                <Icon 
                  icon={inviteInfo.status === 'ACCEPTED' ? "lucide:check-circle" : "lucide:x-circle"} 
                  className={inviteInfo.status === 'ACCEPTED' ? 'text-green-500' : 'text-gray-500'} 
                  width={32} 
                />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                Invitation {inviteInfo.status === 'ACCEPTED' ? 'Accepted' : 'Declined'}
              </h2>
              <p className="text-gray-600 mb-6">
                You have already {inviteInfo.status === 'ACCEPTED' ? 'accepted' : 'declined'} this invitation.
              </p>
              {isLoggedIn ? (
                <Button
                  color="primary"
                  onPress={() => navigate('/dashboard/team?tab=myinvitations')}
                >
                  View My Invitations
                </Button>
              ) : (
                <Button
                  color="primary"
                  onPress={() => navigate('/login')}
                >
                  Sign In
                </Button>
              )}
            </div>
          ) : (
            <div>
              {/* Valid invitation content */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon icon="lucide:users" className="text-primary-500" width={32} />
                </div>
                <h2 className="text-xl font-semibold mb-2">Invitation to Join</h2>
                <h3 className="text-lg font-medium text-primary-600">{inviteInfo.orgName}</h3>
                <p className="text-gray-600 mt-1">You've been invited to join this organization</p>
              </div>
              
              {/* Invitation details */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Email</span>
                    <span className="font-medium">{inviteInfo.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Role</span>
                    <Chip color="primary" variant="flat" size="sm">
                      {inviteInfo.role}
                    </Chip>
                  </div>
                  {inviteInfo.invitedBy && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Invited by</span>
                      <span className="font-medium">{inviteInfo.invitedBy}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Expires on</span>
                    <span className="font-medium">
                      {new Date(inviteInfo.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Error display */}
              {actionError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-red-800 text-sm">{actionError}</p>
                </div>
              )}
              
              {/* Actions based on login status */}
              {isLoggedIn ? (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <Button
                      color="danger"
                      variant="flat"
                      className="flex-1"
                      onPress={handleDecline}
                      isLoading={actionLoading === 'decline'}
                      isDisabled={!!actionLoading}
                    >
                      Decline
                    </Button>
                    <Button
                      color="primary"
                      className="flex-1"
                      onPress={handleAccept}
                      isLoading={actionLoading === 'accept'}
                      isDisabled={!!actionLoading}
                    >
                      Accept Invitation
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Divider className="flex-1" />
                    <span className="text-gray-500 text-sm">OR</span>
                    <Divider className="flex-1" />
                  </div>
                  
                  <Button
                    variant="flat"
                    color="default"
                    className="w-full"
                    onPress={handleCreateOrg}
                    endContent={<Icon icon="lucide:arrow-right" width={16} />}
                  >
                    Create My Organization
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <Button
                      color="danger"
                      variant="flat"
                      className="flex-1"
                      onPress={() => handleSignInWithIntent('decline')}
                    >
                      Decline & Sign In
                    </Button>
                    <Button
                      color="primary"
                      className="flex-1"
                      onPress={() => handleSignInWithIntent('accept')}
                    >
                      Accept & Sign In
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Divider className="flex-1" />
                    <span className="text-gray-500 text-sm">OR</span>
                    <Divider className="flex-1" />
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      variant="flat"
                      color="default"
                      className="flex-1"
                      onPress={handleCreateAccount}
                    >
                      Create Account
                    </Button>
                    <Button
                      variant="bordered"
                      color="primary"
                      className="flex-1"
                      onPress={() => handleJustSignIn()}
                    >
                      Just Sign In
                    </Button>
                  </div>
                  
                  <p className="text-xs text-gray-500 text-center">
                    "Just Sign In" takes you to the dashboard. Find this invitation in the "Team → My Invitations" tab later.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
      
      {/* Create Organization Modal */}
      <Modal 
        isOpen={isCreateModalOpen} 
        onOpenChange={onCreateModalChange}
        size="lg"
        hideCloseButton
        motionProps={{
          variants: {
            enter: {
              opacity: 1,
              scale: 1,
              transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] }
            },
            exit: {
              opacity: 0,
              scale: 0.95,
              transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
            }
          }
        }}
      >
        <ModalContent>
          {(onClose) => (
            <div className="relative overflow-hidden">
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  initial={{ opacity: 0, x: "100%" }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: "100%" }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ModalHeader className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button 
                          isIconOnly 
                          size="sm" 
                          variant="light" 
                          onPress={() => setCurrentView("invitation")}
                          className="text-default-500"
                        >
                          <Icon icon="lucide:arrow-left" width={18} />
                        </Button>
                        <h2 className="text-xl font-semibold">Create Organization</h2>
                      </div>
                      <Button isIconOnly size="sm" variant="light" onPress={onClose}>
                        <Icon icon="lucide:x" width={18} />
                      </Button>
                    </div>
                  </ModalHeader>
                  <ModalBody>
                    <div className="space-y-6">
                      <div>
                        <Input
                          label="Organization Name"
                          placeholder="Enter your organization name"
                          value={orgName}
                          onValueChange={setOrgName}
                          variant="bordered"
                          isRequired
                          startContent={
                            <Icon icon="lucide:building" className="text-default-400" width={18} />
                          }
                        />
                      </div>
                      
                      <div>
                        <EmailInput
                          label="Invite Team Members (Optional)"
                          helperText="Add up to 3 email addresses"
                          emails={emails}
                          onAddEmail={handleAddEmail}
                          onRemoveEmail={handleRemoveEmail}
                        />
                      </div>
                    </div>
                  </ModalBody>
                  <ModalFooter>
                    <Button 
                      color="primary" 
                      className="w-full"
                      onPress={handleSubmitCreateOrg}
                      isDisabled={!orgName || isCreatingOrg}
                      startContent={isCreatingOrg ? <Spinner size="sm" color="white" /> : null}
                    >
                      {isCreatingOrg ? "Creating..." : "Create Organization"}
                    </Button>
                  </ModalFooter>
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
