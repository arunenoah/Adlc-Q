import { readStore } from "@/lib/store";
import { scanWorkspace } from "@/lib/workspace";
import { DevOSShell } from "./devos-shell";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [store, discoveredProjects] = await Promise.all([
    readStore(),
    scanWorkspace(),
  ]);

  return (
    <DevOSShell
      initialProjects={store.projects}
      initialClis={store.clis}
      discoveredProjects={discoveredProjects}
    />
  );
}
