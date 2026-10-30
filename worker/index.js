// Point d'entrée Cloudflare Workers.
// Les adresses /api/... (paiement, rétractation et connexion à l'administration) sont traitées ici ;
// tout le reste (pages, images, administration) est servi depuis le dossier dist/.

import { onRequestPost as checkout } from "../functions/api/checkout.js";
import { onRequestPost as retractation } from "../functions/api/retractation.js";
import { onRequestGet as auth } from "../functions/api/auth.js";
import { onRequestGet as callback } from "../functions/api/callback.js";

const ROUTES = {
  "/api/checkout": { methode: "POST", traiter: checkout },
  "/api/retractation": { methode: "POST", traiter: retractation },
  "/api/auth": { methode: "GET", traiter: auth },
  "/api/callback": { methode: "GET", traiter: callback },
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const route = ROUTES[pathname];
    if (route) {
      if (request.method !== route.methode) {
        return new Response("Méthode non autorisée", { status: 405, headers: { Allow: route.methode } });
      }
      return route.traiter({ request, env, ctx });
    }
    return env.ASSETS.fetch(request);
  },
};
