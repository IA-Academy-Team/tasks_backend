import { describe, it } from "vitest";
import { runLiveEndpointsScenario } from "../scripts/test-endpoints-live.js";

describe("Live endpoints scenario", () => {
  it(
    "passes end-to-end API checks",
    async () => {
      await runLiveEndpointsScenario();
    },
    300_000,
  );
});
