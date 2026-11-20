/* Entremis — espace client et espace équipe. Données D'EXEMPLE pour la maquette : aucun nom, chiffre ou entreprise n'est réel.
   Axe (Marc, 19 nov. 2026) : acquisition de leads pour la rénovation énergétique (pompes à chaleur, panneaux solaires, isolation…).
   Les clients d'Entremis sont des artisans et installateurs qui travaillent chez les particuliers (pompes à chaleur, photovoltaïque,
   isolation, climatisation, plomberie, serrurerie et portes blindées…). Leurs prospects sont des particuliers qui demandent un devis.
   Une seule offre : des rendez-vous qualifiés (devis ou visite technique à domicile). Pas de recrutement (Marc, 19 nov. 2026).
   La campagne s'appelle « b2b » pour des raisons historiques. */

window.ENTREMIS_DATA = {
  today: { iso: "2026-11-19", label: "jeudi 19 novembre", now: "10:40", nowMinutes: 640 },
  weeks: [
    { start: "2026-11-09", label: "9 – 13 novembre 2026" },
    { start: "2026-11-16", label: "16 – 20 novembre 2026" },
    { start: "2026-11-23", label: "23 – 27 novembre 2026" }
  ],
  user: { name: "Julie Arnaud", first: "Julie", initials: "JA", role: "Gérante", company: "Solaria Habitat" },

  campaigns: {
    b2b: {
      id: "b2b",
      offer: "Rendez-vous énergie",
      short: "Rendez-vous",
      name: "Pompes à chaleur, Rhône",
      goal: { done: 8, target: 10, day: 17, days: 21, unit: "rendez-vous livrés" },
      words: { at: "au rendez-vous", person: "Prospect", people: "rendez-vous", one: "rendez-vous", role: "Projet", org: "Logement",
               accounts: "Demandes", accountsAll: "Les plus récentes", account: "Demande", tab: "Demandes",
               accountsSub: "Les particuliers qui ont demandé une étude.", found: "Demande reçue" },
      steps: { targeted: "Reçue", contacted: "Rappelée", replied: "Qualifiée", meeting: "Rendez-vous" },
      criteria: [
        { key: "besoin", label: "Projet" },
        { key: "budget", label: "Budget et aides" },
        { key: "decideur", label: "Propriétaire" },
        { key: "delai", label: "Délai" }
      ],
      kpis: [
        { label: "Demandes reçues", value: "312", note: "en 17 jours", ticks: [12,15,19,14,22,25,18,16,21,24,19,17,23,26,20,18,24] },
        { label: "Qualifiées", value: "64", note: "21 % du total", ticks: [2,3,4,3,5,5,4,3,4,5,4,3,5,6,4,3,5] },
        { label: "Délai de rappel", value: "48 s", note: "à confirmer", ticks: [6,5,7,4,5,6,3,4,5,4,6,5,4,3,4,5,4] },
        { label: "Présence aux rendez-vous", value: "7 / 8", note: "1 absence, remplacée", ticks: [1,1,1,1,1,0,1,1] }
      ],
      appointments: [
        { id: "thomas-leroy", date: "2026-11-10", start: "09:30", end: "10:30", name: "Thomas Leroy", initials: "TL", role: "Pompe à chaleur air/eau", org: "Maison de 1978, 120 m²", city: "Villeurbanne", mode: "Visite technique", state: "ok",
          criteria: { besoin: "Remplacer une chaudière fioul par une pompe à chaleur air/eau", budget: "12 à 15 k€, éligible MaPrimeRénov' (à confirmer)", decideur: "Oui, propriétaire occupant", delai: "Travaux avant février" },
          signals: ["Facture de fioul de 2 600 € par an", "Demande via le simulateur d'aides"] },
        { id: "ines-moreau", date: "2026-11-12", start: "14:00", end: "15:00", name: "Inès Moreau", initials: "IM", role: "Panneaux solaires, 6 kWc", org: "Maison de 2004, toit plein sud", city: "Bron", mode: "Visite technique", state: "ok",
          criteria: { besoin: "Panneaux solaires en autoconsommation, 6 kWc", budget: "11 k€, prime à l'autoconsommation", decideur: "Oui, avec son conjoint", delai: "Pose au printemps" },
          signals: ["Voiture électrique depuis septembre"] },
        { id: "sophie-marchal", date: "2026-11-17", start: "10:00", end: "11:00", name: "Sophie Marchal", initials: "SM", role: "Pompe à chaleur air/eau", org: "Maison de 1985, 140 m²", city: "Caluire", mode: "Visite technique", state: "ok",
          criteria: { besoin: "Pompe à chaleur air/eau avec ballon, en remplacement du gaz", budget: "14 k€ prévus, aides à déduire", decideur: "Oui, propriétaire", delai: "Sous 6 semaines" },
          signals: ["Chaudière gaz de 22 ans", "A comparé 2 devis en ligne"],
          note: "Elle a déjà reçu un devis qu'elle trouve flou. Venez avec le calcul des aides détaillé ligne par ligne." },
        { id: "paul-girard", date: "2026-11-17", start: "16:00", end: "17:00", name: "Paul Girard", initials: "PG", role: "Isolation des combles", org: "Maison de 1972, 95 m²", city: "Vénissieux", mode: "Visite technique", state: "replaced", replacedBy: "claire-fontaine", absence: { reported: "17 nov. à 16:20", reason: "Absent, sans prévenir" },
          criteria: { besoin: "Isolation des combles perdus", budget: "À préciser", decideur: "Locataire, pas propriétaire", delai: "Premier semestre 2027" },
          signals: ["Demande via une publicité Facebook"] },
        { id: "karim-benali", date: "2026-11-19", start: "08:30", end: "09:30", name: "Karim Benali", initials: "KB", role: "Pompe à chaleur et solaire", org: "Maison de 1990, 160 m²", city: "Lyon 5e", mode: "Visite technique", state: "ok",
          criteria: { besoin: "Pompe à chaleur air/eau, puis panneaux solaires", budget: "20 à 25 k€, éligible aux aides (à confirmer)", decideur: "Oui", delai: "Décision en décembre" },
          signals: ["Facture d'électricité de 3 100 € par an", "Vient d'acheter la maison"],
          note: "Il veut tout faire en une fois : proposez la pompe à chaleur et le solaire dans le même devis." },
        { id: "claire-fontaine", date: "2026-11-19", start: "11:30", end: "12:30", name: "Claire Fontaine", initials: "CF", role: "Pompe à chaleur air/air", org: "Maison de 1998, 110 m²", city: "Écully", mode: "Visite technique", state: "replacement", replaces: "paul-girard",
          criteria: { besoin: "Climatisation réversible dans 4 pièces", budget: "8 k€ prévus", decideur: "Oui, seule décisionnaire", delai: "Avant l'été" },
          signals: ["Radiateurs électriques anciens"] },
        { id: "hugo-lambert", date: "2026-11-19", start: "15:00", end: "15:30", name: "Hugo Lambert", initials: "HL", role: "Panneaux solaires, 3 kWc", org: "Maison de 2010, 100 m²", city: "Tassin", mode: "Appel", state: "new",
          criteria: { besoin: "Petite installation solaire pour réduire la facture", budget: "En réflexion, autour de 7 k€", decideur: "Oui", delai: "Janvier" },
          signals: ["A utilisé le simulateur de production"] },
        { id: "lea-dubois", date: "2026-11-20", start: "10:00", end: "11:00", name: "Léa Dubois", initials: "LD", role: "Isolation par l'extérieur", org: "Maison de 1965, 130 m²", city: "Oullins", mode: "Visite technique", state: "new",
          criteria: { besoin: "Isolation des murs par l'extérieur", budget: "25 k€, aides à étudier", decideur: "Oui, avec sa sœur (indivision)", delai: "Avant l'hiver prochain" },
          signals: ["Diagnostic énergie classé F"] },
        { id: "antoine-rey", date: "2026-11-20", start: "14:30", end: "15:30", name: "Antoine Rey", initials: "AR", role: "Pompe à chaleur air/eau", org: "Maison de 1982, 150 m²", city: "Sainte-Foy", mode: "Visite technique", state: "ok",
          criteria: { besoin: "Remplacer la chaudière fioul", budget: "Validé, 15 k€", decideur: "Oui", delai: "Sous 3 mois" },
          signals: ["Cuve à fioul à remplacer"] }
      ],
      accounts: [
        { org: "Sophie Marchal", sector: "Pompe à chaleur", city: "Caluire", size: "Maison de 1985", signal: "Chaudière gaz de 22 ans", step: "meeting", last: "17 nov." },
        { org: "Karim Benali", sector: "Pompe à chaleur et solaire", city: "Lyon 5e", size: "Maison de 1990", signal: "Facture d'électricité de 3 100 €", step: "meeting", last: "19 nov." },
        { org: "Claire Fontaine", sector: "Pompe à chaleur air/air", city: "Écully", size: "Maison de 1998", signal: "Radiateurs électriques anciens", step: "meeting", last: "18 nov." },
        { org: "Hugo Lambert", sector: "Panneaux solaires", city: "Tassin", size: "Maison de 2010", signal: "Simulateur de production", step: "meeting", last: "18 nov." },
        { org: "Mathilde Garnier", sector: "Pompe à chaleur", city: "Décines", size: "Maison de 1979", signal: "Chauffage au fioul", step: "replied", last: "18 nov." },
        { org: "Yanis Roux", sector: "Panneaux solaires", city: "Meyzieu", size: "Maison de 2015", signal: "Voiture électrique", step: "replied", last: "18 nov." },
        { org: "Camille Perrault", sector: "Isolation", city: "Saint-Priest", size: "Maison de 1970", signal: "Diagnostic énergie classé G", step: "contacted", last: "18 nov." },
        { org: "Nora Benoît", sector: "Pompe à chaleur", city: "Rillieux", size: "Maison de 1988", signal: "Chaudière en panne", step: "contacted", last: "17 nov." },
        { org: "Olivier Masson", sector: "Panneaux solaires", city: "Bron", size: "Maison de 2001", signal: "Toit refait en 2025", step: "contacted", last: "16 nov." },
        { org: "Amélie Vidal", sector: "Isolation", city: "Vaulx-en-Velin", size: "Appartement, 3e étage", signal: "Formulaire du site", step: "targeted", last: "—" }
      ],
      messages: [
        { id: "m1", to: "Mathilde Garnier", org: "Décines", channel: "SMS", date: "18 nov. – 09:12", status: "replied", subject: "Votre demande d'étude pompe à chaleur",
          body: "Bonjour Mathilde, c'est Richard pour Solaria Habitat. Vous avez demandé une étude pour remplacer votre chauffage au fioul. Quand puis-je vous appeler 5 minutes pour préparer la visite ?",
          reply: "Bonjour, demain matin c'est parfait, avant 10h." },
        { id: "m2", to: "Yanis Roux", org: "Meyzieu", channel: "E-mail", date: "18 nov. – 11:40", status: "replied", subject: "Votre simulation solaire",
          body: "Bonjour Yanis,\n\nMerci pour votre simulation. Avec votre voiture électrique, une installation de 6 kWc couvrirait une bonne partie de vos recharges.\n\nUn technicien de Solaria Habitat peut passer voir votre toit cette semaine. Quel créneau vous arrange ?\n\nRichard, pour Solaria Habitat",
          reply: "Samedi matin si possible." },
        { id: "m3", to: "Camille Perrault", org: "Saint-Priest", channel: "SMS", date: "18 nov. – 08:55", status: "sent", subject: "Isolation de votre maison",
          body: "Bonjour Camille, Richard pour Solaria Habitat. Votre maison est classée G : une isolation bien faite peut changer votre facture et votre classement. Je vous rappelle aujourd'hui ?" },
        { id: "m4", to: "Nora Benoît", org: "Rillieux", channel: "SMS", date: "17 nov. – 16:02", status: "sent", subject: "Votre chaudière en panne",
          body: "Bonjour Nora, vous nous avez écrit pour une chaudière en panne. Solaria Habitat peut passer cette semaine pour étudier une pompe à chaleur. Un créneau vous convient ?" },
        { id: "m5", to: "Olivier Masson", org: "Bron", channel: "E-mail", date: "16 nov. – 10:18", status: "followup", subject: "Relance – panneaux solaires",
          body: "Bonjour Olivier,\n\nJe reviens vers vous pour votre projet de panneaux solaires. Votre toit refait en 2025 est idéal pour une pose. Toujours d'actualité ?\n\nRichard, pour Solaria Habitat" }
      ]
    }
  },

  absenceReasons: ["Absent, sans prévenir", "Critère non respecté", "Pas le bon interlocuteur", "Autre raison"]
};

/* ---------- Côté équipe : les trois fondateurs ---------- */
window.ENTREMIS_DATA.team = {
  members: [
    { id: "marc", name: "Marc", initials: "MA", role: "Marketing et communication" },
    { id: "richard", name: "Richard", initials: "RI", role: "Partenariats et rendez-vous" },
    { id: "gianni", name: "Gianni", initials: "GI", role: "Fondateur, rôle à préciser" }
  ],
  // Campagnes clients en cours. pace : ahead | ontrack | late. camp : la campagne qui s'ouvre en « vue client ».
  clients: [
    { id: "solaria", name: "Solaria Habitat", contact: "Julie Arnaud", contactRole: "Gérante", trade: "Pompes à chaleur et solaire", offer: "Rendez-vous", camp: "b2b", done: 8, target: 10, day: 17, days: 21, owner: "richard", pace: "ontrack", next: "Hugo Lambert – aujourd'hui 15:00", absences: 0 },
    { id: "thermo", name: "Thermo Rhône", contact: "Olivier Roux", contactRole: "Gérant", trade: "Climatisation et pompes à chaleur", offer: "Rendez-vous", done: 12, target: 15, day: 17, days: 21, owner: "gianni", pace: "ontrack", next: "Bruno Petit – aujourd'hui 16:00", absences: 0 },
    { id: "ecotoit", name: "Éco Toit Bretagne", contact: "Yann Le Bihan", contactRole: "Gérant", trade: "Panneaux solaires", offer: "Rendez-vous", done: 3, target: 12, day: 12, days: 21, owner: "richard", pace: "late", next: "À placer", absences: 1 },
    { id: "isolea", name: "Isoléa", contact: "Sandrine Morel", contactRole: "Gérante", trade: "Isolation", offer: "Rendez-vous", done: 9, target: 12, day: 9, days: 21, owner: "gianni", pace: "ahead", next: "Lina Martin – demain 09:30", absences: 0 },
    { id: "delmas", name: "Plomberie Delmas", contact: "Jean Delmas", contactRole: "Artisan plombier", trade: "Plomberie et chauffe-eau", offer: "Rendez-vous", done: 1, target: 10, day: 3, days: 21, owner: "marc", pace: "ontrack", next: "Paul Rivière – lun. 14:00", absences: 0 },
    { id: "blindex", name: "Blindex Lyon", contact: "Mehdi Saïdi", contactRole: "Gérant", trade: "Serrurerie et portes blindées", offer: "Rendez-vous", done: 6, target: 10, day: 10, days: 21, owner: "richard", pace: "ahead", next: "Nadia Ferhat – demain 18:00", absences: 0 }
  ],
  replacements: [
    { client: "Éco Toit Bretagne", person: "Gaëlle Le Goff, solaire 6 kWc, Vannes", reported: "18 nov.", due: "25 nov.", owner: "richard", status: "searching" },
    { client: "Solaria Habitat", person: "Paul Girard, isolation, Vénissieux", reported: "17 nov.", due: "24 nov.", owner: "richard", status: "placed", by: "Claire Fontaine – aujourd'hui 11:30" }
  ],
  // Tâches d'EXEMPLE : affichées seulement quand la base partagée n'est pas là (aperçu local).
  // Dans la page publiée, les tâches sont celles que l'équipe crée, partagées entre les trois.
  tasks: [
    { id: "t1", title: "Trouver un remplaçant pour Éco Toit Bretagne", who: "richard", client: "Éco Toit Bretagne", status: "doing", due: "2026-11-20" },
    { id: "t2", title: "Rappeler Hugo Lambert pour confirmer l'appel de 15:00", who: "richard", client: "Solaria Habitat", status: "todo", due: "2026-11-19" },
    { id: "t3", title: "Envoyer le bilan de semaine à Solaria Habitat", who: "marc", client: "Solaria Habitat", status: "todo", due: "2026-11-20" },
    { id: "t4", title: "Lancer la publicité « chauffe-eau » pour Plomberie Delmas", who: "marc", client: "Plomberie Delmas", status: "doing", due: "2026-11-21" },
    { id: "t5", title: "Rappeler les 18 demandes solaires sans réponse", who: "gianni", client: "Éco Toit Bretagne", status: "todo", due: "2026-11-18" },
    { id: "t6", title: "Préparer la page Garantie du site", who: "marc", client: "Entremis", status: "doing", due: "2026-11-24" },
    { id: "t7", title: "Signer le devis d'Isoléa pour décembre", who: "richard", client: "Isoléa", status: "todo", due: "2026-11-25" },
    { id: "t8", title: "Qualifier Karim Benali (4 critères)", who: "richard", client: "Solaria Habitat", status: "done", doneAt: "2026-11-18T17:40" },
    { id: "t9", title: "Écrire les SMS de rappel de la campagne Delmas", who: "marc", client: "Plomberie Delmas", status: "done", doneAt: "2026-11-18T11:05" },
    { id: "t10", title: "Rappeler les demandes de climatisation de Vénissieux", who: "gianni", client: "Thermo Rhône", status: "done", doneAt: "2026-11-18T16:12" },
    { id: "t11", title: "Placer Claire Fontaine en remplacement de Paul Girard", who: "richard", client: "Solaria Habitat", status: "done", doneAt: "2026-11-18T09:30" },
    { id: "t12", title: "Publier le post LinkedIn « garantis ou remplacés »", who: "marc", client: "Entremis", status: "done", doneAt: "2026-11-17T18:20" },
    { id: "t13", title: "Importer les demandes du formulaire Thermo Rhône", who: "gianni", client: "Thermo Rhône", status: "done", doneAt: "2026-11-17T10:02" },
    { id: "t14", title: "Appel de découverte avec Plomberie Delmas", who: "richard", client: "Plomberie Delmas", status: "done", doneAt: "2026-11-16T15:00" }
  ],
  weekly: [
    { label: "28 sept.", value: 4 }, { label: "5 oct.", value: 6 }, { label: "12 oct.", value: 5 }, { label: "19 oct.", value: 9 },
    { label: "26 oct.", value: 8 }, { label: "2 nov.", value: 12 }, { label: "9 nov.", value: 14 }, { label: "16 nov.", value: 11, current: true }
  ],
  goals: [
    { label: "Rendez-vous livrés en novembre", done: 41, target: 60 },
    { label: "Nouveaux installateurs signés en novembre", done: 2, target: 3 },
    { label: "Absences remplacées sous 5 jours", done: 3, target: 4 }
  ],
  trades: [
    { label: "Pompes à chaleur", value: 385 },
    { label: "Photovoltaïque", value: 271 },
    { label: "Isolation", value: 157 },
    { label: "Climatisation", value: 123 },
    { label: "Plomberie", value: 96 },
    { label: "Serrurerie et portes blindées", value: 58 }
  ],
  // Nouveaux clients à signer (installateurs). stage : lead | call | quote | won. value : € par mois, hors taxes (exemple)
  pipeline: [
    { id: "p1", name: "Thermik Alsace", trade: "Pompes à chaleur", city: "Colmar", stage: "lead", owner: "marc", value: 2400, next: "Premier appel à caler", source: "LinkedIn" },
    { id: "p2", name: "SolarOuest", trade: "Panneaux solaires", city: "Nantes", stage: "lead", owner: "gianni", value: 3000, next: "Relance mardi", source: "Salon Énergie" },
    { id: "p3", name: "Habitat Confort 69", trade: "Isolation", city: "Lyon", stage: "call", owner: "richard", value: 1800, next: "Envoyer la proposition", source: "Recommandation Isoléa" },
    { id: "p4", name: "Clim'Azur", trade: "Climatisation et PAC", city: "Nice", stage: "call", owner: "richard", value: 2400, next: "Rappel jeudi 10:00", source: "Site Entremis" },
    { id: "p5", name: "Blindex Annecy", trade: "Serrurerie et portes blindées", city: "Annecy", stage: "quote", owner: "marc", value: 1500, next: "Réponse attendue vendredi", source: "LinkedIn" },
    { id: "p6", name: "Énergie Plus Rennes", trade: "Pompes à chaleur et solaire", city: "Rennes", stage: "quote", owner: "gianni", value: 3600, next: "Négocier la durée", source: "Recommandation Éco Toit" },
    { id: "p7", name: "Plomberie Delmas", trade: "Plomberie et chauffe-eau", city: "Grenoble", stage: "won", owner: "marc", value: 2400, next: "Campagne lancée le 16 nov.", source: "Site Entremis" },
    { id: "p8", name: "Isoléa", trade: "Isolation", city: "Villeurbanne", stage: "won", owner: "gianni", value: 1800, next: "Renouvellement en décembre", source: "Appel sortant" }
  ],
  // Devis et factures d'EXEMPLE (affichés seulement sans base partagée). kind : devis | facture.
  // status : brouillon | envoye | signe | paye | retard. amount : € HT.
  documents: [
    { id: "d1", kind: "facture", number: "F-2026-031", client: "Solaria Habitat", amount: 2400, date: "2026-11-01", due: "2026-11-15", status: "paye" },
    { id: "d2", kind: "facture", number: "F-2026-032", client: "Thermo Rhône", amount: 2400, date: "2026-11-01", due: "2026-11-15", status: "retard" },
    { id: "d3", kind: "facture", number: "F-2026-033", client: "Isoléa", amount: 1800, date: "2026-11-05", due: "2026-11-20", status: "envoye" },
    { id: "d4", kind: "facture", number: "F-2026-034", client: "Blindex Lyon", amount: 2000, date: "2026-11-10", due: "2026-11-25", status: "envoye" },
    { id: "d5", kind: "devis", number: "D-2026-018", client: "Énergie Plus Rennes", amount: 3600, date: "2026-11-14", due: "2026-11-28", status: "envoye" },
    { id: "d6", kind: "devis", number: "D-2026-017", client: "Blindex Annecy", amount: 1500, date: "2026-11-12", due: "2026-11-26", status: "envoye" },
    { id: "d7", kind: "devis", number: "D-2026-016", client: "Plomberie Delmas", amount: 2400, date: "2026-11-08", due: "2026-11-22", status: "signe" },
    { id: "d8", kind: "devis", number: "D-2026-019", client: "Clim'Azur", amount: 2400, date: "2026-11-19", due: "", status: "brouillon" }
  ],
  // Chiffre d'affaires encaissé par mois (€ HT, exemple) et charges du mois
  revenue: [
    { label: "juin", value: 3200 }, { label: "juil.", value: 4100 }, { label: "août", value: 3900 }, { label: "sept.", value: 6000 },
    { label: "oct.", value: 8400 }, { label: "nov.", value: 9800, current: true }
  ],
  costs: [
    { label: "Publicités en ligne", value: 1450 }, { label: "Outils (CRM, e-mails, téléphonie)", value: 420 },
    { label: "Boîtes d'envoi dédiées", value: 180 }, { label: "Comptable", value: 150 }
  ],
  // Journal d'appels d'EXEMPLE. result : rdv | rappeler | pas-interesse | messagerie | qualifie
  calls: [
    { id: "c1", who: "richard", contact: "Karim Benali", company: "Particulier – Lyon 5e", about: "Solaria Habitat", result: "rdv", minutes: 9, at: "2026-11-19T09:42", note: "Visite technique calée jeudi 08:30." },
    { id: "c2", who: "gianni", contact: "Gaëlle Le Goff", company: "Particulier – Vannes", about: "Éco Toit Bretagne", result: "rappeler", minutes: 4, at: "2026-11-19T09:15", note: "Rappeler après 18 h." },
    { id: "c3", who: "richard", contact: "Clim'Azur", company: "Installateur – Nice", about: "Prospection", result: "qualifie", minutes: 22, at: "2026-11-18T16:05", note: "Intéressé, veut une proposition pour 10 rendez-vous par mois." },
    { id: "c4", who: "marc", contact: "Thermik Alsace", company: "Installateur – Colmar", about: "Prospection", result: "messagerie", minutes: 1, at: "2026-11-18T14:30", note: "Message laissé." },
    { id: "c5", who: "gianni", contact: "Nora Benoît", company: "Particulier – Rillieux", about: "Solaria Habitat", result: "pas-interesse", minutes: 3, at: "2026-11-18T11:20", note: "Chaudière réparée, plus de projet." },
    { id: "c6", who: "richard", contact: "Mathilde Garnier", company: "Particulier – Décines", about: "Solaria Habitat", result: "rdv", minutes: 11, at: "2026-11-18T10:02", note: "Rendez-vous mardi matin." }
  ],
  // Marketing d'EXEMPLE
  seo: {
    traffic: [{ label: "juin", value: 120 }, { label: "juil.", value: 180 }, { label: "août", value: 210 }, { label: "sept.", value: 340 }, { label: "oct.", value: 520 }, { label: "nov.", value: 690, current: true }],
    keywords: [
      { q: "leads pompe à chaleur", pos: 4, prev: 9, volume: 320 },
      { q: "rendez-vous qualifiés artisans", pos: 7, prev: 12, volume: 140 },
      { q: "prospection installateur photovoltaïque", pos: 11, prev: 11, volume: 210 },
      { q: "trouver des clients plombier", pos: 18, prev: 24, volume: 480 },
      { q: "génération de leads rénovation énergétique", pos: 23, prev: 19, volume: 260 }
    ]
  },
  ads: [
    { id: "a1", name: "Pompe à chaleur – Rhône", channel: "Meta", client: "Solaria Habitat", budget: 900, spent: 640, leads: 96, status: "on" },
    { id: "a2", name: "Climatisation – Lyon Est", channel: "Google", client: "Thermo Rhône", budget: 600, spent: 410, leads: 38, status: "on" },
    { id: "a3", name: "Panneaux solaires – Morbihan", channel: "Meta", client: "Éco Toit Bretagne", budget: 700, spent: 690, leads: 41, status: "on" },
    { id: "a4", name: "Porte blindée – Lyon", channel: "Google", client: "Blindex Lyon", budget: 400, spent: 120, leads: 22, status: "on" },
    { id: "a5", name: "Entremis – installateurs", channel: "LinkedIn", client: "Entremis", budget: 300, spent: 300, leads: 6, status: "off" }
  ],
  // Leads (demandes de particuliers) trouvés par Entremis, et le client à qui chacun est donné. EXEMPLE.
  // status : nouveau | rappele | qualifie | attribue | rdv | perdu. to : id du client (un seul : exclusif).
  leads: [
    { id: "l1", name: "Sophie Marchal", city: "Caluire", zone: "Rhône", trade: "Pompes à chaleur", source: "Facebook", at: "2026-11-12T19:42", status: "rdv", to: "solaria" },
    { id: "l2", name: "Karim Benali", city: "Lyon 5e", zone: "Rhône", trade: "Pompes à chaleur", source: "Google", at: "2026-11-14T08:15", status: "rdv", to: "solaria" },
    { id: "l3", name: "Claire Fontaine", city: "Écully", zone: "Rhône", trade: "Climatisation", source: "Site", at: "2026-11-17T12:03", status: "rdv", to: "solaria" },
    { id: "l4", name: "Bruno Petit", city: "Saint-Priest", zone: "Rhône", trade: "Climatisation", source: "Google", at: "2026-11-18T10:40", status: "rdv", to: "thermo" },
    { id: "l5", name: "Gaëlle Le Goff", city: "Vannes", zone: "Morbihan", trade: "Photovoltaïque", source: "Facebook", at: "2026-11-15T21:10", status: "qualifie", to: "ecotoit" },
    { id: "l6", name: "Lina Martin", city: "Villeurbanne", zone: "Rhône", trade: "Isolation", source: "Facebook", at: "2026-11-18T18:22", status: "rdv", to: "isolea" },
    { id: "l7", name: "Paul Rivière", city: "Grenoble", zone: "Isère", trade: "Plomberie", source: "Google", at: "2026-11-18T09:05", status: "rdv", to: "delmas" },
    { id: "l8", name: "Nadia Ferhat", city: "Lyon 3e", zone: "Rhône", trade: "Serrurerie", source: "Google", at: "2026-11-18T22:47", status: "rdv", to: "blindex" },
    { id: "l9", name: "Mathilde Garnier", city: "Décines", zone: "Rhône", trade: "Pompes à chaleur", source: "Facebook", at: "2026-11-18T09:12", status: "qualifie", to: "solaria" },
    { id: "l10", name: "Yanis Roux", city: "Meyzieu", zone: "Rhône", trade: "Photovoltaïque", source: "Site", at: "2026-11-18T11:40", status: "qualifie", to: "solaria" },
    { id: "l11", name: "Jean Morel", city: "Lorient", zone: "Morbihan", trade: "Photovoltaïque", source: "Facebook", at: "2026-11-19T07:58", status: "rappele", to: null },
    { id: "l12", name: "Sylvie Brun", city: "Vénissieux", zone: "Rhône", trade: "Isolation", source: "Google", at: "2026-11-19T08:31", status: "qualifie", to: null },
    { id: "l13", name: "Hervé Caron", city: "Bron", zone: "Rhône", trade: "Climatisation", source: "Facebook", at: "2026-11-19T09:47", status: "nouveau", to: null },
    { id: "l14", name: "Aline Masson", city: "Échirolles", zone: "Isère", trade: "Plomberie", source: "Site", at: "2026-11-19T10:12", status: "qualifie", to: null },
    { id: "l15", name: "Romain Dufour", city: "Lyon 7e", zone: "Rhône", trade: "Serrurerie", source: "Google", at: "2026-11-19T10:31", status: "nouveau", to: null },
    { id: "l17", name: "Hugo Lambert", city: "Tassin", zone: "Rhône", trade: "Photovoltaïque", source: "Google", at: "2026-11-16T14:05", status: "rdv", to: "solaria" },
    { id: "l18", name: "Camille Perrault", city: "Saint-Priest", zone: "Rhône", trade: "Isolation", source: "Facebook", at: "2026-11-17T20:31", status: "rappele", to: "solaria" },
    { id: "l19", name: "Nora Benoît", city: "Rillieux", zone: "Rhône", trade: "Pompes à chaleur", source: "Facebook", at: "2026-11-16T18:12", status: "rappele", to: "solaria" },
    { id: "l20", name: "Olivier Masson", city: "Bron", zone: "Rhône", trade: "Photovoltaïque", source: "Google", at: "2026-11-15T09:44", status: "rappele", to: "solaria" },
    { id: "l21", name: "Amélie Vidal", city: "Vaulx-en-Velin", zone: "Rhône", trade: "Isolation", source: "Site", at: "2026-11-19T07:20", status: "attribue", to: "solaria" },
    { id: "l16", name: "Céline Roy", city: "Oullins", zone: "Rhône", trade: "Pompes à chaleur", source: "Facebook", at: "2026-11-17T15:20", status: "perdu", to: null, why: "Locataire, pas propriétaire" }
  ],
  // Où chaque client prend ses leads : métier et zone (sert à proposer le bon client)
  coverage: {
    solaria: { trades: ["Pompes à chaleur", "Photovoltaïque", "Climatisation", "Isolation"], zones: ["Rhône"] },
    thermo: { trades: ["Climatisation", "Pompes à chaleur"], zones: ["Rhône"] },
    ecotoit: { trades: ["Photovoltaïque"], zones: ["Morbihan", "Finistère"] },
    isolea: { trades: ["Isolation"], zones: ["Rhône"] },
    delmas: { trades: ["Plomberie"], zones: ["Isère"] },
    blindex: { trades: ["Serrurerie"], zones: ["Rhône"] }
  },
  perPerson: {
    marc: [["Pubs en ligne", "4"], ["Messages écrits", "86"]],
    richard: [["RDV placés", "7"], ["Appels qualif.", "38"]],
    gianni: [["Rappels", "120"], ["RDV placés", "5"]]
  }
};
