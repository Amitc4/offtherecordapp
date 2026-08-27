/**
 * @file friendRequests.ts — Cross-component signal for focusing friend requests.
 *
 * Tapping a `friend_request` notification should land the user on the Profile
 * tab with the "Pending Friend Requests" section expanded. The notifications
 * bell lives outside the router/tab tree, so it dispatches a window event that
 * `HomePage` listens for and forwards to `ProfileScreen`.
 */
export const OPEN_FRIEND_REQUESTS_EVENT = "otr:open-friend-requests";

/** Ask the app to show the Profile tab with pending friend requests open. */
export const requestFriendRequestsFocus = () => {
  window.dispatchEvent(new CustomEvent(OPEN_FRIEND_REQUESTS_EVENT));
};
