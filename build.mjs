// Construit le site Lashéane dans le dossier dist/ à partir des contenus de content/.
// Cloudflare lance ce script à chaque modification (voir wrangler.jsonc). Aucune dépendance.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pagesLegales, NOMS_PAYS } from "./src/legal.mjs";
import { formulaireRetractation } from "./functions/api/retractation.js";

const RACINE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(RACINE, "dist");

const lire = (nom, defaut) => {
  const f = path.join(RACINE, "content", nom);
  if (!fs.existsSync(f) && defaut !== undefined) return defaut;
  return JSON.parse(fs.readFileSync(f, "utf8"));
};
const boutique = lire("boutique.json");
const produits = lire("produits.json").produits || [];
const accueil = lire("accueil.json");
const histoire = lire("histoire.json");
const contact = lire("contact.json");
const couleurs = lire("couleurs.json");
const legal = lire("legal.json", {});

/* Outils */
const esc = (v) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const liste = (v) => (Array.isArray(v) ? v.filter((x) => x !== null && x !== undefined && x !== "") : []);
const nombre = (v) => (typeof v === "number" && Number.isFinite(v) ? v : Number.parseFloat(String(v ?? "").replace(",", ".")));
const formatEuros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const euros = (n) => formatEuros.format(n);
const cheminImage = (src) => {
  const s = String(src ?? "").trim();
  if (/^https:\/\//.test(s)) return s;
  return s.startsWith("/") ? s : "/" + s;
};
const image = (src) => esc(cheminImage(src));
const lienExterne = (url) => (/^https:\/\//.test(String(url ?? "")) ? esc(url) : "");
const titre = (normal, italique) =>
  `${esc(normal)}${italique ? ` <em>${esc(italique)}</em>` : ""}`;
const texteAlt = (...candidats) => esc(candidats.map((c) => String(c ?? "").trim()).find(Boolean) || "Kit Lashéane");

const SITE = (String(accueil.seo?.site_url || "").trim() || "https://lasheane.maissouf.workers.dev").replace(/\/+$/, "");
const absolu = (chemin) => (/^https:\/\//.test(chemin) ? chemin : SITE + (chemin.startsWith("/") ? chemin : "/" + chemin));
const aujourdhui = new Date().toISOString().slice(0, 10);
const dateMaj = /^\d{4}-\d{2}-\d{2}/.test(String(legal.date_maj || "")) ? String(legal.date_maj).slice(0, 10) : aujourdhui;

const offreActive = boutique.offre_active === true;
const prixActuel = (p) => {
  const lancement = nombre(p.prix_lancement);
  return offreActive && lancement > 0 ? lancement : nombre(p.prix);
};
const mentionPrix = (p) => {
  const lancement = nombre(p.prix_lancement);
  const normal = nombre(p.prix);
  if (!offreActive || !(lancement > 0) || !(normal > lancement)) return "";
  return `${boutique.offre_mention || "Prix de lancement"} · puis ${euros(normal)}`;
};
const enPromo = (p) => {
  const lancement = nombre(p.prix_lancement);
  return offreActive && lancement > 0 && nombre(p.prix) > lancement;
};

// Prix barré : activé depuis l'administration (Prix, offre et livraison).
// Rappel légal : le prix barré doit être le prix le plus bas réellement pratiqué
// dans les 30 jours précédant l'offre.
const prixBarreActif = offreActive && boutique.prix_barre === true;
const affichagePrix = (p) => {
  const actuel = prixActuel(p);
  if (prixBarreActif && enPromo(p)) {
    const normal = nombre(p.prix);
    const remise = Math.round((1 - actuel / normal) * 100);
    return {
      ligne: `<span class="prix-montant">${euros(actuel)}</span>`
        + `<s class="prix-barre"><span class="masque">Prix normal : </span>${euros(normal)}</s>`
        + `<span class="prix-remise"><span class="masque">soit une remise de </span>−${remise} %</span>`,
      note: boutique.offre_detail || "",
    };
  }
  return { ligne: `<span class="prix-montant">${euros(actuel)}</span>`, note: mentionPrix(p) };
};
const blocPrix = (p) => {
  const { ligne, note } = affichagePrix(p);
  return `<div class="prix"><div class="prix-ligne">${ligne}</div>${note ? `<span class="prix-note">${esc(note)}</span>` : ""}</div>`;
};
const badgeOffre = (p) =>
  enPromo(p) && boutique.offre_badge ? `<span class="badge badge-offre">${esc(boutique.offre_badge)}</span>` : "";

// Vérifications : on préfère un échec de construction (le site reste sur la version précédente)
// à un site publié avec un prix manquant.
const ids = new Set();
for (const p of produits) {
  if (!/^[a-z0-9-]+$/.test(p.id || "")) throw new Error(`Identifiant de kit invalide : « ${p.id} »`);
  if (ids.has(p.id)) throw new Error(`Deux kits ont le même identifiant : ${p.id}`);
  ids.add(p.id);
  if (!(prixActuel(p) > 0)) throw new Error(`Prix manquant pour le kit ${p.nom}`);
}

/* Livraison (affichée dans le panier, les CGV et llms.txt) */
const fraisPort = nombre(boutique.livraison_prix);
const seuilOffert = nombre(boutique.livraison_offerte_des);
const texteLivraison = !(fraisPort > 0)
  ? "Livraison offerte"
  : `Livraison : ${euros(fraisPort)}${seuilOffert > 0 ? `, offerte dès ${euros(seuilOffert)} d'achat` : ""}`;
const paysLivres = (Array.isArray(boutique.pays) && boutique.pays.length ? boutique.pays : ["FR"]).map((c) => NOMS_PAYS[c] || c);

/* Couleurs modifiables */
const COULEURS_DEFAUT = {
  noir: "#0C0B0A", ivoire: "#F8F3EE", nude: "#EBDFD3", vert: "#1E2A20", champagne: "#DFC6B6",
  or: "#B08D57", encre: "#1C1814", taupe: "#6A5D53", brume: "#A99C90",
};
const styleCouleurs = ":root{" + Object.entries(COULEURS_DEFAUT).map(([cle, defaut]) => {
  const val = String(couleurs[cle] ?? "").trim();
  return `--${cle}:${/^#[0-9a-fA-F]{3,8}$/.test(val) ? val : defaut}`;
}).join(";") + "}";

/* Icônes des engagements, dans l'ordre de la liste */
const ICONES = [
  '<svg viewBox="0 0 26 26" aria-hidden="true" focusable="false"><circle cx="13" cy="13" r="11"/><path d="M13 6.5V13l4 2.5"/></svg>',
  '<svg viewBox="0 0 26 26" aria-hidden="true" focusable="false"><path d="M13 2.5c4.5 6 7 9.6 7 13a7 7 0 0 1-14 0c0-3.4 2.5-7 7-13Z"/></svg>',
  '<svg viewBox="0 0 26 26" aria-hidden="true" focusable="false"><path d="M3 15c3-5 7-7.5 10-7.5S20 10 23 15"/><path d="M6 12.2 4.5 9M10 9.4 9.4 6M16 9.4l.6-3.4M20 12.2 21.5 9"/></svg>',
  '<svg viewBox="0 0 26 26" aria-hidden="true" focusable="false"><path d="M2.5 11c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/><path d="M2.5 16.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/></svg>',
];

/* Gabarit commun */
const tete = ({ titrePage, description, chemin, jsonLd = "", indexer = true }) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titrePage)}</title>
<meta name="description" content="${esc(description)}">
${indexer ? `<link rel="canonical" href="${esc(absolu(chemin))}">` : '<meta name="robots" content="noindex">'}
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Lashéane">
<meta property="og:title" content="${esc(titrePage)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(absolu(chemin))}">
<meta property="og:image" content="${esc(absolu(cheminImage(accueil.hero?.image || "/img/manga-hero.jpg")))}">
<meta name="theme-color" content="${esc(couleurs.noir || COULEURS_DEFAUT.noir)}">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/bodoni-moda-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/jost-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css">
<style>${styleCouleurs}</style>
${jsonLd}
</head>
<body>
<a class="lien-evitement" href="#contenu">Aller au contenu</a>`;

const LIENS_NAV = [
  ["#collection", "Collection"],
  ["#manga", "Manga"],
  ["#rituel", "Le rituel"],
  ["#histoire", "Notre histoire"],
];
const LIENS_LEGAUX = [
  ["/mentions-legales", "Mentions légales"],
  ["/cgv", "CGV et conditions d'utilisation"],
  ["/cgv#remboursements", "Retours et remboursements"],
  ["/confidentialite", "Confidentialité"],
  ["/cookies", "Cookies"],
  ["/retractation", "Renoncer au contrat ici"],
];
const prefixe = (accueilPage) => (accueilPage ? "" : "/");

const entete = (accueilPage) => `
<div class="annonce" role="region" aria-label="Annonce"><div class="wrap">${esc(offreActive ? boutique.offre_bandeau : boutique.bandeau)}</div></div>
<header class="entete">
  <div class="wrap">
    <nav class="nav-desktop" aria-label="Navigation principale">
      ${LIENS_NAV.map(([h, t]) => `<a href="${prefixe(accueilPage)}${h}">${t}</a>`).join("\n      ")}
    </nav>
    <button class="icone-btn menu-btn" id="menu-btn" type="button" aria-expanded="false" aria-controls="nav-mobile" aria-label="Ouvrir le menu">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true" focusable="false"><path d="M3 7h18M3 12h18M3 17h18"/></svg>
    </button>
    <a class="logo" href="/"><img src="/img/logo-wordmark.png" alt="Lashéane, retour à l'accueil" width="640" height="98"></a>
    <div class="entete-droite">
      <a class="lien-shop" href="${prefixe(accueilPage)}#collection">${esc(accueil.hero?.bouton || "Shop now")}</a>
      <button class="icone-btn" id="panier-btn" type="button" aria-label="Ouvrir le panier" aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true" focusable="false"><path d="M5 8h14l-1.2 12.5H6.2L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>
        <span class="compteur" id="compteur" aria-hidden="true" hidden>0</span>
      </button>
    </div>
  </div>
  <nav class="nav-mobile" id="nav-mobile" aria-label="Navigation mobile" hidden>
    <div class="wrap">
      ${LIENS_NAV.map(([h, t]) => `<a href="${prefixe(accueilPage)}${h}">${h === "#manga" ? "Manga Lashes Kit" : t}</a>`).join("\n      ")}
    </div>
  </nav>
</header>`;

const piedDePage = (accueilPage) => {
  const insta = lienExterne(contact.instagram);
  const tiktok = lienExterne(contact.tiktok);
  const reseaux = insta || tiktok ? `
    <div class="reseaux">
      ${contact.reseaux_titre ? `<span class="reseaux-label">${esc(contact.reseaux_titre)}</span>` : ""}
      ${contact.pseudo ? `<span class="pseudo">${esc(contact.pseudo)}</span>` : ""}
      <div class="reseaux-liens">
        ${insta ? `<a href="${insta}" target="_blank" rel="noopener">Instagram<span class="masque"> (nouvel onglet)</span></a>` : ""}
        ${tiktok ? `<a href="${tiktok}" target="_blank" rel="noopener">TikTok<span class="masque"> (nouvel onglet)</span></a>` : ""}
      </div>
    </div>` : "";
  const email = String(contact.email || "").trim();
  return `
<footer class="pied">
  <div class="wrap">
    <img class="pied-logo" src="/img/logo-full.png" alt="Lashéane, Lashes in 2 minutes" width="720" height="164">
    ${reseaux}
    ${email ? `<a class="pied-contact" href="mailto:${esc(email)}">${esc(email)}</a>` : ""}
    <nav aria-label="Liens du pied de page">
      ${LIENS_NAV.map(([h, t]) => `<a href="${prefixe(accueilPage)}${h}">${h === "#manga" ? "Manga Lashes Kit" : t}</a>`).join("\n      ")}
    </nav>
    <nav class="liens-legaux" aria-label="Informations légales">
      ${LIENS_LEGAUX.map(([h, t]) => `<a href="${h}">${t}</a>`).join("\n      ")}
    </nav>
    <small>© ${new Date().getFullYear()} Lashéane. Tous droits réservés.</small>
  </div>
</footer>`;
};

const catalogueJson = JSON.stringify(
  produits.filter((p) => p.disponible !== false).map((p) => ({
    id: p.id, nom: p.nom, effet: p.effet || "", image: cheminImage(p.image), prix: prixActuel(p),
  })),
).replace(/</g, "\\u003c");

const panier = `
<div class="voile" id="voile" hidden></div>
<div class="panier" id="panier" role="dialog" aria-modal="true" aria-labelledby="panier-titre" hidden>
  <div class="panier-tete">
    <h2 id="panier-titre">Votre panier</h2>
    <button class="icone-btn" id="panier-fermer" type="button" aria-label="Fermer le panier">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
  </div>
  <ul class="panier-liste" id="panier-liste" aria-label="Kits dans le panier"></ul>
  <p class="panier-vide" id="panier-vide">Votre panier est vide.</p>
  <div class="panier-pied">
    <div class="panier-total" id="panier-total" hidden><span>Total des kits</span><b id="total-montant">0,00 €</b></div>
    <p class="panier-livraison" id="panier-livraison" hidden>${esc(texteLivraison)} · ${esc(paysLivres.join(", "))}</p>
    <div class="panier-cgv" id="bloc-cgv" hidden>
      <input type="checkbox" id="accepte-cgv" aria-describedby="panier-erreur">
      <label for="accepte-cgv">J'ai lu et j'accepte les <a href="/cgv">conditions générales de vente</a>, y compris les conditions de rétractation.</label>
    </div>
    <p class="panier-erreur" id="panier-erreur" role="alert" hidden></p>
    <button class="btn btn-noir" id="panier-commander" type="button" hidden>Passer au paiement</button>
    <button class="btn btn-contour" id="panier-continuer" type="button">Continuer mes achats</button>
    <p>${esc(boutique.panier_note || "")}${offreActive && boutique.offre_appel ? ` ${esc(boutique.offre_appel)}` : ""}</p>
  </div>
</div>
<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
<script id="catalogue" type="application/json">${catalogueJson}</script>
<script src="/app.js" defer></script>`;

const finPage = (accueilPage) => `${piedDePage(accueilPage)}
${panier}
</body>
</html>
`;

/* Données structurées (moteurs de recherche et agents IA) */
const email = String(legal.email || contact.email || "").trim();
const jsonLdAccueil = `<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#organisation`,
      name: "Lashéane",
      url: `${SITE}/`,
      logo: absolu("/img/logo-full.png"),
      ...(email ? { email } : {}),
      sameAs: [contact.instagram, contact.tiktok].filter((u) => /^https:\/\//.test(String(u || ""))),
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#site`,
      url: `${SITE}/`,
      name: "Lashéane",
      inLanguage: "fr-FR",
      publisher: { "@id": `${SITE}/#organisation` },
    },
    ...produits.map((p) => ({
      "@type": "Product",
      "@id": `${SITE}/#kit-${p.id}`,
      name: p.nom,
      description: [p.effet, p.description].filter(Boolean).join(". "),
      image: absolu(cheminImage(p.image)),
      brand: { "@type": "Brand", name: "Lashéane" },
      category: "Extensions de cils en clusters",
      offers: {
        "@type": "Offer",
        url: `${SITE}/#kit-${p.id}`,
        price: prixActuel(p).toFixed(2),
        priceCurrency: "EUR",
        availability: p.disponible === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        seller: { "@id": `${SITE}/#organisation` },
      },
    })),
  ],
}).replace(/</g, "\\u003c")}</script>`;

/* Page d'accueil */
const h = accueil.hero || {};
const col = accueil.collection || {};
const m = accueil.manga || {};
const r = accueil.rituel || {};
const ap = accueil.appel || {};
const produitManga = produits.find((p) => p.id === m.produit);

const boutonAjout = (p, classe) =>
  `<button class="btn ${classe}" type="button" data-ajout="${esc(p.id)}" aria-label="Ajouter le ${esc(p.nom)} au panier">Ajouter au panier</button>`;

const carte = (p) => `
        <article class="produit${p.signature ? " signature" : ""}" id="kit-${esc(p.id)}" aria-labelledby="nom-${esc(p.id)}">
          <figure>
            <img src="${image(p.image)}" alt="${texteAlt(p.image_alt, p.nom)}" width="800" height="800" loading="lazy">
            ${p.badge || badgeOffre(p) ? `<div class="badges">${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}${badgeOffre(p)}</div>` : ""}
          </figure>
          <div class="produit-corps">
            ${p.effet ? `<span class="produit-effet">${esc(p.effet)}</span>` : ""}
            <h3 id="nom-${esc(p.id)}">${esc(p.nom)}</h3>
            <p class="produit-desc">${esc(p.description)}</p>
            ${blocPrix(p)}
            ${p.disponible === false
              ? `<button class="btn btn-contour" type="button" disabled>Bientôt de retour</button>`
              : boutonAjout(p, p.signature ? "btn-champagne" : "btn-contour")}
          </div>
        </article>`;

const infosHero = liste(offreActive ? h.infos_offre : h.infos);

const accueilHtml = `${tete({ titrePage: accueil.seo?.titre || "Lashéane", description: accueil.seo?.description || "", chemin: "/", jsonLd: jsonLdAccueil })}
${entete(true)}
<main id="contenu">
  <section class="hero" aria-labelledby="titre-principal">
    <div class="wrap">
      <div class="hero-texte">
        ${h.surtitre ? `<p class="eyebrow">${esc(h.surtitre)}</p>` : ""}
        <h1 id="titre-principal">${titre(h.titre, h.titre_italique)}</h1>
        ${h.texte ? `<p class="hero-lead">${esc(h.texte)}</p>` : ""}
        <div class="hero-actions">
          <a class="btn btn-champagne" href="#collection">${esc(h.bouton || "Shop now")}</a>
          ${h.lien ? `<a class="lien" href="#manga">${esc(h.lien)}</a>` : ""}
        </div>
        ${infosHero.length ? `<ul class="hero-faits">${infosHero.map((t, i) => `<li${offreActive && i === 0 ? ' class="lancement"' : ""}>${esc(t)}</li>`).join("")}</ul>` : ""}
      </div>
      <figure class="hero-photo">
        <img src="${image(h.image)}" alt="${texteAlt(h.image_alt, h.etiquette)}" width="960" height="1200" fetchpriority="high">
        ${h.etiquette ? `<figcaption class="etiquette"><b>${esc(h.etiquette)}</b>${h.etiquette_detail ? `<small>${esc(h.etiquette_detail)}</small>` : ""}</figcaption>` : ""}
      </figure>
    </div>
  </section>

  <section class="promesses" aria-label="Les engagements Lashéane">
    <div class="wrap">
      <ul>
        ${liste(accueil.promesses).map((p, i) => `<li>
          ${ICONES[i % ICONES.length]}
          <strong>${esc(p.titre)}</strong><span>${esc(p.texte)}</span>
        </li>`).join("\n        ")}
      </ul>
    </div>
  </section>

  <section class="collection" id="collection" aria-labelledby="titre-collection">
    <div class="wrap">
      <div class="titre-section">
        ${col.surtitre ? `<p class="eyebrow">${esc(col.surtitre)}</p>` : ""}
        <h2 id="titre-collection">${titre(col.titre, col.titre_italique)}</h2>
        ${col.texte ? `<p>${esc(col.texte)}</p>` : ""}
      </div>
      <div class="grille-produits">${produits.map(carte).join("")}
      </div>
    </div>
  </section>

  <section class="manga" id="manga" aria-labelledby="titre-manga">
    <div class="wrap">
      <figure>
        <img src="${image(m.image)}" alt="${texteAlt(m.image_alt, m.titre)}" width="960" height="1200" loading="lazy">
      </figure>
      <div class="manga-texte">
        ${m.surtitre ? `<p class="eyebrow">${esc(m.surtitre)}</p>` : ""}
        <h2 id="titre-manga">${esc(m.titre)}</h2>
        ${m.sous_titre ? `<p class="manga-sous">${esc(m.sous_titre)}</p>` : ""}
        ${m.texte ? `<p>${esc(m.texte)}</p>` : ""}
        <dl class="attributs">
          ${liste(m.attributs).map((a) => `<div><dt>${esc(a.label)}</dt><dd>${esc(a.valeur)}</dd></div>`).join("\n          ")}
          ${produitManga ? (() => {
            const { ligne, note } = affichagePrix(produitManga);
            return `<div><dt>Prix</dt><dd><span class="prix-ligne">${ligne}</span>${note ? `<small>${esc(note)}</small>` : ""}</dd></div>`;
          })() : ""}
        </dl>
        <div class="manga-actions">
          ${produitManga && produitManga.disponible !== false ? boutonAjout(produitManga, "btn-champagne") : ""}
          <a class="lien" href="#rituel">Voir la pose</a>
        </div>
      </div>
    </div>
  </section>

  <section class="rituel" id="rituel" aria-labelledby="titre-rituel">
    <div class="wrap">
      <figure>
        <img src="${image(r.image)}" alt="${texteAlt(r.image_alt, r.legende)}" width="896" height="1152" loading="lazy">
        ${r.legende ? `<figcaption>${esc(r.legende)}</figcaption>` : ""}
      </figure>
      <div class="rituel-texte">
        <div class="titre-section">
          ${r.surtitre ? `<p class="eyebrow">${esc(r.surtitre)}</p>` : ""}
          <h2 id="titre-rituel">${titre(r.titre, r.titre_italique)}</h2>
        </div>
        <ol class="etapes">
          ${liste(r.etapes).map((e, i) => `<li><span class="etape-num" aria-hidden="true">${i + 1}</span><div><h3>${esc(e.titre)}</h3><p>${esc(e.texte)}</p></div></li>`).join("\n          ")}
        </ol>
        <div class="coffret">
          ${r.contenu_titre ? `<h3>${esc(r.contenu_titre)}</h3>` : ""}
          <ul>
            ${liste(r.contenu).map((c) => `<li>${esc(c)}</li>`).join("\n            ")}
          </ul>
          ${r.contenu_note ? `<p class="coffret-note">${esc(r.contenu_note)}</p>` : ""}
        </div>
        ${r.retrait ? `<p class="retrait"><b>Pour le retrait :</b> ${esc(r.retrait)}</p>` : ""}
      </div>
    </div>
  </section>

  <section class="histoire" id="histoire" aria-labelledby="titre-histoire">
    <div class="wrap">
      <div class="histoire-texte">
        ${histoire.surtitre ? `<p class="eyebrow">${esc(histoire.surtitre)}</p>` : ""}
        <h2 id="titre-histoire">${titre(histoire.titre, histoire.titre_italique)}</h2>
        ${liste(histoire.paragraphes).map((p) => `<p>${esc(p)}</p>`).join("\n        ")}
        ${liste(histoire.besoins).length ? `<ul class="besoins">
          ${liste(histoire.besoins).map((b) => `<li>${esc(b)}</li>`).join("\n          ")}
        </ul>` : ""}
        <div class="signature-fondatrice">
          ${histoire.signature ? `<b>${esc(histoire.signature)}</b>` : ""}
          ${histoire.signature_detail ? `<small>${esc(histoire.signature_detail)}</small>` : ""}
        </div>
      </div>
      <figure>
        <img src="${image(histoire.image)}" alt="${texteAlt(histoire.image_alt, histoire.titre)}" width="800" height="1000" loading="lazy">
      </figure>
    </div>
  </section>

  <section class="appel" aria-labelledby="titre-appel">
    <div class="wrap">
      ${ap.surtitre ? `<p class="eyebrow">${esc(ap.surtitre)}</p>` : ""}
      <h2 id="titre-appel">${titre(ap.titre, ap.titre_italique)}</h2>
      ${offreActive && boutique.offre_appel ? `<p class="appel-note">${esc(boutique.offre_appel)}</p>` : ""}
      <a class="btn btn-champagne" href="#collection">${esc(ap.bouton || "Shop now")}</a>
    </div>
  </section>
</main>
${finPage(true)}`;

/* Pages secondaires */
const pageTexte = ({ titrePage, description, chemin, corps, indexer = true, classe = "" }) => `${tete({ titrePage: `${titrePage} · Lashéane`, description, chemin, indexer })}
${entete(false)}
<main id="contenu" class="page-legale${classe ? ` ${classe}` : ""}">
  <div class="wrap">
    <article class="legal">
      <h1>${esc(titrePage)}</h1>
      ${corps}
    </article>
  </div>
</main>
${finPage(false)}`;

const merciHtml = `${tete({ titrePage: "Merci pour votre commande · Lashéane", description: "Votre commande Lashéane est confirmée.", chemin: "/merci", indexer: false })}
${entete(false)}
<main id="contenu" class="page-simple">
  <div class="wrap">
    <p class="eyebrow">Commande confirmée</p>
    <h1>Merci pour votre <em>commande.</em></h1>
    <p>Votre paiement a bien été reçu. Vous allez recevoir un email de confirmation avec le récapitulatif de votre commande.</p>
    <p>Vous pouvez vous rétracter dans les 14 jours suivant la réception de votre commande, avec la fonction <a href="/retractation">« Renoncer au contrat ici »</a>. Nos <a href="/cgv">conditions générales de vente</a> restent consultables à tout moment.</p>
    <a class="btn btn-noir" href="/">Retour à l'accueil</a>
  </div>
</main>
${piedDePage(false)}
${panier}
<script>try { localStorage.removeItem("lasheane-panier"); } catch (e) {}</script>
</body>
</html>
`;

const adresseRetour = String(legal.adresse_retour || legal.adresse || "").trim();
const retractationHtml = pageTexte({
  titrePage: "Renoncer au contrat",
  description: "Exercez votre droit de rétractation en ligne pour une commande Lashéane.",
  chemin: "/retractation",
  classe: "page-retractation",
  corps: `
      <p class="chapo">Vous disposez de 14 jours à compter de la réception de votre commande pour vous rétracter, sans avoir à vous justifier.</p>
      <section class="demande" id="demande" aria-live="polite">
        <!--ZONE-RETRACTATION-->${formulaireRetractation()}<!--/ZONE-RETRACTATION-->
      </section>
      <h2>Bon à savoir</h2>
      <ul>
        <li>Après confirmation, vous recevez un accusé de réception par email, avec le contenu de votre demande et sa date et heure d'envoi.</li>
        <li>Renvoyez ensuite le ou les kits, complets et dans leur état d'origine, dans les 14 jours${adresseRetour ? `, à l'adresse suivante : ${esc(adresseRetour).replace(/\n/g, ", ")}` : ""}. Les frais de renvoi sont à votre charge.</li>
        <li>Nous vous remboursons, frais de livraison standard compris, au plus tard 14 jours après votre demande. Nous pouvons attendre la réception du ou des kits, ou une preuve de leur expédition.</li>
        <li>Un kit livré scellé dont le scellé a été retiré ne peut pas être retourné, pour des raisons d'hygiène (article L. 221-28, 5° du code de la consommation).</li>
        <li>Vous pouvez aussi utiliser le <a href="/cgv#retractation">formulaire type de rétractation</a>${email ? ` ou nous écrire à <a href="mailto:${esc(email)}">${esc(email)}</a>` : ""}.</li>
      </ul>`,
});

const legales = pagesLegales({ esc, euros, nombre, legal, contact, boutique, siteUrl: SITE, dateMaj });

/* Plan du site, robots et llms.txt (lisibles par les moteurs et les agents IA) */
const PAGES_PUBLIQUES = ["/", "/cgv", "/mentions-legales", "/confidentialite", "/cookies", "/retractation"];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES_PUBLIQUES.map((c) => `  <url><loc>${esc(absolu(c))}</loc><lastmod>${aujourdhui}</lastmod></url>`).join("\n")}
</urlset>
`;
const robots = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /merci

Sitemap: ${absolu("/sitemap.xml")}
`;
const contenuKit = liste(r.contenu);
const llms = `# Lashéane

> Kits d'extensions de cils en clusters, prêts à poser en 2 minutes avec colle intégrée. Boutique en ligne française, paiement sécurisé par Stripe.

## Kits
${produits.map((p) => `- [${p.nom}](${absolu(`/#kit-${p.id}`)}) : ${euros(prixActuel(p))}${enPromo(p) ? ` (prix de lancement, puis ${euros(nombre(p.prix))})` : ""}. ${[p.effet, p.description].filter(Boolean).join(". ")}${p.disponible === false ? " Momentanément indisponible." : ""}`).join("\n")}
${contenuKit.length ? `\nChaque kit contient : ${contenuKit.join(", ").toLowerCase()}.\n` : ""}${offreActive && boutique.offre_appel ? `\nOffre en cours : ${boutique.offre_appel}\n` : ""}
## Livraison et retours
- ${texteLivraison}.
- Pays livrés : ${paysLivres.join(", ")}.
- Rétractation : 14 jours après réception, en ligne sur ${absolu("/retractation")}. Un kit scellé ne peut plus être retourné une fois descellé (hygiène).

## Informations
- [Conditions générales de vente et d'utilisation](${absolu("/cgv")})
- [Retours et remboursements](${absolu("/cgv#remboursements")})
- [Politique de confidentialité](${absolu("/confidentialite")})
- [Politique des cookies](${absolu("/cookies")})
- [Mentions légales](${absolu("/mentions-legales")})

## Contact
${email ? `- Email : ${email}\n` : ""}${/^https:\/\//.test(contact.instagram || "") ? `- Instagram : ${contact.instagram}\n` : ""}${/^https:\/\//.test(contact.tiktok || "") ? `- TikTok : ${contact.tiktok}\n` : ""}`;

/* Écriture du dossier dist/ */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(path.join(RACINE, "static"), DIST, { recursive: true });
fs.copyFileSync(path.join(RACINE, "src", "styles.css"), path.join(DIST, "styles.css"));
fs.copyFileSync(path.join(RACINE, "src", "app.js"), path.join(DIST, "app.js"));
fs.mkdirSync(path.join(DIST, "content"), { recursive: true });
for (const f of ["produits.json", "boutique.json", "legal.json", "contact.json"]) {
  const src = path.join(RACINE, "content", f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, "content", f));
}
fs.writeFileSync(path.join(DIST, "index.html"), accueilHtml);
fs.writeFileSync(path.join(DIST, "merci.html"), merciHtml);
fs.writeFileSync(path.join(DIST, "retractation.html"), retractationHtml);
for (const [fichier, pg] of Object.entries(legales)) {
  const chemin = "/" + fichier.replace(/\.html$/, "");
  fs.writeFileSync(path.join(DIST, fichier), pageTexte({ titrePage: pg.titre, description: pg.description, chemin, corps: pg.corps }));
}
fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(DIST, "robots.txt"), robots);
fs.writeFileSync(path.join(DIST, "llms.txt"), llms);

const manquants = ["nom", "statut", "adresse", "telephone", "siret", "tva", "mediateur_nom"].filter((k) => !String(legal[k] || "").trim());
console.log(`Site construit : ${produits.length} kits, offre de lancement ${offreActive ? "active" : "terminée"}.`);
if (manquants.length) console.log(`À compléter dans « Informations légales » : ${manquants.join(", ")}.`);
