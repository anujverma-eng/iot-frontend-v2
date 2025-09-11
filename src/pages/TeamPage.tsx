// src/pages/TeamPage.tsx
import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Card,
  CardBody,
  Button,
  Chip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Tabs,
  Tab,
  Pagination,
  Spinner,
  Avatar,
  SortDescriptor,
  Accordion,
  AccordionItem,
  addToast,
} from "@heroui/react";
import { useAppDispatch, useAppSelector } from "../hooks/useAppDispatch";
import { useBreakpoints } from "../hooks/use-media-query";
import { usePermissions } from "../hooks/usePermissions";
import { PermissionWrapper } from "../components/PermissionWrapper";
import { PermissionButton } from "../components/PermissionButton";
import { debounce } from "../utils/debounce";
import {
  fetchMembers,
  changeRole,
  changePermissions,
  removeMember,
  selectMembers,
  selectMembersLoading,
  selectMembersError,
  selectMembersPagination,
  selectMembersUpdatingId,
  selectMembersDeletingId,
} from "../store/membersSlice";
import {
  createInvite,
  fetchInvites,
  revokeInvite,
  selectInvites,
  selectInvitesLoading,
  selectInvitesError,
  selectInvitesPagination,
  selectInvitesCreating,
  selectInvitesRevokingId,
  // My invitations imports
  fetchMyInvitations,
  acceptInvite,
  declineInvite,
  selectMyInvitations,
  selectMyInvitationsLoading,
  selectMyInvitationsError,
  selectMyInvitationsPagination,
  selectMyInvitationsAcceptingToken,
  selectMyInvitationsDecliningToken,
  selectPendingMyInvitationsCount,
} from "../store/invitesSlice";
import {
  fetchCatalog,
  selectAllPermissions,
  selectPermissionsCatalogLoading,
  selectPermissionsCategories,
} from "../store/permissionsCatalogSlice";
import { selectActiveOrgId, selectActiveOrgReady } from "../store/activeOrgSlice";
import { fetchProfile } from "../store/profileSlice";
import { UserRole } from "../types/User";
import { Invite, Permission, InviteStatus } from "../api/types";
import { MembershipWithUser } from "../api/members.service";
import { ChangeRoleModal } from "../components/ChangeRoleModal";
import { EditPermissionsModal } from "../components/EditPermissionsModal";

// Icons
import { Icon } from "@iconify/react";
import { EllipsisVerticalIcon, PlusIcon, PaperAirplaneIcon, XMarkIcon, LinkIcon, ClipboardDocumentIcon, ArrowLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface InviteFormData {
  email: string;
  role: UserRole;
}

const ITEMS_PER_PAGE = 10;

// Helper function to get user-friendly status for my invitations
const getMyInvitationStatus = (invite: Invite) => {
  // Check if expired first
  if (
    new Date(invite.expiresAt) < new Date() &&
    invite.status !== InviteStatus.ACCEPTED &&
    invite.status !== InviteStatus.DECLINED
  ) {
    return { status: "EXPIRED", color: "danger" as const };
  }

  // Show only final statuses that matter to the user
  switch (invite.status) {
    case "ACCEPTED":
      return { status: "ACCEPTED", color: "success" as const };
    case "DECLINED":
      return { status: "DECLINED", color: "warning" as const };
    case "EXPIRED":
      return { status: "EXPIRED", color: "danger" as const };
    case "REVOKED":
      return { status: "REVOKED", color: "default" as const };
    default:
      // For all pending statuses (CREATED, SENT, DELIVERED, etc.)
      return { status: "PENDING", color: "primary" as const };
  }
};

const roleColors: Record<UserRole, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = {
  [UserRole.ADMIN]: "danger",
  [UserRole.MEMBER]: "warning",
  [UserRole.VIEWER]: "default",
  [UserRole.OWNER]: "primary",
};

const inviteStatusColors: Record<InviteStatus, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> =
  {
    [InviteStatus.CREATED]: "default",
    [InviteStatus.SENT]: "primary",
    [InviteStatus.DELIVERED]: "primary",
    [InviteStatus.BOUNCED]: "danger",
    [InviteStatus.ACCEPTED]: "success",
    [InviteStatus.EXPIRED]: "danger",
    [InviteStatus.REVOKED]: "default",
    [InviteStatus.DECLINED]: "warning",
  };

// Helper functions to categorize invites for accordion display
const categorizeInvites = (invites: Invite[]) => {
  const pending = invites.filter(
    (invite) =>
      invite.status === InviteStatus.CREATED ||
      invite.status === InviteStatus.SENT ||
      invite.status === InviteStatus.DELIVERED
  );

  const accepted = invites.filter((invite) => invite.status === InviteStatus.ACCEPTED);

  const others = invites.filter(
    (invite) =>
      invite.status === InviteStatus.DECLINED ||
      invite.status === InviteStatus.EXPIRED ||
      invite.status === InviteStatus.REVOKED ||
      invite.status === InviteStatus.BOUNCED
  );

  return { pending, accepted, others };
};

// Helper function to categorize my invitations
const categorizeMyInvitations = (invitations: Invite[]) => {
  const pending = invitations.filter((invitation) => {
    const statusInfo = getMyInvitationStatus(invitation);
    return statusInfo.status === "PENDING";
  });

  const others = invitations.filter((invitation) => {
    const statusInfo = getMyInvitationStatus(invitation);
    return statusInfo.status !== "PENDING";
  });

  return { pending, others };
};

// Helper function to copy invite link to clipboard
const copyInviteLink = async (token: string) => {
  const inviteLink = `${window.location.origin}/invites/${token}`;
  try {
    await navigator.clipboard.writeText(inviteLink);
    addToast({
      title: "Invite Link Copied",
      description: "The invitation link has been copied to your clipboard",
      color: "success",
    });
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = inviteLink;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      addToast({
        title: "Invite Link Copied",
        description: "The invitation link has been copied to your clipboard",
        color: "success",
      });
    } catch (fallbackErr) {
      addToast({
        title: "Copy Failed",
        description: "Unable to copy the link. Please copy it manually.",
        color: "danger",
      });
    }
    document.body.removeChild(textArea);
  }
};

// Component for rendering invite table within accordion
const InviteTable: React.FC<{
  invites: Invite[];
  isMobile: boolean;
  handleRevokeInvite: (token: string) => void;
  showActions?: boolean;
  revokingId?: string | null;
  currentUserEmail?: string;
}> = ({ invites, isMobile, handleRevokeInvite, showActions = true, revokingId = null, currentUserEmail }) => {
  const invitesColumns = [
    { key: "email", label: "Email" },
    { key: "role", label: "Role" },
    { key: "status", label: "Status" },
    { key: "createdAt", label: "Invited" },
    { key: "expiresAt", label: "Expires" },
    { key: "copyLink", label: "Copy Link" },
    { key: "actions", label: showActions ? "Actions" : "" },
  ];

  if (invites.length === 0) {
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
      <TableHeader columns={invitesColumns}>
        {(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}
      </TableHeader>
      <TableBody>
        {invites.map((invite: Invite) => (
          <TableRow
            key={invite._id}
            className="hover:bg-gray-50/50 odd:bg-gray-50/25 dark:odd:bg-gray-800/25 dark:hover:bg-gray-800/50"
          >
            <TableCell className={isMobile ? "text-xs" : ""}>
              <div className="flex items-center gap-2">
                <span>{isMobile ? invite.email.split("@")[0] : invite.email}</span>
                {invite.email === currentUserEmail && (
                  <Chip size="sm" color="primary" variant="flat" className="text-xs">
                    me
                  </Chip>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Chip color={roleColors[invite.role]} size={isMobile ? "sm" : "sm"} className={isMobile ? "text-xs" : ""}>
                {isMobile ? invite.role.charAt(0).toUpperCase() : invite.role}
              </Chip>
            </TableCell>
            <TableCell>
              <Chip
                color={inviteStatusColors[invite.status]}
                size={isMobile ? "sm" : "sm"}
                className={isMobile ? "text-xs" : ""}
              >
                {isMobile ? invite.status.charAt(0).toUpperCase() : invite.status}
              </Chip>
            </TableCell>
            <TableCell className={isMobile ? "text-xs" : ""}>
              {new Date(invite.createdAt).toLocaleDateString(
                undefined,
                isMobile ? { month: "short", day: "numeric" } : undefined
              )}
            </TableCell>
            <TableCell className={isMobile ? "text-xs" : ""}>
              {new Date(invite.expiresAt).toLocaleDateString(
                undefined,
                isMobile ? { month: "short", day: "numeric" } : undefined
              )}
            </TableCell>
            <TableCell>
              <Button
                size={isMobile ? "sm" : "sm"}
                color="primary"
                variant="light"
                onClick={() => copyInviteLink(invite.token)}
                startContent={<ClipboardDocumentIcon className={isMobile ? "w-3 h-3" : "w-4 h-4"} />}
                className={isMobile ? "min-w-0 px-2" : ""}
              >
                {isMobile ? "" : "Copy"}
              </Button>
            </TableCell>
            <TableCell>
              {showActions ? (
                <div className="flex items-center gap-2">
                  {(invite.status === InviteStatus.CREATED ||
                    invite.status === InviteStatus.SENT ||
                    invite.status === InviteStatus.DELIVERED) && (
                    <PermissionWrapper permissions={["invites.revoke"]}>
                      <Button
                        size={isMobile ? "sm" : "sm"}
                        color="danger"
                        variant="light"
                        onClick={() => handleRevokeInvite(invite.token)}
                        startContent={<XMarkIcon className={isMobile ? "w-3 h-3" : "w-4 h-4"} />}
                        className={isMobile ? "min-w-0 px-2" : ""}
                        isLoading={revokingId === invite.token}
                        isDisabled={revokingId === invite.token}
                      >
                        {isMobile ? "" : "Revoke"}
                      </Button>
                    </PermissionWrapper>
                  )}
                </div>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
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

export const TeamPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoints();
  const { hasPermission } = usePermissions();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const activeOrgId = useAppSelector(selectActiveOrgId);
  const activeOrgReady = useAppSelector(selectActiveOrgReady);
  const profile = useAppSelector((s) => s.profile);

  // Members state
  const members = useAppSelector(selectMembers);
  const membersLoading = useAppSelector(selectMembersLoading);
  const membersError = useAppSelector(selectMembersError);
  const membersPagination = useAppSelector(selectMembersPagination);
  const membersUpdatingId = useAppSelector(selectMembersUpdatingId);
  const membersDeletingId = useAppSelector(selectMembersDeletingId);

  // Invites state
  const invites = useAppSelector(selectInvites);
  const invitesLoading = useAppSelector(selectInvitesLoading);
  const invitesError = useAppSelector(selectInvitesError);
  const invitesPagination = useAppSelector(selectInvitesPagination);
  const invitesCreating = useAppSelector(selectInvitesCreating);
  const invitesRevokingId = useAppSelector(selectInvitesRevokingId);

  // My invitations state
  const myInvitations = useAppSelector(selectMyInvitations);
  const myInvitationsLoading = useAppSelector(selectMyInvitationsLoading);
  const myInvitationsError = useAppSelector(selectMyInvitationsError);
  const myInvitationsPagination = useAppSelector(selectMyInvitationsPagination);
  const acceptingToken = useAppSelector(selectMyInvitationsAcceptingToken);
  const decliningToken = useAppSelector(selectMyInvitationsDecliningToken);
  const pendingMyInvitationsCount = useAppSelector(selectPendingMyInvitationsCount);

  // Permissions state
  const permissionsCatalog = useAppSelector(selectAllPermissions);
  const permissionsCatalogLoading = useAppSelector(selectPermissionsCatalogLoading);
  const permissionsCategories = useAppSelector(selectPermissionsCategories);

  // Local state
  const [activeTab, setActiveTab] = useState<string>("members");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MembershipWithUser | null>(null);
  const [memberPermissions, setMemberPermissions] = useState<{ allow: string[]; deny: string[] }>({
    allow: [],
    deny: [],
  });
  const [inviteForm, setInviteForm] = useState<InviteFormData>({
    email: "",
    role: UserRole.VIEWER,
  });
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [acceptDeclineError, setAcceptDeclineError] = useState<string | null>(null);

  // Pagination state
  const [membersPage, setMembersPage] = useState(1);
  const [invitesPage, setInvitesPage] = useState(1);
  const [membersSearch, setMembersSearch] = useState("");
  const [membersSortDescriptor, setMembersSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });
  const [invitesSortDescriptor, setInvitesSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });

  // My invitations state
  const [isInvitationDetailsModalOpen, setIsInvitationDetailsModalOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<Invite | null>(null);

  // Ref to track if we've already fetched my invitations
  const hasFetchedMyInvitations = useRef(false);

  // Debounced search function to avoid making API calls on every keystroke
  const debouncedMembersSearch = React.useMemo(
    () =>
      debounce((searchValue: string) => {
        if (activeOrgReady && activeOrgId) {
          dispatch(
            fetchMembers({
              page: 1, // Reset to first page on new search
              limit: ITEMS_PER_PAGE,
              search: searchValue,
              sort: membersSortDescriptor.column as string,
              dir: membersSortDescriptor.direction === "ascending" ? "asc" : "desc",
            })
          );
          setMembersPage(1); // Reset page state
        }
      }, 500),
    [dispatch, activeOrgReady, activeOrgId, membersSortDescriptor]
  );

  // Handle URL parameters (tab, invitation token)
  useEffect(() => {
    const tab = searchParams.get('tab');
    const token = searchParams.get('token');
    
    // Set active tab from URL
    if (tab && ['members', 'invites'].includes(tab)) {
      setActiveTab(tab);
    }
    
    // Token handling is no longer needed for teams page since invitations have their own page
  }, [searchParams]);

  // Reset fetch flag when user or organization changes
  useEffect(() => {
    hasFetchedMyInvitations.current = false;
  }, [activeOrgId]);

  // Handle successful invitation actions (from location state)
  useEffect(() => {
    if (location.state?.message) {
      console.log(location.state.message); // You can replace this with a toast
      // Clear the state to prevent showing the message again
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Load data when org is ready
  useEffect(() => {
    if (activeOrgReady && activeOrgId) {
      dispatch(
        fetchMembers({
          page: membersPage,
          limit: ITEMS_PER_PAGE,
          sort: membersSortDescriptor.column as string,
          dir: membersSortDescriptor.direction === "ascending" ? "asc" : "desc",
        })
      );
      
      // Only fetch invites if user has permission to view them
      if (hasPermission("invites.view")) {
        dispatch(
          fetchInvites({
            page: invitesPage,
            limit: ITEMS_PER_PAGE,
            sort: invitesSortDescriptor.column as string,
            dir: invitesSortDescriptor.direction === "ascending" ? "asc" : "desc",
          })
        );
      }
      
      dispatch(fetchCatalog());
    }
  }, [
    dispatch,
    activeOrgReady,
    activeOrgId,
    hasPermission,
    membersPage,
    membersSortDescriptor,
    invitesPage,
    invitesSortDescriptor,
  ]);

  // Handle members search with debouncing
  useEffect(() => {
    debouncedMembersSearch(membersSearch);
  }, [membersSearch, debouncedMembersSearch]);

  // Fetch my invitations on component mount (only if not already loaded)
  useEffect(() => {
    if (!myInvitationsLoading && !hasFetchedMyInvitations.current) {
      hasFetchedMyInvitations.current = true;
      dispatch(fetchMyInvitations({}));
    }
  }, [dispatch, myInvitationsLoading]);

  // Handle invite submission
  const handleInviteSubmit = async () => {
    if (!inviteForm.email || !inviteForm.role) return;

    setIsSubmittingInvite(true);
    setInviteError(null);
    try {
      await dispatch(createInvite(inviteForm)).unwrap();
      setInviteForm({ email: "", role: UserRole.VIEWER });
      setIsInviteModalOpen(false);
      
      addToast({
        title: 'Invitation Sent',
        description: `Invitation has been sent to ${inviteForm.email}`,
        color: 'success'
      });
      
      // Switch to invited members tab to show the new invite
      setActiveTab("invites");
      
      // Refresh invites only if user has permission
      if (hasPermission("invites.view")) {
        dispatch(
          fetchInvites({
            page: invitesPage,
            limit: ITEMS_PER_PAGE,
            sort: invitesSortDescriptor.column as string,
            dir: invitesSortDescriptor.direction === "ascending" ? "asc" : "desc",
          })
        );
      }
    } catch (error: any) {
      console.error("Failed to send invite:", error);

      // Handle specific backend error structure
      let errorMessage = "Failed to send invite. Please try again.";

      if (error?.response?.data?.message) {
        const backendError = error.response.data.message;
        if (typeof backendError === "object" && backendError.code && backendError.message) {
          // Handle structured error response
          switch (backendError.code) {
            case "USER_ALREADY_MEMBER":
              errorMessage = "👤 Already a Member: This user is already part of your organization.";
              break;
            case "INVITE_ALREADY_EXISTS":
              errorMessage = "📧 Invitation Pending: An invitation has already been sent to this email address.";
              break;
            case "INVALID_EMAIL":
              errorMessage = "📧 Invalid Email: Please enter a valid email address.";
              break;
            case "ORGANIZATION_NOT_FOUND":
              errorMessage = "🏢 Organization Error: Unable to send invitation. Please try again.";
              break;
            case "INSUFFICIENT_PERMISSIONS":
              errorMessage = "🚫 Permission Denied: You do not have permission to invite members to this organization.";
              break;
            default:
              errorMessage = backendError.message || errorMessage;
          }
        } else if (typeof backendError === "string") {
          errorMessage = backendError;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      setInviteError(errorMessage);
      
      addToast({
        title: 'Invitation Failed',
        description: errorMessage,
        color: 'danger'
      });
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  // Handle role change
  const handleRoleChange = async (
    membershipId: string,
    newRole: UserRole,
    permissions?: { allow: string[]; deny: string[] }
  ) => {
    try {
      await dispatch(
        changeRole({
          membershipId,
          role: newRole,
          permissions:
            permissions && (permissions.allow.length > 0 || permissions.deny.length > 0) ? permissions : undefined,
        })
      ).unwrap();
      setIsChangeRoleModalOpen(false);
      setSelectedMember(null);
      console.log("Role updated successfully!");
      // Refresh members
      dispatch(
        fetchMembers({
          page: membersPage,
          limit: ITEMS_PER_PAGE,
          sort: membersSortDescriptor.column as string,
          dir: membersSortDescriptor.direction === "ascending" ? "asc" : "desc",
        })
      );
    } catch (error) {
      console.error("Failed to change role:", error);
      throw error; // Re-throw so modal can handle it
    }
  };

  // Handle permissions update
  const handlePermissionsUpdate = async (permissions: { allow: string[]; deny: string[] }) => {
    if (!selectedMember) return;

    try {
      await dispatch(
        changePermissions({
          membershipId: selectedMember._id,
          permissions,
        })
      ).unwrap();
      setIsPermissionsModalOpen(false);
      setSelectedMember(null);
      console.log("Permissions updated successfully!");
      // Refresh members
      dispatch(
        fetchMembers({
          page: membersPage,
          limit: ITEMS_PER_PAGE,
          sort: membersSortDescriptor.column as string,
          dir: membersSortDescriptor.direction === "ascending" ? "asc" : "desc",
        })
      );
    } catch (error) {
      console.error("Failed to update permissions:", error);
      throw error; // Re-throw so modal can handle it
    }
  };

  // Handle member removal
  const handleRemoveMember = async (membershipId: string) => {
    try {
      await dispatch(removeMember(membershipId)).unwrap();
      
      addToast({
        title: 'Member Removed',
        description: 'Team member has been successfully removed from the organization',
        color: 'success'
      });
      
      // Refresh members
      dispatch(
        fetchMembers({
          page: membersPage,
          limit: ITEMS_PER_PAGE,
        })
      );
    } catch (error: any) {
      console.error("Failed to remove member:", error);
      
      let errorMessage = "Failed to remove member. Please try again.";
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      addToast({
        title: 'Remove Failed',
        description: errorMessage,
        color: 'danger'
      });
    }
  };

  // Handle invite revocation
  const handleRevokeInvite = async (token: string) => {
    setRevokeError(null);
    try {
      await dispatch(revokeInvite(token)).unwrap();
      
      addToast({
        title: 'Invitation Revoked',
        description: 'The invitation has been successfully revoked',
        color: 'success'
      });
      
      // Refresh invites only if user has permission
      if (hasPermission("invites.view")) {
        dispatch(
          fetchInvites({
            page: invitesPage,
            limit: ITEMS_PER_PAGE,
            sort: invitesSortDescriptor.column as string,
            dir: invitesSortDescriptor.direction === "ascending" ? "asc" : "desc",
          })
        );
      }
    } catch (error: any) {
      console.error("Failed to revoke invite:", error);

      // Handle specific backend error structure
      let errorMessage = "Failed to revoke invite. Please try again.";

      if (error?.response?.data?.message) {
        const backendError = error.response.data.message;
        if (typeof backendError === "object" && backendError.code && backendError.message) {
          // Handle structured error response
          switch (backendError.code) {
            case "INVITE_NOT_FOUND":
              errorMessage = "🔍 Invitation Not Found: This invitation no longer exists or has already been processed.";
              break;
            case "INVITE_ALREADY_REVOKED":
              errorMessage = "❌ Already Revoked: This invitation has already been cancelled.";
              break;
            case "INVITE_ALREADY_ACCEPTED":
              errorMessage = "✅ Already Accepted: This invitation has been accepted and cannot be revoked.";
              break;
            case "INSUFFICIENT_PERMISSIONS":
              errorMessage = "🚫 Permission Denied: You do not have permission to revoke this invitation.";
              break;
            case "ORGANIZATION_NOT_FOUND":
              errorMessage = "🏢 Organization Error: Unable to revoke invitation. Please try again.";
              break;
            default:
              errorMessage = backendError.message || errorMessage;
          }
        } else if (typeof backendError === "string") {
          errorMessage = backendError;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      setRevokeError(errorMessage);
      
      addToast({
        title: 'Revocation Failed',
        description: errorMessage,
        color: 'danger'
      });
      
      // Clear error after 5 seconds
      setTimeout(() => setRevokeError(null), 5000);
    }
  };

  // Handle my invitation actions
  const handleAcceptInvitation = async (token: string) => {
    setAcceptDeclineError(null);
    try {
      await dispatch(acceptInvite(token)).unwrap();
      console.log("Invitation accepted successfully!");
      // Refresh my invitations and user profile to get the new membership
      await Promise.all([dispatch(fetchMyInvitations({})), dispatch(fetchProfile())]);
      setIsInvitationDetailsModalOpen(false);
      setSelectedInvitation(null);
    } catch (error: any) {
      console.error("Failed to accept invitation:", error);

      // Handle specific backend error structure
      let errorMessage = "Failed to accept invitation. Please try again.";

      if (error?.response?.data?.message) {
        const backendError = error.response.data.message;
        console.log("ERRR:", error.response);
        if (typeof backendError === "object" && backendError.code && backendError.message) {
          // Handle structured error response
          switch (backendError.code) {
            case "INVITE_REVOKED":
              errorMessage =
                "❌ Invitation Revoked: This invitation has been cancelled by the organization admin and is no longer valid.";
              break;
            case "INVITE_EXPIRED":
              errorMessage =
                "⏰ Invitation Expired: This invitation has passed its expiry date and can no longer be accepted.";
              break;
            case "INVITE_ALREADY_ACCEPTED":
              errorMessage =
                "✅ Already Accepted: You have already accepted this invitation and are now a member of the organization.";
              break;
            case "ORGANIZATION_NOT_FOUND":
              errorMessage =
                "🏢 Organization Not Found: The organization associated with this invitation no longer exists.";
              break;
            case "INVITE_NOT_FOUND":
              errorMessage = "🔍 Invitation Not Found: This invitation link is invalid or has been removed.";
              break;
            default:
              errorMessage = backendError.message || errorMessage;
          }
        } else if (typeof backendError === "string") {
          errorMessage = backendError;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      setAcceptDeclineError(errorMessage);
    }
  };

  const handleDeclineInvitation = async (token: string) => {
    setAcceptDeclineError(null);
    try {
      await dispatch(declineInvite(token)).unwrap();
      console.log("Invitation declined successfully!");
      // Refresh my invitations
      dispatch(fetchMyInvitations({}));
      setIsInvitationDetailsModalOpen(false);
      setSelectedInvitation(null);
    } catch (error: any) {
      console.error("Failed to decline invitation:", error);

      // Handle specific backend error structure
      let errorMessage = "Failed to decline invitation. Please try again.";

      if (error?.response?.data?.message) {
        const backendError = error.response.data.message;
        if (typeof backendError === "object" && backendError.code && backendError.message) {
          // Handle structured error response
          switch (backendError.code) {
            case "INVITE_REVOKED":
              errorMessage = "❌ Invitation Revoked: This invitation has been cancelled by the organization admin.";
              break;
            case "INVITE_EXPIRED":
              errorMessage = "⏰ Invitation Expired: This invitation has passed its expiry date.";
              break;
            case "INVITE_ALREADY_ACCEPTED":
              errorMessage = "✅ Already Accepted: This invitation has already been accepted and cannot be declined.";
              break;
            case "INVITE_ALREADY_DECLINED":
              errorMessage = "❌ Already Declined: You have already declined this invitation.";
              break;
            case "INVITE_NOT_FOUND":
              errorMessage = "🔍 Invitation Not Found: This invitation link is invalid or has been removed.";
              break;
            default:
              errorMessage = backendError.message || errorMessage;
          }
        } else if (typeof backendError === "string") {
          errorMessage = backendError;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      setAcceptDeclineError(errorMessage);
    }
  };

  const handleInvitationDetails = (invitation: Invite) => {
    setSelectedInvitation(invitation);
    setAcceptDeclineError(null); // Clear any previous errors
    setIsInvitationDetailsModalOpen(true);
  };

  // Open permissions modal
  const openPermissionsModal = (member: MembershipWithUser) => {
    setSelectedMember(member);
    setIsPermissionsModalOpen(true);
  };

  // Open change role modal
  const openChangeRoleModal = (member: MembershipWithUser) => {
    setSelectedMember(member);
    setIsChangeRoleModalOpen(true);
  };

  // Handle permission toggle (legacy - keeping for backward compatibility)
  const handlePermissionToggle = (permissionKey: string, action: "allow" | "deny" | "inherit") => {
    setMemberPermissions((prev) => {
      const newAllow = prev.allow.filter((key) => key !== permissionKey);
      const newDeny = prev.deny.filter((key) => key !== permissionKey);

      if (action === "allow") {
        newAllow.push(permissionKey);
      } else if (action === "deny") {
        newDeny.push(permissionKey);
      }
      // inherit means remove from both arrays

      return { allow: newAllow, deny: newDeny };
    });
  };

  // Get permission state for a key
  const getPermissionState = (permissionKey: string): "allow" | "deny" | "inherit" => {
    if (memberPermissions.allow.includes(permissionKey)) return "allow";
    if (memberPermissions.deny.includes(permissionKey)) return "deny";
    return "inherit";
  };

  // Members table columns
  const membersColumns = [
    { key: "user", label: "USER" },
    { key: "role", label: "ROLE" },
    { key: "createdAt", label: "JOINED" },
    { key: "actions", label: "ACTIONS" },
  ];

  if (!activeOrgReady) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? "p-4" : "p-6"}`}>
      {/* Back Navigation */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="light"
          size="sm"
          startContent={<ArrowLeftIcon className="h-4 w-4" />}
          onPress={() => navigate(-1)}
        >
          Back
        </Button>
        <ChevronRightIcon className="h-4 w-4 text-default-400" />
        <span className="text-sm text-default-500">Team Management</span>
      </div>

      <div className={`${isMobile ? "space-y-4" : "flex justify-between items-center"} mb-6`}>
        <div>
          <div className="flex items-center gap-3">
            <h1 className={`font-bold ${isMobile ? "text-2xl" : "text-3xl"}`}>Team Management</h1>
            {pendingMyInvitationsCount > 0 && (
              <div className="flex items-center gap-2">
                <Chip size="sm" color="primary" className="animate-pulse">
                  {pendingMyInvitationsCount} pending invitation{pendingMyInvitationsCount > 1 ? "s" : ""}
                </Chip>
              </div>
            )}
          </div>
          {!isMobile && <p className="text-gray-600 mt-1">Manage your organization's team members and permissions</p>}
        </div>
        <PermissionButton
          permissions={["invites.create"]}
          color="primary"
          startContent={<PlusIcon className="w-4 h-4" />}
          onPress={() => {
            setInviteError(null); // Clear any previous errors
            setIsInviteModalOpen(true);
          }}
          className={isMobile ? "w-full" : ""}
          lockedTooltip="You don't have permission to invite members"
        >
          Invite Member
        </PermissionButton>
      </div>

      <Card className={isMobile ? "shadow-none border-0" : ""}>
        <CardBody className={isMobile ? "p-0" : ""}>
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as string)}
            className="w-full"
            classNames={{
              tabList: isMobile ? "w-full" : "",
              tab: isMobile ? "flex-1" : "",
              panel: isMobile ? "px-0" : "",
            }}
          >
            <Tab key="members" title={`Members (${membersPagination?.total || 0})`}>
              <div className="space-y-4">
                {/* {!isMobile && (
                  <div className="flex justify-between items-center">
                    <Input
                      placeholder="Search members..."
                      value={membersSearch}
                      onChange={(e) => setMembersSearch(e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                )} */}

                <Table
                  isHeaderSticky
                  sortDescriptor={membersSortDescriptor}
                  onSortChange={setMembersSortDescriptor}
                  className={isMobile ? "text-xs" : ""}
                  classNames={{
                    table: isMobile ? "min-w-full" : "",
                    th: isMobile ? "px-2 py-3 text-xs" : "",
                    td: isMobile ? "px-2 py-3" : "",
                  }}
                  bottomContent={
                    membersPagination && membersPagination.totalPages > 1 ? (
                      <div className="flex w-full justify-center">
                        <Pagination
                          isCompact
                          showControls
                          showShadow
                          color="primary"
                          page={membersPage}
                          total={membersPagination.totalPages}
                          onChange={(page) => setMembersPage(page)}
                        />
                      </div>
                    ) : null
                  }
                >
                  <TableHeader columns={membersColumns}>
                    {(column) => (
                      <TableColumn key={column.key} allowsSorting={column.key !== "actions"}>
                        {column.label}
                      </TableColumn>
                    )}
                  </TableHeader>
                  <TableBody
                    items={membersLoading && (!members || members.length === 0) ? [] : members}
                    isLoading={membersLoading && (!members || members.length === 0)}
                    loadingContent={<Spinner size="lg" label="Loading members..." />}
                    emptyContent={
                      membersLoading ? (
                        <div className="flex justify-center items-center py-10">
                          <Spinner size="lg" />
                        </div>
                      ) : (
                        "No team members found"
                      )
                    }
                  >
                    {(member: MembershipWithUser) => (
                      <TableRow
                        key={member._id}
                        className="hover:bg-gray-50/50 odd:bg-gray-50/25 dark:odd:bg-gray-800/25 dark:hover:bg-gray-800/50"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={isMobile ? "min-w-0" : ""}>
                              <div className={`font-medium ${isMobile ? "text-xs" : ""} flex items-center gap-2`}>
                                <span>{member.user?.displayName || member.user?.email}</span>
                                {member.user?.email === profile.data?.user?.email && (
                                  <Chip size="sm" color="primary" variant="flat" className="text-xs">
                                    me
                                  </Chip>
                                )}
                              </div>
                              {!isMobile && <div className="text-sm text-gray-500">{member.user?.email}</div>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip
                            color={roleColors[member.role]}
                            size={isMobile ? "sm" : "sm"}
                            className={isMobile ? "text-xs" : ""}
                          >
                            {isMobile ? member.role.charAt(0).toUpperCase() : member.role}
                          </Chip>
                        </TableCell>
                        <TableCell className={isMobile ? "text-xs" : ""}>
                          {new Date(member?.acceptedAt || member?.createdAt).toLocaleDateString(
                            undefined,
                            isMobile ? { month: "short", day: "numeric" } : undefined
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <PermissionWrapper permissions={["teams.roles", "teams.permissions", "teams.remove.members"]}>
                              <Dropdown>
                                <DropdownTrigger>
                                  <Button isIconOnly size={isMobile ? "sm" : "sm"} variant="light">
                                    <EllipsisVerticalIcon className={"w-4 h-4"} />
                                  </Button>
                                </DropdownTrigger>
                                <DropdownMenu>
                                  <DropdownItem
                                    key="permissions"
                                    onClick={() => openPermissionsModal(member)}
                                    className={isMobile ? "text-xs" : ""}
                                  >
                                    Edit Permissions
                                  </DropdownItem>
                                  <DropdownItem
                                    key="role"
                                    onClick={() => openChangeRoleModal(member)}
                                    className={isMobile ? "text-xs" : ""}
                                  >
                                    Change Role
                                  </DropdownItem>
                                  <DropdownItem
                                    key="remove"
                                    className={`text-danger ${isMobile ? "text-xs" : ""}`}
                                    color="danger"
                                    onClick={() => handleRemoveMember(member._id)}
                                    isDisabled={membersDeletingId === member._id}
                                  >
                                    {membersDeletingId === member._id ? "Removing..." : "Remove Member"}
                                  </DropdownItem>
                                </DropdownMenu>
                              </Dropdown>
                            </PermissionWrapper>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="invites" title={`Invited Members (${invitesPagination?.total || 0})`}>
              <PermissionWrapper
                permissions={["invites.view"]}
                fallback={
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Icon icon="lucide:shield-x" className="w-16 h-16 text-default-300" />
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-default-700">Access Denied</h3>
                      <p className="text-default-500 mt-2">You don't have permission to view invitations.</p>
                    </div>
                  </div>
                }
              >
                <div className="space-y-4">
                {revokeError && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-red-800 text-sm font-medium">{revokeError}</p>
                    </div>
                  </div>
                )}
                {invitesLoading && (!invites || invites.length === 0) ? (
                  <div className="flex justify-center items-center py-10">
                    <Spinner size="lg" label="Loading invites..." />
                  </div>
                ) : invites && invites.length > 0 ? (
                  (() => {
                    const { pending, accepted, others } = categorizeInvites(invites);
                    return (
                      <Accordion
                        variant="splitted"
                        defaultExpandedKeys={["pending"]}
                        className={isMobile ? "px-0" : ""}
                      >
                        {/* Pending Invites - Always on top */}
                        <AccordionItem
                          key="pending"
                          aria-label="Pending Invites"
                          title={
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Pending Invites</span>
                              <Chip size="sm" color="primary" variant="flat">
                                {pending.length}
                              </Chip>
                            </div>
                          }
                          className={isMobile ? "text-sm" : ""}
                        >
                          <InviteTable
                            invites={pending}
                            isMobile={isMobile}
                            handleRevokeInvite={handleRevokeInvite}
                            showActions={true}
                            revokingId={invitesRevokingId}
                            currentUserEmail={profile.data?.user?.email}
                          />
                        </AccordionItem>

                        {/* Accepted Invites */}
                        <AccordionItem
                          key="accepted"
                          aria-label="Accepted Invites"
                          title={
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Accepted Invites</span>
                              <Chip size="sm" color="success" variant="flat">
                                {accepted.length}
                              </Chip>
                            </div>
                          }
                          className={isMobile ? "text-sm" : ""}
                        >
                          <InviteTable
                            invites={accepted}
                            isMobile={isMobile}
                            handleRevokeInvite={handleRevokeInvite}
                            showActions={false}
                            revokingId={invitesRevokingId}
                            currentUserEmail={profile.data?.user?.email}
                          />
                        </AccordionItem>

                        {/* Other Statuses (Declined, Expired, Revoked, etc.) */}
                        <AccordionItem
                          key="others"
                          aria-label="Other Invites"
                          title={
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Declined/Expired/Revoked</span>
                              <Chip size="sm" color="default" variant="flat">
                                {others.length}
                              </Chip>
                            </div>
                          }
                          className={isMobile ? "text-sm" : ""}
                        >
                          <InviteTable
                            invites={others}
                            isMobile={isMobile}
                            handleRevokeInvite={handleRevokeInvite}
                            showActions={false}
                            revokingId={invitesRevokingId}
                            currentUserEmail={profile.data?.user?.email}
                          />
                        </AccordionItem>
                      </Accordion>
                    );
                  })()
                ) : (
                  <div className="flex justify-center items-center py-10 text-gray-500">No invitations found</div>
                )}

                {/* Pagination */}
                {invitesPagination && invitesPagination.totalPages > 1 && (
                  <div className="flex w-full justify-center">
                    <Pagination
                      isCompact
                      showControls
                      showShadow
                      color="primary"
                      page={invitesPage}
                      total={invitesPagination.totalPages}
                      onChange={(page) => setInvitesPage(page)}
                    />
                  </div>
                )}
              </div>
              </PermissionWrapper>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
        size={isMobile ? "md" : "md"}
        className={isMobile ? "m-0" : ""}
        classNames={{
          wrapper: isMobile ? "p-0" : "",
          base: isMobile ? "m-0" : "",
          body: isMobile ? "p-4" : "",
          header: isMobile ? "p-4 pb-2" : "",
          footer: isMobile ? "p-4 pt-2" : "",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h3>Invite Team Member</h3>
                <p className="text-sm text-gray-600">Send an invitation to join your organization</p>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  {inviteError && (
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-red-800 text-sm font-medium">{inviteError}</p>
                      </div>
                    </div>
                  )}
                  <Input
                    label="Email Address"
                    placeholder="Enter email address"
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    onValueChange={() => setInviteError(null)} // Clear error on input change
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <div className="flex flex-col gap-2">
                      {[UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN].map((role) => (
                        <label key={role} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="role"
                            value={role}
                            checked={inviteForm.role === role}
                            onChange={(e) =>
                              setInviteForm((prev) => ({
                                ...prev,
                                role: e.target.value as UserRole,
                              }))
                            }
                          />
                          <span className="text-sm">
                            {role === UserRole.VIEWER && "Viewer - Can view data and dashboards"}
                            {role === UserRole.MEMBER && "Member - Can manage sensors and gateways"}
                            {role === UserRole.ADMIN && "Admin - Full access to organization"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className={isMobile ? "flex-col gap-2" : ""}>
                <Button color="danger" variant="light" onPress={onClose} className={isMobile ? "w-full" : ""}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={handleInviteSubmit}
                  isDisabled={!inviteForm.email || !inviteForm.role}
                  isLoading={isSubmittingInvite}
                  startContent={!isSubmittingInvite ? <PaperAirplaneIcon className="w-4 h-4" /> : undefined}
                  className={isMobile ? "w-full" : ""}
                >
                  {isSubmittingInvite ? "Sending..." : "Send Invite"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Change Role Modal */}
      {selectedMember && (
        <ChangeRoleModal
          isOpen={isChangeRoleModalOpen}
          onOpenChange={setIsChangeRoleModalOpen}
          memberName={selectedMember.user?.displayName || selectedMember.user?.email || "Unknown User"}
          currentRole={selectedMember.role}
          currentPermissions={{
            allow: selectedMember.allow || [],
            deny: selectedMember.deny || [],
          }}
          permissionCategories={permissionsCategories || []}
          onSave={(role, permissions) => handleRoleChange(selectedMember._id, role, permissions)}
          isLoading={membersUpdatingId === selectedMember._id}
          error={membersError}
        />
      )}

      {/* Edit Permissions Modal */}
      {selectedMember && (
        <EditPermissionsModal
          isOpen={isPermissionsModalOpen}
          onOpenChange={setIsPermissionsModalOpen}
          memberName={selectedMember.user?.displayName || selectedMember.user?.email || "Unknown User"}
          memberRole={selectedMember.role}
          currentPermissions={{
            allow: selectedMember.allow || [],
            deny: selectedMember.deny || [],
          }}
          permissionCategories={permissionsCategories || []}
          onSave={handlePermissionsUpdate}
          isLoading={membersUpdatingId === selectedMember._id}
          error={membersError}
        />
      )}

      {/* Invitation Details Modal */}
      {selectedInvitation && (
        <Modal
          isOpen={isInvitationDetailsModalOpen}
          onOpenChange={setIsInvitationDetailsModalOpen}
          size={isMobile ? "md" : "lg"}
          className={isMobile ? "m-0" : ""}
          classNames={{
            wrapper: isMobile ? "p-0" : "",
            base: isMobile ? "m-0 max-h-[90vh]" : "",
            body: isMobile ? "p-4" : "",
            header: isMobile ? "p-4 pb-2" : "",
            footer: isMobile ? "p-4 pt-2" : "",
          }}
        >
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <h3>Invitation Details</h3>
                  <p className="text-sm text-gray-600">Review and respond to this invitation</p>
                </ModalHeader>
                <ModalBody>
                  <div className="space-y-6">
                    {acceptDeclineError && (
                      <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-red-800 text-sm font-medium">{acceptDeclineError}</p>
                        </div>
                      </div>
                    )}
                    {/* Organization Info */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-lg">Organization</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="font-medium text-lg">{selectedInvitation.orgId.name}</p>
                        <p className="text-sm text-gray-600">
                          Invited By:{" "}
                          {typeof selectedInvitation.invitedBy === "string"
                            ? selectedInvitation.invitedBy
                            : selectedInvitation.invitedBy?.email}
                        </p>
                      </div>
                    </div>

                    {/* Role & Permissions */}
                    <div className="space-y-2">
                      <h4 className="font-semibold">Your Role</h4>
                      <Chip color={roleColors[selectedInvitation.role as UserRole]} variant="flat" size="lg">
                        {selectedInvitation.role}
                      </Chip>

                      {selectedInvitation.allow && selectedInvitation.allow.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-green-700 mb-2">Granted Permissions:</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedInvitation.allow.map((permission) => (
                              <Chip key={permission} size="sm" color="success" variant="flat">
                                {permission}
                              </Chip>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Invitation Details */}
                    <div className="space-y-2">
                      <h4 className="font-semibold">Invitation Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status:</span>
                          {(() => {
                            const statusInfo = getMyInvitationStatus(selectedInvitation);
                            return (
                              <Chip color={statusInfo.color} variant="flat" size="sm">
                                {statusInfo.status}
                              </Chip>
                            );
                          })()}
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Invited by:</span>
                          <span>
                            {typeof selectedInvitation.invitedBy === "string"
                              ? selectedInvitation.invitedBy
                              : selectedInvitation.invitedBy.email}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Invited on:</span>
                          <span>{new Date(selectedInvitation.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Expires on:</span>
                          <span className={new Date(selectedInvitation.expiresAt) < new Date() ? "text-red-600" : ""}>
                            {new Date(selectedInvitation.expiresAt).toLocaleDateString()}
                            {new Date(selectedInvitation.expiresAt) < new Date() && " (Expired)"}
                          </span>
                        </div>
                        {selectedInvitation.acceptedAt && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Accepted on:</span>
                            <span>{new Date(selectedInvitation.acceptedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="light" onPress={onClose}>
                    Close
                  </Button>
                  {(() => {
                    const statusInfo = getMyInvitationStatus(selectedInvitation);
                    return statusInfo.status === "PENDING";
                  })() && (
                    <div className="flex gap-2">
                      <Button
                        color="danger"
                        variant="light"
                        onPress={() => handleDeclineInvitation(selectedInvitation.token)}
                        isLoading={decliningToken === selectedInvitation.token}
                      >
                        Decline
                      </Button>
                      <Button
                        color="success"
                        onPress={() => handleAcceptInvitation(selectedInvitation.token)}
                        isLoading={acceptingToken === selectedInvitation.token}
                      >
                        Accept Invitation
                      </Button>
                    </div>
                  )}
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      )}
    </div>
  );
};
