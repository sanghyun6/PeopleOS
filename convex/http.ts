import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { createIncident, escalateToHuman, getDirections, reportBlockage } from "./cartesia";

const http = httpRouter();

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => new Response("ok")),
});

http.route({ path: "/cartesia/create_incident", method: "POST", handler: createIncident });
http.route({ path: "/cartesia/report_blockage", method: "POST", handler: reportBlockage });
http.route({ path: "/cartesia/escalate_to_human", method: "POST", handler: escalateToHuman });
http.route({ path: "/cartesia/get_directions", method: "POST", handler: getDirections });

export default http;
