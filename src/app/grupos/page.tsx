import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createGroupAction } from "@/app/group-actions";
import { CreateGroupForm } from "@/components/create-group-form";
import { Button } from "@/components/ui/button";
import { GROUPS_LOAD_FAILED, memberCountLabel, NO_GROUPS } from "@/lib/group-messages";
import { getAccounts } from "@/server/accounts";
import { listGroups } from "@/server/groups";

export const metadata: Metadata = {
  title: "Grupos · Mi Grilla",
};

// "Grupos" (FR-11): the user's groups, each a link to its screen with its members' initials, and the
// form to create one. Dynamic: it reads the request's cookies, and the list is always this user's
// (R-04). The headers are read before getAccounts(), so nothing creates Better Auth while
// `next build` prerenders. It scrolls in the document, inside the shell's safe areas.
export default async function GroupsPage() {
  const requestHeaders = await headers();
  const user = await getAccounts().getCurrentUser(requestHeaders);
  if (!user) {
    redirect("/login");
  }

  const result = await listGroups(user.id);

  return (
    <main className="app-screen mx-auto flex w-full max-w-md flex-col gap-6 px-5 pt-4 pb-12">
      <header className="flex flex-col items-start gap-2">
        <Button asChild variant="link" className="px-0">
          <Link href="/">Volver a la grilla</Link>
        </Button>
        <h1 className="text-4xl font-semibold tracking-tight">Grupos</h1>
      </header>

      {result.ok ? (
        result.groups.length > 0 ? (
          <ul aria-label="Tus grupos" className="flex flex-col gap-3">
            {result.groups.map((group) => (
              <li key={group.id}>
                <Link
                  href={`/grupos/${group.id}`}
                  className="app-card gap-3 transition-colors hover:bg-accent/50"
                >
                  {/* Read as "Los del Lolla, 3 integrantes": the initials are for the eye. */}
                  <span className="truncate text-lg font-semibold">
                    {group.name}
                    <span className="sr-only">, {memberCountLabel(group.members.length)}</span>
                  </span>
                  <span aria-hidden="true" className="flex flex-wrap gap-1.5">
                    {group.members.map((member, index) => (
                      // Members have no id here and two can share a name; the order is stable.
                      <span
                        key={index}
                        title={member.name}
                        className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold"
                      >
                        {member.initials}
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{NO_GROUPS}</p>
        )
      ) : (
        // Only the screen's own message: what failed stays in the server log (R-08).
        <p role="alert" className="app-card text-muted-foreground">
          {GROUPS_LOAD_FAILED}
        </p>
      )}

      <section aria-labelledby="create-group" className="app-card">
        <h2 id="create-group" className="text-xl font-semibold">
          Crear un grupo
        </h2>
        <CreateGroupForm action={createGroupAction} />
      </section>
    </main>
  );
}
