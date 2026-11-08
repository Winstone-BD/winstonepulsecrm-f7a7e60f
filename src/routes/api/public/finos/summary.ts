import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/finos/summary")({
  server: { handlers: {
    POST: async ({ request }) => {
      const { handleFinosSummary, finosApiDependencies } = await import("@/lib/finos-api.server");
      const secret = process.env["FINOS_SUMMARY_SECRET"];
      const enabled = process.env["FINOS_SUMMARY_ENABLED"] === "true";
      // No database client initialization until both configuration and request authentication pass.
      return handleFinosSummary(request, {
        secret, enabled,
        load: async (input) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          return finosApiDependencies(supabaseAdmin, secret, enabled).load(input);
        },
        log: async (receipt) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          return finosApiDependencies(supabaseAdmin, secret, enabled).log(receipt);
        },
      });
    },
  } },
});