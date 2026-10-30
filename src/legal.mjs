// Pages légales du site Lashéane (droit français, vente en ligne aux consommateurs).
// Les informations de l'entreprise viennent de content/legal.json (rubrique « Informations légales »
// de l'administration). Tant qu'une information manque, la page affiche « [À compléter : …] ».
//
// Textes rédigés à partir du code de la consommation, du RGPD et des recommandations de la CNIL.
// Ils ne remplacent pas la relecture d'un professionnel du droit.

export const NOMS_PAYS = {
  FR: "France", GP: "Guadeloupe", MQ: "Martinique", GF: "Guyane", RE: "La Réunion", YT: "Mayotte",
  BE: "Belgique", LU: "Luxembourg", CH: "Suisse", MC: "Monaco", DE: "Allemagne", ES: "Espagne",
  IT: "Italie", NL: "Pays-Bas", PT: "Portugal", GB: "Royaume-Uni", CA: "Canada",
};

export const PAGES_LEGALES = [
  { chemin: "/mentions-legales", fichier: "mentions-legales.html", lien: "Mentions légales" },
  { chemin: "/cgv", fichier: "cgv.html", lien: "CGV et conditions d'utilisation" },
  { chemin: "/confidentialite", fichier: "confidentialite.html", lien: "Confidentialité" },
  { chemin: "/cookies", fichier: "cookies.html", lien: "Cookies" },
];

export function pagesLegales(ctx) {
  const { esc, euros, nombre, legal: L, contact, boutique, siteUrl, dateMaj } = ctx;

  /* Outils */
  const texte = (x) => String(x ?? "").trim();
  const v = (x, libelle) => texte(x)
    ? esc(texte(x)).replace(/\n/g, "<br>")
    : `<mark class="a-completer">[À compléter : ${esc(libelle)}]</mark>`;
  const email = texte(L.email) || texte(contact.email);
  const lienEmail = email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : v("", "adresse email de contact");
  const nomVendeur = v(L.nom, "nom et prénom, ou raison sociale");
  const statut = v(L.statut, "statut juridique, par exemple Entrepreneur individuel (EI), micro-entreprise");
  const adresse = v(L.adresse, "adresse postale");
  const adresseRetour = texte(L.adresse_retour) ? v(L.adresse_retour, "") : adresse;
  const telephone = v(L.telephone, "numéro de téléphone");
  const siret = v(L.siret, "numéro SIRET");
  const tva = v(L.tva, "TVA : numéro de TVA intracommunautaire, ou « TVA non applicable, art. 293 B du CGI »");
  const directeur = texte(L.directeur_publication) ? v(L.directeur_publication, "") : nomVendeur;
  const mediateur = texte(L.mediateur_nom)
    ? `${v(L.mediateur_nom, "")}${texte(L.mediateur_adresse) ? `, ${v(L.mediateur_adresse, "")}` : ""}${texte(L.mediateur_site) ? `, <a href="${esc(texte(L.mediateur_site))}" rel="noopener">${esc(texte(L.mediateur_site))}</a>` : ""}`
    : v("", "nom, adresse et site internet du médiateur de la consommation choisi");
  const immatriculation = texte(L.immatriculation) ? `<li>Immatriculation : ${esc(texte(L.immatriculation))}</li>` : "";
  const capital = texte(L.capital) ? `<li>Capital social : ${esc(texte(L.capital))}</li>` : "";
  const transporteur = texte(L.transporteur) ? esc(texte(L.transporteur)) : "le transporteur choisi pour l'envoi";
  const delaiExpedition = texte(L.delai_expedition) ? esc(texte(L.delai_expedition)) : "";

  const offreActive = boutique.offre_active === true;
  const fraisPort = nombre(boutique.livraison_prix);
  const seuil = nombre(boutique.livraison_offerte_des);
  const phraseFrais = !(fraisPort > 0)
    ? "La livraison est offerte."
    : `Les frais de livraison s'élèvent à ${euros(fraisPort)} par commande${seuil > 0 ? `, et la livraison est offerte dès ${euros(seuil)} d'achat` : ""}.`;
  const pays = (Array.isArray(boutique.pays) ? boutique.pays : ["FR"]).map((c) => NOMS_PAYS[c] || c);
  const phraseTva = !texte(L.tva)
    ? v("", "régime de TVA")
    : /293\s*B/i.test(L.tva)
      ? "TVA non applicable, article 293 B du code général des impôts."
      : "Les prix s'entendent toutes taxes comprises (TTC).";
  const jMin = Math.floor(nombre(boutique.livraison_jours_min));
  const jMax = Math.floor(nombre(boutique.livraison_jours_max));
  const phraseDelai = jMin > 0 && jMax >= jMin
    ? `Le délai de livraison indicatif est de ${jMin} à ${jMax} jours ouvrés.`
    : "Le délai de livraison indicatif est affiché avant le paiement.";
  const majLisible = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(`${dateMaj}T12:00:00Z`));
  const maj = `<p class="maj">Dernière mise à jour : ${majLisible}.</p>`;
  const lien = (chemin, libelle) => `<a href="${chemin}">${libelle}</a>`;

  const identiteBloc = `<ul class="fiche">
      <li>${nomVendeur}, ${statut}</li>
      <li>Adresse : ${adresse}</li>
      <li>Téléphone : ${telephone}</li>
      <li>Email : ${lienEmail}</li>
      <li>SIRET : ${siret}</li>
      ${immatriculation}
      ${capital}
      <li>${tva}</li>
    </ul>`;

  /* ---------------------------------------------------------------- */
  const mentions = {
    titre: "Mentions légales",
    description: "Éditeur, hébergeur et informations légales du site Lashéane.",
    corps: `
    <p class="chapo">Ces informations sont publiées en application de l'article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique.</p>

    <h2>Éditeur du site</h2>
    <p>Le site Lashéane est édité par :</p>
    ${identiteBloc}

    <h2>Directeur de la publication</h2>
    <p>${directeur}</p>

    <h2>Hébergement</h2>
    <p>Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, États-Unis. Téléphone : +1 650 319 8930. Site : <a href="https://www.cloudflare.com" rel="noopener">www.cloudflare.com</a>.</p>

    <h2>Paiement</h2>
    <p>Les paiements sont traités par Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Irlande. Lashéane n'a jamais accès à vos données bancaires.</p>

    <h2>Propriété intellectuelle</h2>
    <p>La marque Lashéane, le logo, les textes et les photographies de ce site appartiennent à l'éditeur. Toute reproduction, même partielle, sans autorisation écrite est interdite.</p>

    <h2>Accessibilité</h2>
    <p>Ce site vise le niveau AA des règles d'accessibilité WCAG 2.2 : textes alternatifs sur les images, contrastes de couleurs suffisants, navigation possible au clavier. Si vous rencontrez une difficulté, écrivez-nous à ${lienEmail} : nous vous répondrons et vous transmettrons l'information sous une autre forme.</p>

    <h2>Pour aller plus loin</h2>
    <ul>
      <li>${lien("/cgv", "Conditions générales de vente et d'utilisation")}</li>
      <li>${lien("/confidentialite", "Politique de confidentialité")}</li>
      <li>${lien("/cookies", "Politique des cookies")}</li>
    </ul>
    ${maj}`,
  };

  /* ---------------------------------------------------------------- */
  const encadreGaranties = `
    <div class="encadre" role="note" aria-label="Information sur les garanties légales">
      <p>Le consommateur dispose d'un délai de deux ans à compter de la délivrance du bien pour obtenir la mise en œuvre de la garantie légale de conformité en cas d'apparition d'un défaut de conformité. Durant ce délai, le consommateur n'est tenu d'établir que l'existence du défaut de conformité et non la date d'apparition de celui-ci.</p>
      <p>Lorsque le contrat de vente du bien prévoit la fourniture d'un contenu numérique ou d'un service numérique de manière continue pendant une durée supérieure à deux ans, la garantie légale est applicable à ce contenu numérique ou ce service numérique tout au long de la période de fourniture prévue. Durant ce délai, le consommateur n'est tenu d'établir que l'existence du défaut de conformité affectant le contenu numérique ou le service numérique et non la date d'apparition de celui-ci.</p>
      <p>La garantie légale de conformité emporte obligation pour le professionnel, le cas échéant, de fournir toutes les mises à jour nécessaires au maintien de la conformité du bien.</p>
      <p>La garantie légale de conformité donne au consommateur droit à la réparation ou au remplacement du bien dans un délai de trente jours suivant sa demande, sans frais et sans inconvénient majeur pour lui.</p>
      <p>Si le bien est réparé dans le cadre de la garantie légale de conformité, le consommateur bénéficie d'une extension de six mois de la garantie initiale.</p>
      <p>Si le consommateur demande la réparation du bien, mais que le vendeur impose le remplacement, la garantie légale de conformité est renouvelée pour une période de deux ans à compter de la date de remplacement du bien.</p>
      <p>Le consommateur peut obtenir une réduction du prix d'achat en conservant le bien ou mettre fin au contrat en se faisant rembourser intégralement contre restitution du bien, si :</p>
      <p>1° Le professionnel refuse de réparer ou de remplacer le bien ;<br>
      2° La réparation ou le remplacement du bien intervient après un délai de trente jours ;<br>
      3° La réparation ou le remplacement du bien occasionne un inconvénient majeur pour le consommateur, notamment lorsque le consommateur supporte définitivement les frais de reprise ou d'enlèvement du bien non conforme, ou s'il supporte les frais d'installation du bien réparé ou de remplacement ;<br>
      4° La non-conformité du bien persiste en dépit de la tentative de mise en conformité du vendeur restée infructueuse.</p>
      <p>Le consommateur a également droit à une réduction du prix du bien ou à la résolution du contrat lorsque le défaut de conformité est si grave qu'il justifie que la réduction du prix ou la résolution du contrat soit immédiate. Le consommateur n'est alors pas tenu de demander la réparation ou le remplacement du bien au préalable.</p>
      <p>Le consommateur n'a pas droit à la résolution de la vente si le défaut de conformité est mineur.</p>
      <p>Toute période d'immobilisation du bien en vue de sa réparation ou de son remplacement suspend la garantie qui restait à courir jusqu'à la délivrance du bien remis en état.</p>
      <p>Les droits mentionnés ci-dessus résultent de l'application des articles L. 217-1 à L. 217-32 du code de la consommation.</p>
      <p>Le vendeur qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité encourt une amende civile d'un montant maximal de 300 000 euros, qui peut être porté jusqu'à 10 % du chiffre d'affaires moyen annuel (article L. 241-5 du code de la consommation).</p>
      <p>Le consommateur bénéficie également de la garantie légale des vices cachés en application des articles 1641 à 1649 du code civil, pendant une durée de deux ans à compter de la découverte du défaut. Cette garantie donne droit à une réduction de prix si le bien est conservé ou à un remboursement intégral contre restitution du bien.</p>
    </div>`;

  const cgv = {
    titre: "Conditions générales de vente et d'utilisation",
    description: "Conditions de vente, livraison, rétractation, remboursements et garanties de la boutique Lashéane.",
    corps: `
    <p class="chapo">Ces conditions s'appliquent à toute commande passée sur ce site par un consommateur, ainsi qu'à l'utilisation du site. Vous les acceptez en cochant la case prévue avant le paiement. La version applicable est celle en vigueur au jour de votre commande.</p>

    <nav class="sommaire" aria-label="Sommaire">
      <ol>
        <li><a href="#vendeur">Vendeur</a></li>
        <li><a href="#produits">Produits</a></li>
        <li><a href="#prix">Prix</a></li>
        <li><a href="#commande">Commande</a></li>
        <li><a href="#paiement">Paiement</a></li>
        <li><a href="#livraison">Livraison</a></li>
        <li><a href="#retractation">Droit de rétractation</a></li>
        <li><a href="#remboursements">Retours et remboursements</a></li>
        <li><a href="#garanties">Garanties légales</a></li>
        <li><a href="#service-client">Service client et réclamations</a></li>
        <li><a href="#mediation">Médiation</a></li>
        <li><a href="#utilisation">Utilisation du site</a></li>
        <li><a href="#donnees">Données personnelles</a></li>
        <li><a href="#droit">Droit applicable</a></li>
      </ol>
    </nav>

    <h2 id="vendeur">1. Vendeur</h2>
    ${identiteBloc}

    <h2 id="produits">2. Produits</h2>
    <p>Les kits Lashéane sont des produits cosmétiques : des extensions de cils en clusters vendues avec les accessoires de pose décrits sur le site. Leurs caractéristiques essentielles figurent sur la page d'accueil. Les photographies sont aussi fidèles que possible.</p>
    <p>Avant toute utilisation, lisez les précautions d'emploi et la liste des ingrédients figurant sur l'emballage. En cas d'irritation, cessez l'utilisation.</p>

    <h2 id="prix">3. Prix</h2>
    <p>Les prix sont indiqués en euros et correspondent au montant total à payer pour chaque kit, hors frais de livraison. ${phraseTva}</p>
    <p>${phraseFrais} Le montant total, frais de livraison compris, est affiché avant le paiement.</p>
    ${offreActive && boutique.offre_appel ? `<p>Offre de lancement : ${esc(boutique.offre_appel)} Le prix appliqué est celui affiché au moment de la validation de la commande.</p>` : `<p>Le prix appliqué est celui affiché au moment de la validation de la commande.</p>`}

    <h2 id="commande">4. Commande</h2>
    <ol>
      <li>Vous ajoutez les kits souhaités au panier, dont vous pouvez modifier le contenu à tout moment.</li>
      <li>Vous cochez la case d'acceptation des présentes conditions, puis vous cliquez sur « Passer au paiement ».</li>
      <li>Sur la page de paiement sécurisée, vous vérifiez le récapitulatif (kits, prix, frais de livraison, total), vous pouvez revenir au panier pour corriger une erreur, puis vous validez avec le bouton de paiement.</li>
    </ol>
    <p>Le contrat est conclu dès la validation du paiement. Une confirmation de commande vous est adressée par email. Lorsqu'une commande atteint 120 euros ou plus, nous conservons l'écrit constatant le contrat pendant 10 ans et vous pouvez y accéder sur simple demande (articles L. 213-1 et D. 213-1 du code de la consommation).</p>

    <h2 id="paiement">5. Paiement</h2>
    <p>Le paiement s'effectue en ligne par carte bancaire ou par l'un des autres moyens proposés sur la page de paiement. Il est traité par notre prestataire Stripe sur une page sécurisée. Le montant est débité à la validation de la commande. Vos données bancaires sont saisies directement chez Stripe : nous n'y avons jamais accès.</p>

    <h2 id="livraison">6. Livraison</h2>
    <p>Nous livrons dans les pays suivants : ${esc(pays.join(", "))}. ${phraseFrais}</p>
    <p>${delaiExpedition ? `Les commandes sont expédiées sous ${delaiExpedition}. ` : ""}${phraseDelai} Sauf autre date indiquée lors de la commande, le kit vous est livré au plus tard 30 jours après la conclusion du contrat (article L. 216-1 du code de la consommation). La livraison est assurée par ${transporteur}.</p>
    <p>Les risques de perte ou d'endommagement vous sont transférés au moment où vous, ou une personne désignée par vous, prenez physiquement possession du colis (article L. 216-4). En cas de retard, vous pouvez nous demander de livrer dans un délai supplémentaire raisonnable, puis, à défaut, mettre fin au contrat dans les conditions des articles L. 216-6 et suivants.</p>

    <h2 id="retractation">7. Droit de rétractation</h2>
    <p>Vous disposez d'un délai de <strong>14 jours</strong> pour vous rétracter, sans avoir à vous justifier ni à payer de pénalité. Ce délai court à partir du jour où vous, ou une personne désignée par vous, recevez le kit. Pour une commande de plusieurs kits livrés séparément, il court à partir de la réception du dernier kit (article L. 221-18 du code de la consommation).</p>
    <p><strong>Comment vous rétracter.</strong> Avant la fin de ce délai, informez-nous de votre décision de l'une de ces façons :</p>
    <ul>
      <li>en ligne, avec la fonction <a href="/retractation"><strong>« Renoncer au contrat ici »</strong></a>, présente en bas de chaque page du site : vous indiquez votre nom, votre commande et votre email, vous confirmez, et vous recevez aussitôt un accusé de réception par email avec la date et l'heure de votre demande ;</li>
      <li>avec le formulaire type ci-dessous, envoyé par email à ${lienEmail} ou par courrier à ${adresse} ;</li>
      <li>par toute autre déclaration dénuée d'ambiguïté envoyée à ces mêmes adresses.</li>
    </ul>
    <p><strong>Exception.</strong> Le droit de rétractation ne peut pas être exercé pour un bien qui a été descellé par le consommateur après la livraison et qui ne peut pas être renvoyé pour des raisons d'hygiène ou de protection de la santé (article L. 221-28, 5° du code de la consommation). Un kit livré scellé dont le scellé a été retiré ne peut donc plus être retourné.</p>

    <h3>Formulaire type de rétractation</h3>
    <p>Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.</p>
    <div class="encadre formulaire-type">
      <p>À l'attention de ${nomVendeur}, ${adresse}, ${lienEmail} :</p>
      <p>Je/nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la vente du bien (*)/pour la prestation de services (*) ci-dessous :</p>
      <p>Commandé le (*)/reçu le (*) :</p>
      <p>Nom du (des) consommateur(s) :</p>
      <p>Adresse du (des) consommateur(s) :</p>
      <p>Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur papier) :</p>
      <p>Date :</p>
      <p>(*) Rayez la mention inutile.</p>
    </div>

    <h2 id="remboursements">8. Retours et remboursements</h2>
    <p><strong>Renvoi du kit.</strong> Renvoyez le kit complet, dans son état d'origine, au plus tard 14 jours après nous avoir communiqué votre décision, à l'adresse suivante : ${adresseRetour}. Les frais de renvoi sont à votre charge. Vous êtes responsable de la dépréciation du kit résultant de manipulations autres que celles nécessaires pour en établir la nature, les caractéristiques et le bon fonctionnement (article L. 221-23).</p>
    <p><strong>Remboursement.</strong> Nous vous remboursons la totalité des sommes versées, frais de livraison standard compris, au plus tard 14 jours après avoir été informés de votre décision. Nous pouvons différer le remboursement jusqu'à la réception du kit ou jusqu'à ce que vous ayez fourni une preuve de son expédition, la date retenue étant celle du premier de ces faits. Le remboursement se fait avec le même moyen de paiement que celui utilisé pour la commande, sans frais pour vous (article L. 221-24).</p>
    <p><strong>Kit abîmé ou non conforme.</strong> Contactez-nous à ${lienEmail} avec votre référence de commande et une photo : les garanties légales ci-dessous s'appliquent, sans frais pour vous.</p>

    <h2 id="garanties">9. Garanties légales</h2>
    <p>Pour mettre en œuvre une garantie, contactez-nous à ${lienEmail} ou à ${adresse}.</p>
    ${encadreGaranties}

    <h2 id="service-client">10. Service client et réclamations</h2>
    <p>Pour toute question ou réclamation : ${lienEmail}, ${telephone}, ou par courrier à ${adresse}.</p>

    <h2 id="mediation">11. Médiation de la consommation</h2>
    <p>Si un litige n'a pas pu être réglé après une réclamation écrite adressée à notre service client, vous pouvez recourir gratuitement au médiateur de la consommation suivant, dans un délai d'un an à compter de votre réclamation écrite (articles L. 612-1 et suivants du code de la consommation) : ${mediateur}.</p>

    <h2 id="utilisation">12. Utilisation du site</h2>
    <p>Le site est accessible gratuitement. Nous faisons notre possible pour qu'il soit disponible et exact, sans pouvoir garantir l'absence d'interruption, notamment pour maintenance. Les liens vers Instagram et TikTok mènent à des services tiers dont nous ne sommes pas responsables.</p>
    <p>La marque, le logo, les textes et les photographies du site sont protégés. Toute reproduction sans autorisation écrite est interdite.</p>

    <h2 id="donnees">13. Données personnelles</h2>
    <p>Le traitement de vos données est décrit dans notre ${lien("/confidentialite", "politique de confidentialité")} et dans notre ${lien("/cookies", "politique des cookies")}.</p>

    <h2 id="droit">14. Droit applicable</h2>
    <p>Les présentes conditions sont soumises au droit français, sans préjudice des dispositions impératives plus protectrices du pays où vous résidez. En cas de litige, vous pouvez saisir, à votre choix, outre l'une des juridictions territorialement compétentes en vertu du code de procédure civile, la juridiction du lieu où vous demeuriez au moment de la conclusion du contrat ou de la survenance du fait dommageable (article R. 631-3 du code de la consommation).</p>
    ${maj}`,
  };

  /* ---------------------------------------------------------------- */
  const confidentialite = {
    titre: "Politique de confidentialité",
    description: "Quelles données Lashéane collecte, pourquoi, combien de temps, et comment exercer vos droits.",
    corps: `
    <p class="chapo">Nous collectons uniquement les données nécessaires pour vendre et livrer nos kits. Pas de mesure d'audience, pas de publicité ciblée, pas de revente de données.</p>

    <h2>Responsable du traitement</h2>
    <p>${nomVendeur}, ${statut}, ${adresse}. Contact : ${lienEmail}.</p>

    <h2>Données collectées et utilisation</h2>
    <div class="tableau">
    <table>
      <caption class="masque">Traitements de données personnelles</caption>
      <thead><tr><th scope="col">Pourquoi</th><th scope="col">Quelles données</th><th scope="col">Base légale (RGPD)</th><th scope="col">Durée de conservation</th></tr></thead>
      <tbody>
        <tr><th scope="row">Traiter, payer et livrer votre commande</th><td>Nom, email, adresse de livraison, adresse de facturation si le moyen de paiement l'exige, kits commandés et montant</td><td>Exécution du contrat (art. 6.1.b)</td><td>Le temps de la commande et de sa livraison, puis archivage ci-dessous</td></tr>
        <tr><th scope="row">Comptabilité et preuve de la vente</th><td>Factures et données de commande</td><td>Obligation légale (art. 6.1.c)</td><td>10 ans (article L. 123-22 du code de commerce)</td></tr>
        <tr><th scope="row">Rétractation, garanties et service client</th><td>Nom, email, référence de commande, contenu de vos messages</td><td>Obligation légale et exécution du contrat</td><td>5 ans après la fin de la relation (délai de prescription)</td></tr>
        <tr><th scope="row">Mémoriser votre panier</th><td>Kits et quantités, stockés uniquement dans votre navigateur</td><td>Nécessaire au service que vous demandez</td><td>Jusqu'à la commande ou jusqu'à ce que vous vidiez le panier</td></tr>
        <tr><th scope="row">Faire fonctionner et protéger le site</th><td>Données techniques de connexion (adresse IP, navigateur, page demandée), traitées par notre hébergeur</td><td>Intérêt légitime (art. 6.1.f) : sécurité du site</td><td>Nous ne conservons aucun journal de visite. Journaux d'erreurs techniques, sans données de commande : 3 jours</td></tr>
      </tbody>
    </table>
    </div>
    <p>Vos données bancaires sont saisies directement sur la page sécurisée de Stripe. Nous n'y avons jamais accès et ne les conservons pas.</p>

    <h2>Destinataires</h2>
    <ul>
      <li><strong>Lashéane</strong>, pour traiter votre commande.</li>
      <li><strong>Stripe</strong> (Stripe Payments Europe, Ltd., Irlande), pour le paiement. Stripe agit aussi comme responsable de traitement indépendant pour la lutte contre la fraude et ses obligations légales : voir sa <a href="https://stripe.com/fr/privacy" rel="noopener">politique de confidentialité</a>.</li>
      <li><strong>Cloudflare</strong> (Cloudflare, Inc., États-Unis), notre hébergeur, en tant que sous-traitant.</li>
      <li><strong>Brevo</strong> (France), pour l'envoi des emails liés à votre commande et à une éventuelle rétractation, en tant que sous-traitant.</li>
      <li><strong>Le transporteur</strong>, qui reçoit votre nom et votre adresse de livraison.</li>
      <li>Notre comptable et, sur demande, les autorités habilitées.</li>
    </ul>
    <p>Certaines données peuvent être traitées aux États-Unis par Cloudflare et par des sociétés du groupe Stripe. Ces transferts sont encadrés par le cadre de protection des données UE–États-Unis (Data Privacy Framework) et par les clauses contractuelles types de la Commission européenne.</p>

    <h2>Vos droits</h2>
    <p>Vous pouvez accéder à vos données, les faire rectifier ou effacer, en limiter le traitement, vous y opposer, demander leur portabilité et définir des directives sur leur sort après votre décès. Écrivez-nous à ${lienEmail} : nous répondons dans un délai d'un mois. Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (<a href="https://www.cnil.fr" rel="noopener">www.cnil.fr</a>).</p>
    <p>Certaines données ne peuvent pas être effacées avant la fin de leur durée de conservation légale, par exemple les factures.</p>

    <h2>Cookies</h2>
    <p>Le site n'utilise que des traceurs strictement nécessaires, exemptés de consentement. Le détail figure dans notre ${lien("/cookies", "politique des cookies")}.</p>

    <h2>Sécurité</h2>
    <p>Le site est servi uniquement en HTTPS. Les clés d'accès aux services de paiement et d'administration sont stockées chiffrées chez notre hébergeur. Le paiement est traité par Stripe, certifié PCI DSS.</p>
    ${maj}`,
  };

  /* ---------------------------------------------------------------- */
  const cookies = {
    titre: "Politique des cookies",
    description: "Les traceurs utilisés sur le site Lashéane et pourquoi aucun bandeau de consentement n'est nécessaire.",
    corps: `
    <p class="chapo">Le site n'utilise ni mesure d'audience, ni publicité, ni bouton de partage qui vous suivrait. Il n'utilise que des traceurs strictement nécessaires à son fonctionnement. Ces traceurs sont exemptés de consentement par la CNIL : c'est pourquoi aucun bandeau ne vous est présenté.</p>

    <h2>Traceurs utilisés</h2>
    <div class="tableau">
    <table>
      <caption class="masque">Traceurs utilisés sur le site</caption>
      <thead><tr><th scope="col">Nom</th><th scope="col">Type</th><th scope="col">Utilité</th><th scope="col">Durée</th><th scope="col">Qui le voit</th></tr></thead>
      <tbody>
        <tr><th scope="row">lasheane-panier</th><td>Stockage local du navigateur</td><td>Garder en mémoire le contenu de votre panier</td><td>Jusqu'à la commande ou jusqu'à ce que vous vidiez le panier</td><td>Votre navigateur uniquement : rien n'est envoyé à nos serveurs</td></tr>
        <tr><th scope="row">lasheane_oauth</th><td>Cookie</td><td>Sécuriser la connexion à l'espace d'administration, réservé à la gérante du site</td><td>10 minutes</td><td>Lashéane</td></tr>
        <tr><th scope="row">decap-cms-user</th><td>Stockage local du navigateur</td><td>Garder la gérante connectée à l'espace d'administration</td><td>Jusqu'à la déconnexion</td><td>Lashéane</td></tr>
        <tr><th scope="row">Cookies de sécurité de l'hébergeur (par exemple __cf_bm)</th><td>Cookie</td><td>Protéger le site contre les robots malveillants, si nécessaire</td><td>30 minutes au plus</td><td>Cloudflare</td></tr>
      </tbody>
    </table>
    </div>

    <h2>Page de paiement</h2>
    <p>Le paiement se déroule sur une page sécurisée de Stripe (checkout.stripe.com), qui utilise ses propres cookies, nécessaires à la sécurité du paiement et à la prévention de la fraude. Ils sont décrits dans la <a href="https://stripe.com/fr/legal/cookies-policy" rel="noopener">politique des cookies de Stripe</a>.</p>

    <h2>Supprimer ces traceurs</h2>
    <p>Vous pouvez à tout moment effacer les cookies et les données de site depuis les réglages de votre navigateur. Votre panier sera alors vidé.</p>

    <h2>Évolutions</h2>
    <p>Si nous ajoutons un jour une mesure d'audience ou un outil publicitaire, nous vous demanderons votre accord avant tout dépôt, et vous pourrez le refuser aussi facilement que l'accepter.</p>
    ${maj}`,
  };

  return {
    "mentions-legales.html": mentions,
    "cgv.html": cgv,
    "confidentialite.html": confidentialite,
    "cookies.html": cookies,
  };
}
