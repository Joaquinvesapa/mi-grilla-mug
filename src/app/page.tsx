import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/auth-actions";
import { saveSelectionAction } from "@/app/selection-actions";
import { AppBar } from "@/components/app-menu";
import { ScheduleScreen } from "@/components/schedule-screen";
import { festivalDayFor } from "@/lib/festival-time";
import { selectionMessageFor } from "@/lib/selection-messages";
import { getAccounts } from "@/server/accounts";
import { listGroupPicks } from "@/server/groups";
import { getSchedule } from "@/server/schedule";
import { getSelection } from "@/server/selection";

// The grid, full screen (FR-15: only with a session). The proxy already sent away requests without
// a cookie; here the session is verified for real, so a made-up, expired or closed-session cookie
// ends on /login too, before anything protected renders. Dynamic: it reads the request's cookies,
// so it is never prerendered or shared, and the service worker never caches navigations (R-11).
// The headers are read before getAccounts(), so nothing creates Better Auth while `next build`
// prerenders.
export default async function HomePage() {
  const requestHeaders = await headers();
  const user = await getAccounts().getCurrentUser(requestHeaders);
  if (!user) {
    redirect("/login");
  }

  // The grid comes from the in-process memo; the selection and the groups are always read for this
  // user (R-12, FEAT-006c R-01), all three at once (NFR-01).
  const [schedule, selection, picks] = await Promise.all([
    getSchedule(),
    getSelection(user.id),
    listGroupPicks(user.id),
  ]);

  if (!schedule.ok || !selection.ok || schedule.schedule.days.length === 0) {
    // Only the screen's own message: what failed and why stays in the server log (R-05).
    return (
      <main className="app-fixed-screen mx-auto flex w-full max-w-md flex-col">
        <AppBar userName={user.name} logoutAction={logoutAction} pendingCount={0} />
        <div className="flex flex-1 items-center px-5">
          <p role="alert" className="app-card w-full text-muted-foreground">
            {selectionMessageFor("SCHEDULE_UNAVAILABLE")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <ScheduleScreen
      schedule={schedule.schedule}
      savedShowIds={selection.showIds}
      initialDayId={festivalDayFor(new Date(), schedule.schedule.days)}
      userName={user.name}
      userId={user.id}
      mode="online"
      // Groups that could not be loaded cost only the groups: the grid shows without the picker,
      // and the device copy keeps the ones it had (FEAT-006c).
      groups={picks.ok ? picks.groups : null}
      saveAction={saveSelectionAction}
      logoutAction={logoutAction}
    />
  );
}
