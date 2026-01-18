// src/pages/MyInvitationsPage.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Divider,
  Spinner,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Accordion,
  AccordionItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Breadcrumbs,
  BreadcrumbItem,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { 
  fetchMyInvitations, 
  acceptInvite, 
  declineInvite,
  selectMyInvitations,
  selectMyInvitationsLoading,
  selectMyInvitationsError,
  selectMyInvitationsAcceptingToken,
  selectMyInvitationsDecliningToken,
  selectPendingMyInvitationsCount
} from '../store/invitesSlice';
import { fetchProfile } from '../store/profileSlice';
import { resolveInitialActiveOrg } from '../store/activeOrgSlice';
import { InviteStatus } from '../api/types';
import { UserRole } from '../types/User';
import { format } from 'date-fns';
import { OnboardingModal } from '../components/onboarding-modal';
import type { Invite } from '../api/types';
import { useBreakpoints } from '../hooks/use-media-query';
import { canUserCreateOrganization } from '../utils/organizationUtils';
import { extractErrorMessage } from '../utils/errorUtils';

// Helper function to get user-friendly status for my invitations
const getMyInvitationStatus = (invitation: Invite) => {
  const now = new Date();
  const expiresAt = new Date(invitation.expiresAt);
  const isExpired = expiresAt < now;

  if (isExpired) {
    return { status: 'Expired', color: 'default' as const };
  }

  switch (invitation.status) {
    case InviteStatus.CREATED:
    case InviteStatus.SENT:
    case InviteStatus.DELIVERED:
      return { status: 'Pending', color: 'warning' as const };
    case InviteStatus.ACCEPTED:
      return { status: 'Accepted', color: 'success' as const };
    case InviteStatus.DECLINED:
      return { status: 'Declined', color: 'danger' as const };
    case InviteStatus.REVOKED:
      return { status: 'Revoked', color: 'danger' as const };
    default:
      return { status: 'Unknown', color: 'default' as const };
  }
};

// Helper function to categorize my invitations
const categorizeMyInvitations = (invitations: Invite[]) => {
  const now = new Date();
  
  const pending = invitations.filter(inv => {
    const isExpired = new Date(inv.expiresAt) < now;
    return !isExpired && [InviteStatus.CREATED, InviteStatus.SENT, InviteStatus.DELIVERED].includes(inv.status);
  });
  
  const processed = invitations.filter(inv => 
    [InviteStatus.ACCEPTED, InviteStatus.DECLINED].includes(inv.status)
  );
  
  const expired = invitations.filter(inv => 
    new Date(inv.expiresAt) < now || inv.status === InviteStatus.REVOKED
  );

  return { pending, processed, expired };
};

const roleColors = {
  [UserRole.OWNER]: 'danger' as const,
  [UserRole.ADMIN]: 'danger' as const,
  [UserRole.MEMBER]: 'primary' as const,
  [UserRole.VIEWER]: 'default' as const,
};

// Component for rendering my invitations table within accordion
const MyInvitationsTable: React.FC<{
  invitations: Invite[];
  isMobile: boolean;
  handleInvitationDetails: (invitation: Invite) => void;
  currentUserEmail?: string;
}> = ({ invitations, isMobile, handleInvitationDetails, currentUserEmail }) => {
  const myInvitationsColumns = [
    { key: "organization", label: "Organization" },
    { key: "role", label: "Role" },
    { key: "status", label: "Status" },
    { key: "invitedBy", label: "Invited By" },
    { key: "actions", label: "Actions" },
  ];

  if (invitations.length === 0) {
    return <div className="flex justify-center items-center py-8 text-gray-500">No invitations in this category</div>;
  }

  return (
    <Table
      className={isMobile ? "text-xs" : ""}
      classNames={{
        table: isMobile ? "min-w-full" : "",
        th: isMobile ? "px-2 py-3 text-xs" : "",
        td: isMobile ? "px-2 py-3" : "",
      }}
    >
      <TableHeader columns={myInvitationsColumns}>
        {(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}
      </TableHeader>
      <TableBody>
        {invitations.map((invitation: Invite) => (
          <TableRow
            key={invitation._id}
            className="hover:bg-gray-50/50 odd:bg-gray-50/25 dark:odd:bg-gray-800/25 dark:hover:bg-gray-800/50"
          >
            <TableCell>
              <div className={`${isMobile ? "text-xs" : ""}`}>
                <p className="font-medium">{invitation.orgId.name}</p>
                {!isMobile && <p className="text-gray-500 text-sm">{invitation.orgId._id}</p>}
              </div>
            </TableCell>
            <TableCell>
              <Chip color={roleColors[invitation.role as UserRole]} variant="flat" size={isMobile ? "sm" : "md"}>
                {invitation.role}
              </Chip>
            </TableCell>
            <TableCell>
              {(() => {
                const statusInfo = getMyInvitationStatus(invitation);
                return (
                  <Chip color={statusInfo.color} variant="flat" size={isMobile ? "sm" : "md"}>
                    {isMobile ? statusInfo.status.charAt(0) : statusInfo.status}
                  </Chip>
                );
              })()}
            </TableCell>
            <TableCell className={isMobile ? "text-xs" : ""}>
              <div className="flex items-center gap-2">
                <span>
                  {typeof invitation.invitedBy === "string" ? invitation.invitedBy : invitation.invitedBy.email}
                </span>
                {(typeof invitation.invitedBy === "string" ? invitation.invitedBy : invitation.invitedBy.email) ===
                  currentUserEmail && (
                  <Chip size="sm" color="primary" variant="flat" className="text-xs">
                    me
                  </Chip>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className={`flex ${isMobile ? "flex-col gap-1" : "gap-2"}`}>
                <Button
                  size={isMobile ? "sm" : "md"}
                  variant="light"
                  color="primary"
                  onPress={() => handleInvitationDetails(invitation)}
                  className={isMobile ? "min-w-0 px-2" : ""}
                >
                  {isMobile ? "View" : "View Details"}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default function MyInvitationsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isMobile } = useBreakpoints();
  
  // Redux state
  const myInvitations = useAppSelector(selectMyInvitations);
  const myInvitationsLoading = useAppSelector(selectMyInvitationsLoading);
  const myInvitationsError = useAppSelector(selectMyInvitationsError);
  const acceptingToken = useAppSelector(selectMyInvitationsAcceptingToken);
  const decliningToken = useAppSelector(selectMyInvitationsDecliningToken);
  const pendingMyInvitationsCount = useAppSelector(selectPendingMyInvitationsCount);
  const profile = useAppSelector((s) => s.profile);

  // Check if user can create organization (only if they don't own one already)
  const memberships = profile.data?.memberships || [];
  const userCanCreateOrg = canUserCreateOrganization(memberships);

  // Local state
  const [isInvitationDetailsModalOpen, setIsInvitationDetailsModalOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<Invite | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Handle URL parameters (token for auto-opening modal)
  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token && myInvitations && myInvitations.length > 0) {
      // Find the invitation with this token and open details modal
      const invitation = myInvitations.find((inv: Invite) => inv.token === token);
      if (invitation) {
        setSelectedInvitation(invitation);
        setIsInvitationDetailsModalOpen(true);
      }
    }
  }, [searchParams, myInvitations]);

  // Fetch my invitations on component mount
  useEffect(() => {
    dispatch(fetchMyInvitations({}));
  }, [dispatch]);

  const handleAcceptInvite = async (token: string) => {
    setActionError(null);
    try {
      await dispatch(acceptInvite(token)).unwrap();
      
      // Refresh profile to get updated memberships
      await dispatch(fetchProfile()).unwrap();
      
      // Resolve active organization with updated profile
      await dispatch(resolveInitialActiveOrg()).unwrap();
      
      // Close modal and navigate to dashboard
      setIsInvitationDetailsModalOpen(false);
      navigate('/dashboard/home');
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      setActionError(extractErrorMessage(error, 'Failed to accept invitation. Please try again.'));
    }
  };

  const handleDeclineInvite = async (token: string) => {
    setActionError(null);
    try {
      await dispatch(declineInvite(token)).unwrap();
      // Refresh the invitations list
      dispatch(fetchMyInvitations({}));
      // Close modal
      setIsInvitationDetailsModalOpen(false);
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      setActionError(extractErrorMessage(error, 'Failed to decline invitation. Please try again.'));
    }
  };

  const handleInvitationDetails = (invitation: Invite) => {
    setSelectedInvitation(invitation);
    setIsInvitationDetailsModalOpen(true);
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    // Refresh the page or navigate to dashboard
    window.location.reload();
  };

  if (myInvitationsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" color="primary" />
          <p className="mt-4 text-default-600">Loading your invitations...</p>
        </div>
      </div>
    );
  }

  const { pending, processed, expired } = categorizeMyInvitations(myInvitations || []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header with breadcrumbs */}
      <div className="bg-white border-b border-divider">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                isIconOnly
                variant="light"
                onPress={() => navigate(-1)}
                className="text-default-500 hover:text-default-700"
              >
                <Icon icon="lucide:arrow-left" width={20} />
              </Button>
              <Breadcrumbs>
                <BreadcrumbItem onClick={() => navigate('/dashboard/home')}>Dashboard</BreadcrumbItem>
                <BreadcrumbItem>My Invitations</BreadcrumbItem>
              </Breadcrumbs>
            </div>
            {pendingMyInvitationsCount > 0 && (
              <Chip color="warning" variant="flat">
                {pendingMyInvitationsCount} Pending
              </Chip>
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">My Invitations</h1>
          <p className="text-default-600 mt-1">
            View and manage invitations to join organizations
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {myInvitationsError && (
          <Card className="mb-6 border-danger-200 bg-danger-50">
            <CardBody>
              <div className="flex items-center gap-2 text-danger-600">
                <Icon icon="lucide:alert-circle" width={20} />
                <p>Error loading invitations: {myInvitationsError}</p>
              </div>
            </CardBody>
          </Card>
        )}

        {(myInvitations || []).length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-center py-12">
                <Icon icon="lucide:mail" width={64} className="mx-auto text-default-300 mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No invitations yet</h3>
                <p className="text-default-600 mb-6">
                  You haven't received any organization invitations yet.
                </p>
                {userCanCreateOrg && (
                  <Button
                    color="primary"
                    variant="bordered"
                    onPress={() => setIsModalOpen(true)}
                    startContent={<Icon icon="lucide:plus" width={16} />}
                  >
                    Create New Organization
                  </Button>
                )}
                {!userCanCreateOrg && (
                  <p className="text-sm text-default-500">
                    You're already a member of an organization. Check your existing organizations in the sidebar.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {pending.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:clock" width={20} className="text-warning-500" />
                    <span className="font-semibold">Pending Invitations</span>
                    <Chip color="warning" variant="flat" size="sm">
                      {pending.length}
                    </Chip>
                  </div>
                </CardHeader>
                <CardBody>
                  {isMobile ? (
                    <div className="space-y-4">
                      {pending.map((invitation) => (
                        <Card key={invitation._id} className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-semibold">{invitation.orgId.name}</h4>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Chip color={roleColors[invitation.role as UserRole]} variant="flat" size="sm">
                                  {invitation.role}
                                </Chip>
                                <Chip color="warning" variant="flat" size="sm">
                                  Pending
                                </Chip>
                              </div>
                              <p className="text-sm text-default-600 mt-2">
                                Invited by: {typeof invitation.invitedBy === "string" ? invitation.invitedBy : invitation.invitedBy.email}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="light"
                              color="primary"
                              onPress={() => handleInvitationDetails(invitation)}
                            >
                              View
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <MyInvitationsTable
                      invitations={pending}
                      isMobile={isMobile}
                      handleInvitationDetails={handleInvitationDetails}
                      currentUserEmail={profile.data?.user?.email}
                    />
                  )}
                </CardBody>
              </Card>
            )}

            {processed.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:check-circle" width={20} className="text-success-500" />
                    <span className="font-semibold">Processed Invitations</span>
                    <Chip color="default" variant="flat" size="sm">
                      {processed.length}
                    </Chip>
                  </div>
                </CardHeader>
                <CardBody>
                  {isMobile ? (
                    <div className="space-y-4">
                      {processed.map((invitation) => {
                        const statusInfo = getMyInvitationStatus(invitation);
                        return (
                          <Card key={invitation._id} className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-semibold">{invitation.orgId.name}</h4>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <Chip color={roleColors[invitation.role as UserRole]} variant="flat" size="sm">
                                    {invitation.role}
                                  </Chip>
                                  <Chip color={statusInfo.color} variant="flat" size="sm">
                                    {statusInfo.status}
                                  </Chip>
                                </div>
                                <p className="text-sm text-default-600 mt-2">
                                  Invited by: {typeof invitation.invitedBy === "string" ? invitation.invitedBy : invitation.invitedBy.email}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="light"
                                color="primary"
                                onPress={() => handleInvitationDetails(invitation)}
                              >
                                View
                              </Button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <MyInvitationsTable
                      invitations={processed}
                      isMobile={isMobile}
                      handleInvitationDetails={handleInvitationDetails}
                      currentUserEmail={profile.data?.user?.email}
                    />
                  )}
                </CardBody>
              </Card>
            )}

            {expired.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:x-circle" width={20} className="text-default-500" />
                    <span className="font-semibold">Expired/Revoked Invitations</span>
                    <Chip color="default" variant="flat" size="sm">
                      {expired.length}
                    </Chip>
                  </div>
                </CardHeader>
                <CardBody>
                  {isMobile ? (
                    <div className="space-y-4">
                      {expired.map((invitation) => {
                        const statusInfo = getMyInvitationStatus(invitation);
                        return (
                          <Card key={invitation._id} className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-semibold">{invitation.orgId.name}</h4>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <Chip color={roleColors[invitation.role as UserRole]} variant="flat" size="sm">
                                    {invitation.role}
                                  </Chip>
                                  <Chip color={statusInfo.color} variant="flat" size="sm">
                                    {statusInfo.status}
                                  </Chip>
                                </div>
                                <p className="text-sm text-default-600 mt-2">
                                  Invited by: {typeof invitation.invitedBy === "string" ? invitation.invitedBy : invitation.invitedBy.email}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="light"
                                color="primary"
                                onPress={() => handleInvitationDetails(invitation)}
                              >
                                View
                              </Button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <MyInvitationsTable
                      invitations={expired}
                      isMobile={isMobile}
                      handleInvitationDetails={handleInvitationDetails}
                      currentUserEmail={profile.data?.user?.email}
                    />
                  )}
                </CardBody>
              </Card>
            )}
          </div>
        )}

        <Divider className="my-8" />

        {userCanCreateOrg && (
          <Card className="bg-default-50">
            <CardBody>
              <div className="text-center">
                <h3 className="font-semibold text-foreground mb-2">Want to create your own organization?</h3>
                <p className="text-sm text-default-600 mb-4">
                  If you'd rather start fresh, you can create a new organization and invite your team.
                </p>
                <Button
                  color="primary"
                  variant="bordered"
                  onPress={() => setIsModalOpen(true)}
                  startContent={<Icon icon="lucide:plus" width={16} />}
                >
                  Create New Organization
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {!userCanCreateOrg && (
          <Card className="bg-default-50">
            <CardBody>
              <div className="text-center">
                <h3 className="font-semibold text-foreground mb-2">Organization Management</h3>
                <p className="text-sm text-default-600 mb-4">
                  You're already a member of an organization. Manage your existing organizations through the sidebar navigation.
                </p>
                <Button
                  color="primary"
                  variant="bordered"
                  onPress={() => navigate('/dashboard/organization')}
                  startContent={<Icon icon="lucide:building" width={16} />}
                >
                  Manage Organizations
                </Button>
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Invitation Details Modal */}
      <Modal 
        isOpen={isInvitationDetailsModalOpen} 
        onClose={() => {
          setIsInvitationDetailsModalOpen(false);
          setActionError(null);
        }}
        size="2xl"
      >
        <ModalContent>
          {selectedInvitation && (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h3>Invitation Details</h3>
                <p className="text-sm text-default-600 font-normal">
                  Organization: {selectedInvitation.orgId.name}
                </p>
              </ModalHeader>
              <ModalBody>
                {actionError && (
                  <Card className="border-danger-200 bg-danger-50 mb-4">
                    <CardBody>
                      <div className="flex items-center gap-2 text-danger-600">
                        <Icon icon="lucide:alert-circle" width={20} />
                        <p>{actionError}</p>
                      </div>
                    </CardBody>
                  </Card>
                )}
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-default-600">Organization</p>
                      <p className="font-medium">{selectedInvitation.orgId.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-default-600">Role</p>
                      <Chip color={roleColors[selectedInvitation.role as UserRole]} variant="flat">
                        {selectedInvitation.role}
                      </Chip>
                    </div>
                    <div>
                      <p className="text-sm text-default-600">Status</p>
                      {(() => {
                        const statusInfo = getMyInvitationStatus(selectedInvitation);
                        return (
                          <Chip color={statusInfo.color} variant="flat">
                            {statusInfo.status}
                          </Chip>
                        );
                      })()}
                    </div>
                    <div>
                      <p className="text-sm text-default-600">Invited By</p>
                      <p className="font-medium">
                        {typeof selectedInvitation.invitedBy === "string" 
                          ? selectedInvitation.invitedBy 
                          : selectedInvitation.invitedBy.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-default-600">Invited Date</p>
                      <p className="font-medium">
                        {format(new Date(selectedInvitation.createdAt), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-default-600">Expires</p>
                      <p className="font-medium">
                        {format(new Date(selectedInvitation.expiresAt), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={() => setIsInvitationDetailsModalOpen(false)}>
                  Close
                </Button>
                {getMyInvitationStatus(selectedInvitation).status === 'Pending' && (
                  <>
                    <Button
                      color="danger"
                      variant="light"
                      onPress={() => handleDeclineInvite(selectedInvitation.token)}
                      isLoading={decliningToken === selectedInvitation.token}
                    >
                      Decline
                    </Button>
                    <Button
                      color="primary"
                      onPress={() => handleAcceptInvite(selectedInvitation.token)}
                      isLoading={acceptingToken === selectedInvitation.token}
                    >
                      Accept
                    </Button>
                  </>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Onboarding Modal */}
      <OnboardingModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        initialStep="create"
        isDismissable={true}
      />
    </div>
  );
}
