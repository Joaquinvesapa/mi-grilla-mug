/** A friend in a group: what the grid shows of them, never their account id (R-02). */
export type FriendPicks = { name: string; initials: string; showIds: string[] };

/** One of the user's groups, with the other members and their saved selection. */
export type GroupPicks = { id: string; name: string; friends: FriendPicks[] };
