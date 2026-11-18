import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { regenerateInviteAction } from "@/app/group-actions";
import { GroupMembers } from "@/components/group-members";
import { InviteLink } from "@/components/invite-link";
import { Button } from "@/components/ui/button";
import { GROUP_LOAD_FAILED } from "@/lib/group-messages";
import { getAccounts } from "@/server/accounts";
import { getGroup } from "@/server/groups";

// A fixed title: the group's name is only for its members, and never goes in the metadata.
export const metadata: Metadata = {
  title: "Grupo · Mi Grilla",
};

// A group's screen (FR-04, FR-05, FR-11): its name, its members and its invite link. Someone else's
// group, one that does not exist and a malformed id all answer `notFound()`, with nothing of the
// group (FR-12, R-04). Dynamic: it reads the request's cookies. The headers are read before
// getAccounts(), so nothing creates Better Auth while `next build` prerenders.
export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const requestHeaders = await headers();
  const user = await getAccounts().getCurrentUser(requestHeaders);
  if (!user) {
    redirect("/login");
  }

  const result = await getGroup(user.id, groupId);
  if (!result.ok && result.code === "NOT_FOUND") {
    notFound();
  }

  return (
    <main className="app-screen mx-auto flex w-full max-w-md flex-col gap-6 px-5 pt-4 pb-12">
      <header className="flex flex-col items-start gap-2">
        <Button asChild variant="link" className="px-0">
          <Link href="/grupos">Volver a Grupos</Link>
        </Button>
        {result.ok ? (
          <h1 className="text-4xl font-semibold tracking-tight break-words">{result.group.name}</h1>
        ) : null}
      </header>

      {result.ok ? (
        <>
          <section aria-labelledby="members" className="app-card">
            <h2 id="members" className="text-xl font-semibold">
              Integrantes
            </h2>
            <GroupMembers members={result.group.members} />
          </section>
          <InviteLink
            groupId={result.group.id}
            groupName={result.group.name}
            invite={result.group.invite}
            isAdmin={result.group.isAdmin}
            now={new Date()}
            regenerateAction={regenerateInviteAction}
          />
        </>
      ) : (
        // Only the screen's own message: what failed stays in the server log (R-08).
        <p role="alert" className="app-card text-muted-foreground">
          {GROUP_LOAD_FAILED}
        </p>
      )}
    </main>
  );
}
