# MyAnimeTierList

Une plateforme collaborative pour créer et partager des tier lists d'animés avec intégration MyAnimeList.

## 🚀 Fonctionnalités

- **Tier lists collaboratives** : Créez et partagez vos classements d'animés
- **Intégration MyAnimeList** : Importez automatiquement vos animés vus
- **Gestion intelligente des saisons** : Un anime = une entrée, peu importe le nombre de saisons
- **Interface drag & drop** : Classez facilement vos animés par glisser-déposer
- **Recherche d'animés** : Trouvez et ajoutez de nouveaux animés à vos listes

## 🛠️ Technologies

- **Next.js 15** avec App Router
- **JavaScript** (pas de TypeScript)
- **CSS Modules** (pas de Tailwind)
- **React 19** avec hooks
- **ESLint** pour le linting

## 📦 Installation

```bash
# Cloner le projet
git clone [url-du-repo]
cd MyAnimeTierList

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) pour voir l'application.

## 🎯 Comment ça marche

### Gestion des animes uniques

Le système regroupe automatiquement les différentes saisons d'un même anime :
- "Attack on Titan" + "Attack on Titan Season 2" = Une seule entrée
- Toutes les saisons sont listées dans les détails de l'anime
- Le classement s'applique à l'anime dans son ensemble

### Structure du projet

```
src/
├── app/                    # Pages Next.js (App Router)
│   ├── page.js            # Page d'accueil
│   ├── demo/              # Page de démonstration
│   └── layout.js          # Layout principal
├── components/            # Composants React
│   ├── AnimeData.js       # Logique de gestion des animes
│   ├── AnimeCard.js       # Carte d'affichage d'un anime
│   ├── TierList.js        # Composant principal de tier list
│   └── AnimeSearch.js     # Composant de recherche
└── app/globals.css        # Styles globaux
```

## 🔧 Scripts disponibles

```bash
npm run dev      # Serveur de développement
npm run build    # Build de production
npm run start    # Serveur de production
npm run lint     # Linting ESLint
```

## 🎮 Démonstration

Visitez `/demo` pour voir une démonstration avec des animes d'exemple et tester les fonctionnalités.

## 🚧 Fonctionnalités à venir

- [ ] Vraie intégration avec l'API MyAnimeList
- [ ] Système d'authentification utilisateur
- [ ] Partage et collaboration en temps réel
- [ ] Export des tier lists en image
- [ ] Système de votes et commentaires

## 📝 Licence

Ce projet est sous licence MIT.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
