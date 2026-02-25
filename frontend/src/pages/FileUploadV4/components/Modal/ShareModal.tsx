import { Modal, TextInput, Button, Group, Checkbox, Stack, Text, Badge, ActionIcon, Tooltip, Divider, Loader, Alert } from "@mantine/core";
import { IconTrash, IconShare, IconAlertCircle } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import {
    useSharesForItem,
    useShareItem,
    useRevokeShare,
    useUpdateSharePermissions,
    SharePermission,
    ShareItem,
} from "../../hooks/useSharing";

interface ShareModalProps {
    opened: boolean;
    onClose: () => void;
    itemId: string;
    itemName: string;
}

const PERMISSION_OPTIONS: { value: SharePermission; label: string; description: string }[] = [
    { value: "view", label: "View", description: "Can view the file" },
    { value: "edit", label: "Edit", description: "Can edit the file" },
    { value: "update", label: "Update", description: "Can update/replace the file" },
    { value: "download", label: "Download", description: "Can download the file" },
];

export default function ShareModal({ opened, onClose, itemId, itemName }: ShareModalProps) {
    const [email, setEmail] = useState("");
    const [selectedPermissions, setSelectedPermissions] = useState<SharePermission[]>(["view"]);

    const { data: shares, isLoading } = useSharesForItem(opened ? itemId : null);
    const shareItemMutation = useShareItem();
    const revokeShareMutation = useRevokeShare();
    const updatePermissionsMutation = useUpdateSharePermissions();

    const handleShare = async () => {
        if (!email.trim()) {
            toast.error("Please enter an email address");
            return;
        }
        if (selectedPermissions.length === 0) {
            toast.error("Please select at least one permission");
            return;
        }

        try {
            await shareItemMutation.mutateAsync({
                itemId,
                sharedWithEmail: email.trim(),
                permissions: selectedPermissions,
            });
            toast.success(`Shared "${itemName}" with ${email}`);
            setEmail("");
            setSelectedPermissions(["view"]);
        } catch (error: any) {
            const message = error?.response?.data?.message || "Failed to share";
            toast.error(message);
        }
    };

    const handleRevoke = async (shareId: string) => {
        try {
            await revokeShareMutation.mutateAsync(shareId);
            toast.success("Share revoked");
        } catch {
            toast.error("Failed to revoke share");
        }
    };

    const handleTogglePermission = async (share: ShareItem, perm: SharePermission) => {
        const current = share.permissions || [];
        let updated: SharePermission[];
        if (current.includes(perm)) {
            updated = current.filter((p) => p !== perm);
        } else {
            updated = [...current, perm];
        }
        if (updated.length === 0) {
            toast.error("At least one permission is required");
            return;
        }

        try {
            await updatePermissionsMutation.mutateAsync({
                shareId: share._id,
                permissions: updated,
            });
        } catch {
            toast.error("Failed to update permissions");
        }
    };

    const toggleNewPermission = (perm: SharePermission) => {
        setSelectedPermissions((prev) =>
            prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
        );
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={
                <Group gap="xs">
                    <IconShare size={20} />
                    <Text fw={600}>Share "{itemName}"</Text>
                </Group>
            }
            size="md"
        >
            <Stack gap="md">
                {/* Share with new user */}
                <div>
                    <TextInput
                        label="Share with"
                        placeholder="Enter email address"
                        value={email}
                        onChange={(e) => setEmail(e.currentTarget.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleShare()}
                    />
                    <Group gap="xs" mt="xs">
                        {PERMISSION_OPTIONS.map((opt) => (
                            <Checkbox
                                key={opt.value}
                                label={opt.label}
                                checked={selectedPermissions.includes(opt.value)}
                                onChange={() => toggleNewPermission(opt.value)}
                                size="xs"
                            />
                        ))}
                    </Group>
                    <Button
                        mt="sm"
                        size="sm"
                        onClick={handleShare}
                        loading={shareItemMutation.isPending}
                        leftSection={<IconShare size={16} />}
                        fullWidth
                    >
                        Share
                    </Button>
                </div>

                <Divider label="Currently shared with" labelPosition="center" />

                {/* Existing shares */}
                {isLoading ? (
                    <Group justify="center" py="md">
                        <Loader size="sm" />
                    </Group>
                ) : shares && shares.length > 0 ? (
                    <Stack gap="xs">
                        {shares.map((share) => {
                            const user = share.sharedWithId as any;
                            const displayName = user?.firstName
                                ? `${user.firstName} ${user.lastName || ""}`
                                : user?.email || "Unknown user";
                            const userEmail = user?.email || "";

                            return (
                                <div
                                    key={share._id}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: 8,
                                        border: "1px solid var(--mantine-color-gray-3)",
                                        backgroundColor: "var(--mantine-color-gray-0)",
                                    }}
                                >
                                    <Group justify="space-between" align="center">
                                        <div>
                                            <Text size="sm" fw={500}>
                                                {displayName}
                                            </Text>
                                            <Text size="xs" c="dimmed">
                                                {userEmail}
                                            </Text>
                                        </div>
                                        <Tooltip label="Revoke access">
                                            <ActionIcon
                                                color="red"
                                                variant="subtle"
                                                size="sm"
                                                onClick={() => handleRevoke(share._id)}
                                                loading={revokeShareMutation.isPending}
                                            >
                                                <IconTrash size={14} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </Group>
                                    <Group gap={4} mt={4}>
                                        {PERMISSION_OPTIONS.map((opt) => (
                                            <Badge
                                                key={opt.value}
                                                size="sm"
                                                variant={share.permissions.includes(opt.value) ? "filled" : "outline"}
                                                color={share.permissions.includes(opt.value) ? "blue" : "gray"}
                                                style={{ cursor: "pointer" }}
                                                onClick={() => handleTogglePermission(share, opt.value)}
                                            >
                                                {opt.label}
                                            </Badge>
                                        ))}
                                    </Group>
                                </div>
                            );
                        })}
                    </Stack>
                ) : (
                    <Alert icon={<IconAlertCircle size={16} />} color="gray" variant="light">
                        Not shared with anyone yet
                    </Alert>
                )}
            </Stack>
        </Modal>
    );
}
