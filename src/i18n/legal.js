// Textes légaux (fr/en). {company.*} est remplacé par les informations saisies dans Paramètres ; [[…]] = élément à compléter.
export const LEGAL = {
  cgv: {
    fr: { title: 'Conditions générales de vente', sections: [
      ['Objet', 'Les présentes conditions régissent les ventes de produits effectuées sur le site de {company.name}.'],
      ['Prix', 'Les prix sont indiqués en euros, toutes taxes comprises. La livraison standard est offerte ; la livraison express est facturée selon le tarif affiché lors de la commande.'],
      ['Commande et paiement', 'Moyens de paiement acceptés : [[à compléter]]. La commande est confirmée par e-mail.'],
      ['Livraison', 'Zones et délais de livraison : [[à compléter]].'],
      ['Droit de rétractation et retours', 'Vous disposez d’un délai de [[14]] jours à compter de la réception pour exercer votre droit de rétractation. Conditions de retour : [[à compléter]].'],
      ['Garanties et réclamations', '[[À compléter : garantie légale de conformité, service client, médiateur de la consommation.]]'],
    ] },
    en: { title: 'Terms of sale', sections: [
      ['Purpose', 'These terms govern the sale of products on the {company.name} website.'],
      ['Prices', 'Prices are shown in euros, all taxes included. Standard shipping is complimentary; express shipping is charged at the rate displayed at checkout.'],
      ['Order and payment', 'Accepted payment methods: [[to be completed]]. Your order is confirmed by email.'],
      ['Shipping', 'Shipping areas and times: [[to be completed]].'],
      ['Right of withdrawal and returns', 'You have [[14]] days from receipt to exercise your right of withdrawal. Return conditions: [[to be completed]].'],
      ['Warranties and complaints', '[[To be completed: legal guarantee of conformity, client service, consumer mediator.]]'],
    ] },
  },
  confidentialite: {
    fr: { title: 'Politique de confidentialité', sections: [
      ['Responsable du traitement', '{company.name}, {company.address}. Contact : {company.email}.'],
      ['Données collectées', 'Nous collectons les données que vous nous transmettez (nom, adresse e-mail, téléphone, adresses de livraison et de facturation) lors de la création d’un compte, d’une commande, d’une inscription à la newsletter ou d’une prise de contact. Votre mot de passe n’est jamais conservé en clair.'],
      ['Finalités', 'Ces données servent à gérer votre compte, traiter vos commandes, répondre à vos demandes et, avec votre accord explicite, vous envoyer nos lettres.'],
      ['Durée de conservation', '[[À compléter.]] Vous pouvez supprimer votre compte à tout moment depuis votre espace client.'],
      ['Vos droits', 'Vous disposez d’un droit d’accès, de rectification, d’effacement et d’opposition. Pour l’exercer : {company.email}. Vous pouvez également saisir la CNIL.'],
      ['Paiement', 'Les paiements sont traités par Stripe. {company.name} n’a jamais accès à vos coordonnées bancaires.'],
      ['Cookies et stockage', 'Le site n’utilise aucun cookie publicitaire ni de mesure d’audience. Seuls des éléments strictement nécessaires sont utilisés : un cookie de session lorsque vous êtes connecté, un cookie mémorisant votre langue, et le stockage local de votre navigateur pour conserver votre panier.'],
    ] },
    en: { title: 'Privacy policy', sections: [
      ['Data controller', '{company.name}, {company.address}. Contact: {company.email}.'],
      ['Data collected', 'We collect the data you provide (name, email address, phone, shipping and billing addresses) when you create an account, place an order, subscribe to the newsletter or contact us. Your password is never stored in plain text.'],
      ['Purposes', 'This data is used to manage your account, process your orders, answer your requests and, with your explicit consent, send you our letters.'],
      ['Retention period', '[[To be completed.]] You can delete your account at any time from your client area.'],
      ['Your rights', 'You have the right to access, rectify, erase and object. To exercise these rights: {company.email}. You may also contact the CNIL (French data protection authority).'],
      ['Payment', 'Payments are processed by Stripe. {company.name} never has access to your card details.'],
      ['Cookies and storage', 'The site uses no advertising or analytics cookies. Only strictly necessary elements are used: a session cookie when you are signed in, a cookie remembering your language, and your browser’s local storage to keep your bag.'],
    ] },
  },
  mentions: {
    fr: { title: 'Mentions légales', sections: [
      ['Éditeur du site', '{company.name}, [[forme juridique]] au capital de [[montant]] €. SIRET : {company.siret}. TVA intracommunautaire : {company.vat}. Siège social : {company.address}. Directeur de la publication : [[nom]].'],
      ['Contact', 'E-mail : {company.email} — Téléphone : {company.phone}.'],
      ['Hébergement', 'Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.'],
      ['Propriété intellectuelle', 'L’ensemble des contenus de ce site (textes, images, logos, marques) est la propriété de {company.name}. Toute reproduction sans autorisation est interdite.'],
    ] },
    en: { title: 'Legal notice', sections: [
      ['Publisher', '{company.name}, [[legal form]] with a share capital of €[[amount]]. SIRET: {company.siret}. EU VAT number: {company.vat}. Registered office: {company.address}. Publication director: [[name]].'],
      ['Contact', 'Email: {company.email} — Phone: {company.phone}.'],
      ['Hosting', 'The site is hosted by Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, United States.'],
      ['Intellectual property', 'All content on this site (texts, images, logos, trademarks) is the property of {company.name}. Any reproduction without permission is prohibited.'],
    ] },
  },
};
