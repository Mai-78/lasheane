// POST /api/retractation : fonction « Renoncer au contrat ici »
// (article L. 221-21 du code de la consommation, obligatoire depuis le 19 juin 2026).
//
// Étape 1 : la cliente remplit nom, commande et email (page /retractation).
// Étape 2 : elle vérifie et clique sur « Confirmer la rétractation ».
// Étape 3 : un accusé de réception lui est envoyé par email (support durable), avec le contenu
//           de sa déclaration et la date et l'heure d'envoi ; la boutique en reçoit une copie.
//
// Envoi des emails : Brevo. Variables à créer sur Cloudflare :
//   BREVO_API_KEY (secret)  et  EMAIL_EXPEDITEUR (adresse validée dans Brevo).
// Sans ces variables, la page explique comment envoyer la demande par email.

const LIMITES = { nom: 120, email: 160, commande: 200, produits: 600 };
const ZONE = /<!--ZONE-RETRACTATION-->[\s\S]*<!--\/ZONE-RETRACTATION-->/;

const esc = (v) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const LIBELLES = {
  nom: "Nom et prénom",
  email: "Adresse email",
  commande: "Votre commande",
  produits: "Kits concernés",
};

/* Formulaire de l'étape 1, aussi utilisé par build.mjs pour la page /retractation */
export function formulaireRetractation(valeurs = {}, erreurs = {}) {
  const champ = (nom, { type = "text", autocomplete = "", aide = "", requis = true, multiligne = false } = {}) => {
    const id = `ret-${nom}`;
    const err = erreurs[nom];
    const decrit = [aide ? `${id}-aide` : "", err ? `${id}-err` : ""].filter(Boolean).join(" ");
    const attrs = `id="${id}" name="${nom}" maxlength="${LIMITES[nom]}"${requis ? " required" : ""}`
      + `${autocomplete ? ` autocomplete="${autocomplete}"` : ""}${decrit ? ` aria-describedby="${decrit}"` : ""}${err ? ' aria-invalid="true"' : ""}`;
    const saisie = multiligne
      ? `<textarea ${attrs} rows="3">${esc(valeurs[nom])}</textarea>`
      : `<input ${attrs} type="${type}" value="${esc(valeurs[nom])}">`;
    return `<div class="champ${err ? " champ-erreur" : ""}">
          <label for="${id}">${LIBELLES[nom]}${requis ? ' <span class="requis">(obligatoire)</span>' : ' <span class="requis">(facultatif)</span>'}</label>
          ${aide ? `<p class="aide" id="${id}-aide">${aide}</p>` : ""}
          ${err ? `<p class="erreur-champ" id="${id}-err">${esc(err)}</p>` : ""}
          ${saisie}
        </div>`;
  };
  const listeErreurs = Object.keys(erreurs);
  return `
      <h2>Votre demande</h2>
      <p>Remplissez ces informations. Vous pourrez les vérifier avant de confirmer.</p>
      <form class="formulaire" method="post" action="/api/retractation#demande" novalidate>
        <input type="hidden" name="etape" value="verifier">
        ${listeErreurs.length ? `<div class="alerte" role="alert">
          <p><strong>Votre demande n'est pas encore complète.</strong></p>
          <ul>${listeErreurs.map((k) => `<li><a href="#ret-${k}">${esc(erreurs[k])}</a></li>`).join("")}</ul>
        </div>` : ""}
        ${champ("nom", { autocomplete: "name" })}
        ${champ("commande", { aide: "Référence indiquée dans l'email de confirmation, ou date de la commande." })}
        ${champ("email", { type: "email", autocomplete: "email", aide: "Vous y recevrez l'accusé de réception de votre demande." })}
        ${champ("produits", { requis: false, multiligne: true, aide: "À remplir seulement si vous renoncez à une partie de votre commande." })}
        <div class="piege" aria-hidden="true">
          <label for="ret-site">Ne pas remplir ce champ</label>
          <input id="ret-site" name="site_web" type="text" tabindex="-1" autocomplete="off">
        </div>
        <button class="btn btn-noir" type="submit">Continuer</button>
      </form>`;
}

const champsCaches = (d) => Object.keys(LIMITES)
  .map((k) => `<input type="hidden" name="${k}" value="${esc(d[k])}">`).join("");

const recapitulatif = (d) => `
        <dl class="recap">
          <div><dt>${LIBELLES.nom}</dt><dd>${esc(d.nom)}</dd></div>
          <div><dt>${LIBELLES.commande}</dt><dd>${esc(d.commande)}</dd></div>
          <div><dt>${LIBELLES.email}</dt><dd>${esc(d.email)}</dd></div>
          <div><dt>${LIBELLES.produits}</dt><dd>${d.produits ? esc(d.produits) : "Toute la commande"}</dd></div>
        </dl>`;

function valider(d) {
  const e = {};
  if (d.nom.length < 2) e.nom = "Indiquez votre nom et votre prénom.";
  if (d.commande.length < 3) e.commande = "Indiquez la référence ou la date de votre commande.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) e.email = "Indiquez une adresse email valide, par exemple prenom@exemple.fr.";
  return e;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let form;
  try {
    form = await request.formData();
  } catch {
    return new Response("Requête invalide.", { status: 400 });
  }
  const lireChamp = (k) => String(form.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, LIMITES[k] ?? 200);
  const d = { nom: lireChamp("nom"), email: lireChamp("email"), commande: lireChamp("commande"), produits: lireChamp("produits") };
  const etape = String(form.get("etape") || "verifier");

  // Champ piège invisible : seuls les robots le remplissent.
  if (String(form.get("site_web") || "").trim()) {
    return new Response("Requête refusée.", { status: 400 });
  }

  const [gabarit, legal, contact] = await Promise.all([
    lireAsset(context, "/retractation", "text"),
    lireAsset(context, "/content/legal.json", "json").catch(() => ({})),
    lireAsset(context, "/content/contact.json", "json").catch(() => ({})),
  ]);
  const vendeur = {
    nom: String(legal.nom || "Lashéane").trim(),
    email: String(legal.email || contact.email || "").trim(),
    adresseRetour: String(legal.adresse_retour || legal.adresse || "").trim().replace(/\s*\n\s*/g, ", "),
  };

  const page = (zone, statut = 200) => new Response(
    gabarit.replace(ZONE, `<!--ZONE-RETRACTATION-->${zone}<!--/ZONE-RETRACTATION-->`),
    { status: statut, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );

  const erreurs = valider(d);
  if (etape === "modifier" || Object.keys(erreurs).length) {
    return page(formulaireRetractation(d, etape === "modifier" ? {} : erreurs), etape === "modifier" ? 200 : 422);
  }

  if (etape !== "confirmer") {
    return page(`
      <div class="etape">
        <h2>Vérifiez votre demande</h2>
        <p>Si tout est exact, cliquez sur « Confirmer la rétractation ». Vous recevrez aussitôt un accusé de réception par email.</p>
        ${recapitulatif(d)}
        <div class="actions-etape">
          <form method="post" action="/api/retractation#demande">
            ${champsCaches(d)}<input type="hidden" name="etape" value="confirmer">
            <button class="btn btn-noir" type="submit">Confirmer la rétractation</button>
          </form>
          <form method="post" action="/api/retractation#demande">
            ${champsCaches(d)}<input type="hidden" name="etape" value="modifier">
            <button class="btn btn-contour" type="submit">Modifier</button>
          </form>
        </div>
      </div>`);
  }

  // Étape 3 : confirmation
  const maintenant = new Date();
  const quand = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full", timeStyle: "medium", timeZone: "Europe/Paris",
  }).format(maintenant);
  const envoi = await envoyerAccuse(env, d, quand, vendeur);

  const retour = vendeur.adresseRetour
    ? `à l'adresse suivante : ${esc(vendeur.adresseRetour)}`
    : "à l'adresse indiquée dans nos conditions générales de vente";

  if (envoi.ok) {
    return page(`
      <div class="etape succes">
        <h2>Votre rétractation est enregistrée</h2>
        <p>Demande envoyée le ${esc(quand)} (heure de Paris). Un accusé de réception reprenant ces informations vient de vous être envoyé à ${esc(d.email)}.</p>
        ${recapitulatif(d)}
        <h3>Prochaines étapes</h3>
        <ol>
          <li>Renvoyez le ou les kits, complets et dans leur état d'origine, au plus tard 14 jours après aujourd'hui, ${retour}. Les frais de renvoi sont à votre charge.</li>
          <li>Nous vous remboursons, frais de livraison standard compris, au plus tard 14 jours après aujourd'hui. Nous pouvons attendre la réception du ou des kits, ou une preuve de leur expédition.</li>
        </ol>
        <p>Vous n'avez pas reçu l'email ? Vérifiez vos courriers indésirables${vendeur.email ? `, ou écrivez-nous à <a href="mailto:${esc(vendeur.email)}">${esc(vendeur.email)}</a>` : ""}.</p>
      </div>`);
  }

  // Envoi impossible : la demande n'a PAS été transmise. On le dit clairement et on propose l'email.
  const texteDemande = `Je vous notifie par la présente ma rétractation du contrat portant sur la vente des biens ci-dessous.\n`
    + `Nom et prénom : ${d.nom}\nCommande : ${d.commande}\nKits concernés : ${d.produits || "toute la commande"}\n`
    + `Email : ${d.email}\nDate : ${quand}`;
  const mailto = vendeur.email
    ? `mailto:${vendeur.email}?subject=${encodeURIComponent("Rétractation de ma commande")}&body=${encodeURIComponent(texteDemande)}`
    : "";
  return page(`
      <div class="etape alerte-forte" role="alert">
        <h2>Votre demande n'a pas pu être transmise</h2>
        <p>Notre service d'envoi d'emails est momentanément indisponible. Votre rétractation n'est donc pas encore enregistrée.</p>
        <p>${mailto
          ? `Envoyez-la par email à <a href="${esc(mailto)}">${esc(vendeur.email)}</a> en copiant le texte ci-dessous. La date de votre email fera foi.`
          : "Envoyez-la par email ou par courrier, en copiant le texte ci-dessous, aux coordonnées indiquées dans nos conditions générales de vente."}</p>
        <pre class="texte-demande">${esc(texteDemande)}</pre>
        <p>Vous pouvez aussi réessayer dans quelques minutes.</p>
      </div>`, 503);
}

async function envoyerAccuse(env, d, quand, vendeur) {
  const cle = String(env.BREVO_API_KEY || "").trim();
  const expediteur = String(env.EMAIL_EXPEDITEUR || vendeur.email || "").trim();
  if (!cle || !expediteur) return { ok: false, raison: "non-configure" };

  const retour = vendeur.adresseRetour || "l'adresse indiquée dans nos conditions générales de vente";
  const lignes = [
    `Bonjour ${d.nom},`,
    "",
    `Nous accusons réception de votre déclaration de rétractation, envoyée le ${quand} (heure de Paris).`,
    "",
    "Contenu de votre déclaration :",
    `- Nom et prénom : ${d.nom}`,
    `- Commande : ${d.commande}`,
    `- Kits concernés : ${d.produits || "toute la commande"}`,
    `- Email : ${d.email}`,
    "",
    "Prochaines étapes :",
    `1. Renvoyez le ou les kits, complets et dans leur état d'origine, au plus tard 14 jours après cette déclaration, à : ${retour}. Les frais de renvoi sont à votre charge.`,
    "2. Nous vous remboursons, frais de livraison standard compris, au plus tard 14 jours après la réception de cette déclaration. Nous pouvons attendre la réception du ou des kits, ou une preuve de leur expédition.",
    "",
    "Rappel : un kit livré scellé dont le scellé a été retiré ne peut pas être retourné pour des raisons d'hygiène (article L. 221-28, 5° du code de la consommation).",
    "",
    `${vendeur.nom} – Lashéane`,
    vendeur.email,
  ];
  const texte = lignes.join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1C1814">${lignes.map((l) => (l ? `<p style="margin:0 0 8px">${esc(l)}</p>` : "")).join("")}</div>`;

  const corps = {
    sender: { name: "Lashéane", email: expediteur },
    to: [{ email: d.email, name: d.nom }],
    subject: "Accusé de réception de votre rétractation – Lashéane",
    textContent: texte,
    htmlContent: html,
  };
  if (vendeur.email) {
    corps.replyTo = { email: vendeur.email };
    if (vendeur.email.toLowerCase() !== d.email.toLowerCase()) corps.bcc = [{ email: vendeur.email }];
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": cle, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(corps),
    });
    if (!res.ok) {
      console.error("Envoi Brevo refusé", res.status);
      return { ok: false, raison: "echec" };
    }
    return { ok: true };
  } catch (e) {
    console.error("Brevo injoignable", String(e));
    return { ok: false, raison: "echec" };
  }
}

async function lireAsset({ request, env }, chemin, type) {
  const res = await env.ASSETS.fetch(new URL(chemin, request.url).toString());
  if (!res.ok) throw new Error(`Contenu introuvable : ${chemin} (${res.status})`);
  return type === "json" ? res.json() : res.text();
}
