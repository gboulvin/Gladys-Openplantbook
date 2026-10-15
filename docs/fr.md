# OpenPlantBook

Cette intégration amène dans Gladys la base de données de plantes
[Open Plantbook](https://open.plantbook.io/) : pour chacune de vos plantes, les
**plages idéales** d'humidité du sol, de température, de lumière et d'humidité
de l'air de son espèce. Combinez-les avec vos propres capteurs (sonde
d'humidité du sol, capteur de température ou de luminosité) pour savoir quand
une plante a besoin d'eau, de lumière ou d'un endroit plus chaud.

Elle fonctionne dans le cloud : elle a besoin d'une connexion Internet et d'un
compte OpenPlantBook gratuit.

## Ce que vous obtenez

- **Un appareil par plante**, avec huit fonctionnalités en lecture seule : le
  minimum et le maximum d'humidité du sol (%), de température (°C ou °F), de
  lumière (lux) et d'humidité de l'air (%). Utilisables sur le tableau de bord
  et dans les conditions de scène.
- Des **déclencheurs de scène**, des **actions de scène** et des **widgets**,
  décrits plus bas (Gladys 5.1 ou plus récent).

## Obtenir vos identifiants OpenPlantBook

1. Créez un compte gratuit sur [open.plantbook.io](https://open.plantbook.io/).
2. Ouvrez la page [API keys](https://open.plantbook.io/apikey/show/) et générez
   une clé : vous obtenez un **client ID** et un **client secret**.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Collez le **client ID** et le **client secret**.
3. Cliquez sur **Tester la connexion** pour les vérifier.
4. Trouvez vos plantes avec le bouton **Rechercher une plante** : tapez un nom
   commun ou scientifique (`monstera`, `basilic`, `rose`...). La réponse liste
   les identifiants OpenPlantBook, comme `monstera deliciosa`.
5. Copiez les identifiants dans le champ **Plantes**, séparés par des virgules
   (30 plantes au maximum), par exemple
   `monstera deliciosa, ficus lyrata, ocimum basilicum`.
6. Choisissez la **langue des noms de plantes** (anglais, français, allemand ou
   espagnol), l'**unité de température** et, si vous le souhaitez,
   l'**intervalle de rafraîchissement** (24 heures par défaut : les seuils
   changent rarement).
7. Enregistrez, puis ajoutez les plantes depuis l'onglet **Découverte**.

Les seuils sont gardés dans un cache local : après un redémarrage, ou si
OpenPlantBook est injoignable, les appareils gardent leurs dernières valeurs.

> Astuce : ne placez pas un appareil plante dans une pièce. Il porte des
> _plages_ de température et d'humidité, pas des mesures.

## Actions

- **Tester la connexion** : vérifie les identifiants.
- **Rechercher une plante** : cherche dans la base OpenPlantBook et liste les
  identifiants à copier dans le champ **Plantes**.
- **Actualiser toutes les plantes** : relit toutes les plantes sans attendre
  l'intervalle de rafraîchissement.

## Scènes

L'intégration ajoute ses propres cartes à l'éditeur de scènes, dans la
catégorie **Intégrations**.

### Déclencheurs

- **Seuils d'une plante mis à jour** : les plages idéales d'une plante ont été
  lues pour la première fois ou ont changé dans OpenPlantBook. Choisissez
  éventuellement la plante. Les actions suivantes peuvent utiliser
  `{{triggerEvent.data.plant_name}}`, `{{triggerEvent.data.min_soil_moisture}}`,
  `{{triggerEvent.data.max_temperature}}` et les autres seuils.
- **Échec de synchro OpenPlantBook** : la lecture d'OpenPlantBook a commencé à
  échouer (identifiants refusés, quota atteint, identifiant de plante inconnu,
  service injoignable). Un événement par panne, pas un par tentative.
  Variables : `reason` et `error`.

### Actions

- **Vérifier les conditions d'une plante** : compare des mesures aux plages
  idéales d'une plante. Remplissez seulement les mesures dont vous disposez ;
  chaque champ accepte une valeur ou une variable de scène, par exemple le
  résultat d'une action précédente « Récupérer la dernière valeur d'un
  appareil ». La température est dans l'unité configurée. Elle renvoie :
  - `in_range` : vrai quand toutes les mesures sont dans leur plage idéale ;
  - `status` : `ok`, `too_dry` (trop sec), `too_wet` (trop humide),
    `too_cold` (trop froid), `too_hot` (trop chaud), `too_dark` (pas assez de
    lumière), `too_bright` (trop de lumière), `air_too_dry` (air trop sec),
    `air_too_humid` (air trop humide) ou `no_data` (aucune mesure) ;
  - `issues_count` : le nombre de mesures hors plage ;
  - `message` : une phrase prête à envoyer, par exemple « Monstera : sol trop
    sec (8 %, min 15 %). »
- **Lire les plages idéales d'une plante** : expose le nom, le nom
  scientifique, la catégorie et tous les seuils d'une plante aux actions
  suivantes.
- **Actualiser les données OpenPlantBook** : relit toutes les plantes
  maintenant.

### Exemple : notification « arrose-moi »

1. Déclencheur : tous les jours à 18 h.
2. Action : récupérer la dernière valeur de votre capteur d'humidité du sol.
3. Action **Vérifier les conditions d'une plante** : choisissez la plante,
   mettez la variable de l'étape précédente dans **Humidité du sol**.
4. Condition : `in_range` est faux.
5. Action : envoyer un message avec la sortie `message`.

## Tableau de bord

- **Fiche plante** : la photo et les quatre plages idéales de la plante choisie
  dans les réglages du widget, avec un bouton **Actualiser**.
- **Mes plantes** : toutes les plantes suivies avec leur photo ; touchez une
  plante pour voir ses plages. Un bouton **Tout actualiser** relit tout.

## Dépannage

- _« OpenPlantBook a refusé les identifiants »_ : générez une nouvelle clé sur
  la page API keys et recollez les deux valeurs.
- _Une plante reste sans données_ : vérifiez son identifiant avec
  **Rechercher une plante** ; c'est le nom scientifique en minuscules.
- _« Too many requests »_ : l'API gratuite est limitée. Réduisez le nombre de
  plantes ou augmentez l'intervalle de rafraîchissement.
- L'intégration journalise tout ce qu'elle fait : consultez ses logs depuis
  l'interface de Gladys, avec `LOG_LEVEL=debug` pour le détail complet. Les
  secrets ne sont jamais journalisés.

Les données et photos des plantes proviennent d'Open Plantbook
(https://open.plantbook.io/), un projet communautaire.
