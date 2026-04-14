import { STATIC_COORDINATOR, buildDynamicCoordinator } from "./layers";

export function buildCoordinatorPrompt(
  promptAppend?: string,
  visibilityMode: string = "summary",
): string {
  const dynamic = buildDynamicCoordinator(visibilityMode, promptAppend);
  return `${STATIC_COORDINATOR}\n\n${dynamic}`;
}
