import {
  acceptFriendRequest,
  cancelFriendRequest,
  getLocationSettings,
  getNearbyUsers,
  getNearbyFriendsConfig,
  listFriendRequests,
  listFriends,
  rejectFriendRequest,
  removeFriend,
  reportLocation,
  sendFriendRequest,
  updateLocationSettings,
  type FriendRequestDto,
  type ReportLocationDto,
  type UpdateLocationSettingsDto,
} from '../generated/api';

export const friendsQueryKey = ['friends'] as const;
export const locationsQueryKey = ['locations'] as const;

export type { LocationDto, LocationSettingsDto, NearbyFriendsConfigDto } from '../generated/api';

export async function readNearbyFriendsConfig() {
  return (await getNearbyFriendsConfig({ throwOnError: true })).data;
}

export async function readLocationSettings() {
  return (await getLocationSettings({ throwOnError: true })).data;
}

export async function saveLocationSettings(body: UpdateLocationSettingsDto) {
  return (await updateLocationSettings({ body, throwOnError: true })).data;
}

export async function uploadLocation(body: ReportLocationDto, signal: AbortSignal) {
  return (await reportLocation({ body, signal, throwOnError: true })).data;
}

export async function readNearbyUsers(signal: AbortSignal) {
  return (await getNearbyUsers({ signal, throwOnError: true })).data;
}

export async function readFriendRequests(
  direction: 'incoming' | 'outgoing',
  signal: AbortSignal,
  status?: FriendRequestDto['status'],
) {
  return (
    await listFriendRequests({
      query: { direction, ...(status ? { status } : {}) },
      signal,
      throwOnError: true,
    })
  ).data;
}

export async function readFriends(signal: AbortSignal) {
  return (
    await listFriends({
      signal,
      throwOnError: true,
    })
  ).data;
}

export type FriendAction =
  | { action: 'send'; userId: string }
  | { action: 'accept' | 'reject' | 'cancel'; requestId: string }
  | { action: 'remove'; relationshipId: string };

export async function performFriendAction(input: FriendAction): Promise<void> {
  if (input.action === 'send') {
    await sendFriendRequest({
      body: { recipientUserId: input.userId },
      throwOnError: true,
    });
  } else if (input.action === 'remove') {
    await removeFriend({ path: { relationshipId: input.relationshipId }, throwOnError: true });
  } else {
    const operation =
      input.action === 'accept'
        ? acceptFriendRequest
        : input.action === 'reject'
          ? rejectFriendRequest
          : cancelFriendRequest;
    await operation({ path: { requestId: input.requestId }, throwOnError: true });
  }
}
