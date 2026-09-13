import Fastify from "fastify";
import { loadEvidenceRegistry, getApprovedModules } from "@lean-academy/evidence";

const server = Fastify({ logger: true });

server.get("/health", async () => ({ status: "ok" }));

// Demonstrates the evidence-gating rule from docs/product-requirements.md:
// only productionApproved modules may ever be exposed to a client.
server.get("/catalog", async () => {
  const registry = loadEvidenceRegistry();
  return { modules: getApprovedModules(registry) };
});

const port = Number(process.env.PORT ?? 4000);

server
  .listen({ port, host: "0.0.0.0" })
  .catch((err) => {
    server.log.error(err);
    process.exit(1);
  });
