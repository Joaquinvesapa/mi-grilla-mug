import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { joinGroupAction } from "@/app/group-actions";
import { JoinGroupForm } from "@/components/join-group-form";
import { Button } from "@/components/ui/button";
import {
  BACK_TO_SCHEDULE,
  groupMessageFor,
  INVITATION_LEAD,
  INVITATION_LOAD_FAILED,
  memberCountLabel,
} from "@/lib/group-messages";
import { safeReturnPath, withReturnPath } from "@/lib/return-path";
import { getAccounts } from "@/server/accounts";
import { getInvitePreview } from "@/server/groups";

// A fixed title: the group's name is only for whoever opens the link with a session, and never
// goes in the metadata.
export const metadata: Metadata = {
  title: "Invitación · Mi Grilla",
};

// An invitation (FR-06 to FR-10). Without a session it goes to /login and comes back here after
// signing in, carrying only an allow-listed `next` (FR-07, R-10). With one: a member goes straight to
// the group, even with an expired link (FR-10); an expired, replaced, unknown or malformed link
// shows FR-08's message without the group's name; otherwise the group's name, its member count and
// "Unirme". Dynamic: it reads the request's cookies. The headers are read before getAccounts(), so
// nothing creates Better Auth while `next build` prerenders. It scrolls in the document, inside the
// shell's safe areas.
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const requestHeaders = await headers();
  const user = await getAccounts().getCurrentUser(requestHeaders);
  if (!user) {
    redirect(withReturnPath("/login", safeReturnPath(`/invitacion/${token}`)));
  }

  const preview = await getInvitePreview(user.id, token);
  if (preview.ok && preview.alreadyMember) {
    redirect(`/grupos/${preview.groupId}`);
  }

  return (
    <main className="app-screen mx-auto flex w-full max-w-md flex-col gap-6 px-5 pt-4 pb-12">
      <header className="flex flex-col items-start gap-2">
        <Button asChild variant="link" className="px-0">
          <Link href="/">{BACK_TO_SCHEDULE}</Link>
        </Button>
      </header>

      {preview.ok ? (
        <section aria-labelledby="invited-group" className="app-card gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground">{INVITATION_LEAD}</p>
            <h1 id="invited-group" className="text-4xl font-semibold tracking-tight break-words">
              {preview.name}
            </h1>
            <p className="text-lg text-muted-foreground">{memberCountLabel(preview.memberCount)}</p>
          </div>
          <JoinGroupForm action={joinGroupAction} token={token} />
        </section>
      ) : (
        // Only the screen's own message: nothing of the group, and what failed stays in the server
        // log (R-08).
        <p role="alert" className="app-card text-muted-foreground">
          {preview.code === "INVALID_INVITE"
            ? groupMessageFor("INVALID_INVITE")
            : INVITATION_LOAD_FAILED}
        </p>
      )}
    </main>
  );
}
