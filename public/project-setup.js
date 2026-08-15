/* ═══════════════════════════════════════════════════════════════
   STORM — DÉMO DE MISE EN ROUTE · CUPERTINO PASS
   Démo de présentation uniquement.
   Aucun /api/*, aucune persistance, aucun upload serveur.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const ROOT_ID='stormShowcaseRoot';
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let root=null,abortController=null,focusBeforeOpen=null,logoObjectUrl=null,tourIndex=0,tourOrder=[],sceneName='intro';

  const LANGS=[
    {code:'fr',label:'Français'},{code:'en',label:'English'},{code:'it',label:'Italiano'},
    {code:'es',label:'Español'},{code:'nl',label:'Nederlands'},{code:'de',label:'Deutsch'}
  ];
  const THEME_KEYS=['ivory','rainbow','midnight'];

  function freshState(){
    return {
      uiLang:'fr',contentLang:'fr',projectName:'',logoUrl:'',logoFile:null,logoUploaded:false,
      createdProjectId:null,
      primaryColor:'#1E1D1E',secondaryColor:'#C2AF7E',
      fonts:[{name:'Roboto',family:'Roboto'},{name:'Italiana',family:'Italiana'}],
      theme:'ivory',
      modules:{
        faq:true,
        actu:true,
        jalons:true,
        plans:true,
        ambassadeurs:false,
        equipe:false
      },
      invites:[],
      created:new Set()
    };
  }
  let state=freshState();

  const ICONS={
    faq:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    actu:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    plans:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5-4 4-3-3-5 5"/>',
    people:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    close:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    check:'<polyline points="20 6 9 17 4 12"/>',
    upload:'<path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'
  };
  function icon(name){return `<svg class="storm-icon" viewBox="0 0 24 24">${ICONS[name]}</svg>`;}

  const UI = {
    fr: {
      skip:'Passer', back:'Retour', continue:'Continuer',
      interfaceTitle:'Dans quelle langue souhaitez-vous utiliser Storm pour ce projet ?',
      interfaceSub:'Cette langue concerne uniquement le travail sur ce projet — jamais votre préférence personnelle Storm.',
      contentTitle:'Dans quelle langue sera votre site ?',
      contentSub:'Les collaborateurs verront le contenu du projet dans cette langue.',
      welcomeTitle:'Bienvenue dans Storm.', welcomeBreath:'Créons votre espace projet.',
      nameTitle:'Comment s’appelle votre projet ?', nameSub:'Ce nom apparaîtra dans Storm et pourra être modifié plus tard.', namePlaceholder:'Projet Quatro',
      logoTitle:'Ajoutez votre logo.', logoSub:'Storm l’utilisera comme repère de marque sur le site public.', logoChoose:'Choisir un logo', logoEmpty:'PNG, JPG ou SVG · démo locale uniquement',
      colorsTitle:'Vos couleurs.', colorsSub:'Une couleur principale suffit. La seconde permet à Storm d’enrichir la traduction de votre identité.', primary:'Couleur principale', secondary:'Couleur secondaire',
      fontsTitle:'Vos typographies.', fontsSub:'Une police principale est nécessaire. Une seconde peut être utilisée pour les moments éditoriaux.', fontPrimary:'Police principale', fontSecondary:'Police secondaire', replace:'Remplacer', remove:'Retirer', addSecondFont:'Ajouter une seconde police',
      themeTitle:'Quelle atmosphère souhaitez-vous donner à votre espace ?', themeSub:'Le contenu reste identique. Seule sa mise en scène change.',
      themeName:{ivory:'Ivory',rainbow:'Rainbow Glass',midnight:'Midnight Frost'}, themeDesc:{ivory:'Clair & essentiel',rainbow:'Lumineux & expressif',midnight:'Immersif & premium'},
      modulesTitle:'Que souhaitez-vous montrer ?', modulesSub:'Activez uniquement les rubriques utiles à ce projet. Vous pourrez les modifier plus tard.',
      moduleName:{faq:'FAQ',actu:'Actualités',jalons:'Étapes du projet',plans:'Plans & 3D',ambassadeurs:'Ambassadeurs',equipe:'Équipe projet'},
      moduleDesc:{faq:'Répondre aux questions des collaborateurs.',actu:'Partager les dernières informations du projet.',jalons:'Montrer les principaux jalons et prochaines étapes.',plans:'Faire découvrir les futurs espaces.',ambassadeurs:'Présenter le réseau d’ambassadeurs.',equipe:'Identifier les personnes qui portent le projet.'},
      modulesHint:'La navigation du site s’ajuste immédiatement.',
      accessTitle:'Qui peut contribuer ?', accessSub:'Vous êtes administrateur. Vous pourrez aussi donner des accès à d’autres personnes, avec un niveau adapté à leur rôle.', accessAdmin:'Administrateur', accessAdminDesc:'Tout gérer : identité, accès, contenus et publication.', accessEditor:'Éditeur', accessEditorDesc:'Créer, modifier et publier les contenus.', accessContributor:'Contributeur', accessContributorDesc:'Créer et modifier des contenus, sans pouvoir publier.', accessPilot:'Pilote', accessPilotDesc:'Consulter le pilotage du projet, sans modifier les contenus.', inviteTitle:'Donner un accès', inviteEmail:'Adresse e-mail', inviteRole:'Niveau d’accès', inviteAdd:'Ajouter', inviteLater:'Plus tard', inviteAdded:'Accès préparé',
      revealTitle:'Votre identité prend place.', revealSub:'Storm applique vos codes à l’édition choisie sans vous demander de faire de la direction artistique.', revealContinue:'Découvrir les rubriques',
      setupProgress:(n,total)=>`Étape ${n} sur ${total}`,
      sectionProgress:(n,total)=>`Rubrique ${n} sur ${total}`,
      sectionVisible:'Afficher sur le site', sectionHidden:'Masquée du site', sectionHiddenDesc:'Cette rubrique ne sera pas affichée. Vous pourrez la réactiver plus tard.',
      createNow:'Créer maintenant', later:'Plus tard', saveAndContinue:'Ajouter et continuer', added:'Ajouté', previewLabel:'Aperçu dans votre édition',
      buildTitle:'Votre site est en train de se créer.', buildSteps:['Nous assemblons votre identité.','Nous préparons vos rubriques.','Votre site prend forme.'], ready:'Prêt.',
      buildOpenStorm:'Ouvrir Storm', buildCreateError:'La création de votre projet a échoué. Vos informations sont conservées.', buildLogoError:'Votre projet a été créé, mais le logo n’a pas pu être envoyé.', buildRetry:'Réessayer'
    },
    en: {
      skip:'Skip', back:'Back', continue:'Continue',
      interfaceTitle:'Which language would you like to use Storm in for this project?', interfaceSub:'This language only applies to work on this project — never your personal Storm preference.',
      contentTitle:'Which language will your site use?', contentSub:'Employees will see the project content in this language.',
      welcomeTitle:'Welcome to Storm.', welcomeBreath:'Let’s create your project space.',
      nameTitle:'What is your project called?', nameSub:'This name will appear in Storm and can be changed later.', namePlaceholder:'Project Quatro',
      logoTitle:'Add your logo.', logoSub:'Storm will use it as a brand marker on the public site.', logoChoose:'Choose a logo', logoEmpty:'PNG, JPG or SVG · local demo only',
      colorsTitle:'Your colours.', colorsSub:'One primary colour is enough. A second helps Storm enrich the translation of your identity.', primary:'Primary colour', secondary:'Secondary colour',
      fontsTitle:'Your typefaces.', fontsSub:'One primary typeface is required. A second can be used for editorial moments.', fontPrimary:'Primary typeface', fontSecondary:'Secondary typeface', replace:'Replace', remove:'Remove', addSecondFont:'Add a second typeface',
      themeTitle:'What atmosphere would you like for your space?', themeSub:'The content stays the same. Only its presentation changes.',
      themeName:{ivory:'Ivory',rainbow:'Rainbow Glass',midnight:'Midnight Frost'}, themeDesc:{ivory:'Clear & essential',rainbow:'Luminous & expressive',midnight:'Immersive & premium'},
      modulesTitle:'What would you like to show?', modulesSub:'Enable only the sections that are useful for this project. You can change them later.',
      moduleName:{faq:'FAQ',actu:'Updates',jalons:'Project stages',plans:'Plans & 3D',ambassadeurs:'Ambassadors',equipe:'Project team'},
      moduleDesc:{faq:'Answer employees’ questions.',actu:'Share the latest project information.',jalons:'Show the main milestones and next steps.',plans:'Help people discover the future spaces.',ambassadeurs:'Present the ambassador network.',equipe:'Identify the people leading the project.'},
      modulesHint:'The site navigation updates immediately.',
      accessTitle:'Who can contribute?', accessSub:'You are the administrator. You can also give other people access with a level that matches their role.', accessAdmin:'Administrator', accessAdminDesc:'Manage everything: identity, access, content and publishing.', accessEditor:'Editor', accessEditorDesc:'Create, edit and publish content.', accessContributor:'Contributor', accessContributorDesc:'Create and edit content without publishing.', accessPilot:'Pilot', accessPilotDesc:'View project insights, without editing content.', inviteTitle:'Give access', inviteEmail:'Email address', inviteRole:'Access level', inviteAdd:'Add', inviteLater:'Later', inviteAdded:'Access prepared',
      revealTitle:'Your identity takes shape.', revealSub:'Storm applies your brand codes to the chosen edition without asking you to art-direct it.', revealContinue:'Discover the sections',
      setupProgress:(n,total)=>`Step ${n} of ${total}`,
      sectionProgress:(n,total)=>`Section ${n} of ${total}`,
      sectionVisible:'Show on the site', sectionHidden:'Hidden from the site', sectionHiddenDesc:'This section will not be shown. You can enable it again later.',
      createNow:'Create now', later:'Later', saveAndContinue:'Add and continue', added:'Added', previewLabel:'Preview in your edition',
      buildTitle:'Your site is being created.', buildSteps:['We are assembling your identity.','We are preparing your sections.','Your site is taking shape.'], ready:'Ready.',
      buildOpenStorm:'Open Storm', buildCreateError:'Creating your project failed. Your information has been kept.', buildLogoError:'Your project was created, but the logo could not be uploaded.', buildRetry:'Retry'
    },
    it: {
      skip:'Salta', back:'Indietro', continue:'Continua',
      interfaceTitle:'In quale lingua vuoi usare Storm per questo progetto?', interfaceSub:'Questa lingua riguarda solo il lavoro su questo progetto — mai la tua preferenza personale Storm.',
      contentTitle:'In quale lingua sarà il tuo sito?', contentSub:'I collaboratori vedranno i contenuti del progetto in questa lingua.',
      welcomeTitle:'Benvenuto in Storm.', welcomeBreath:'Creiamo il tuo spazio progetto.',
      nameTitle:'Come si chiama il tuo progetto?', nameSub:'Questo nome apparirà in Storm e potrà essere modificato in seguito.', namePlaceholder:'Progetto Quatro',
      logoTitle:'Aggiungi il tuo logo.', logoSub:'Storm lo userà come riferimento di marca sul sito pubblico.', logoChoose:'Scegli un logo', logoEmpty:'PNG, JPG o SVG · solo demo locale',
      colorsTitle:'I tuoi colori.', colorsSub:'Un colore principale è sufficiente. Il secondo aiuta Storm ad arricchire la traduzione della tua identità.', primary:'Colore principale', secondary:'Colore secondario',
      fontsTitle:'I tuoi font.', fontsSub:'È necessario un font principale. Un secondo può essere usato per i momenti editoriali.', fontPrimary:'Font principale', fontSecondary:'Font secondario', replace:'Sostituisci', remove:'Rimuovi', addSecondFont:'Aggiungi un secondo font',
      themeTitle:'Quale atmosfera vuoi dare al tuo spazio?', themeSub:'I contenuti restano identici. Cambia solo la loro messa in scena.',
      themeName:{ivory:'Ivory',rainbow:'Rainbow Glass',midnight:'Midnight Frost'}, themeDesc:{ivory:'Chiaro & essenziale',rainbow:'Luminoso & espressivo',midnight:'Immersivo & premium'},
      modulesTitle:'Cosa vuoi mostrare?', modulesSub:'Attiva solo le sezioni utili per questo progetto. Potrai modificarle in seguito.',
      moduleName:{faq:'FAQ',actu:'Novità',jalons:'Fasi del progetto',plans:'Planimetrie & 3D',ambassadeurs:'Ambasciatori',equipe:'Team di progetto'},
      moduleDesc:{faq:'Rispondere alle domande dei collaboratori.',actu:'Condividere le ultime informazioni sul progetto.',jalons:'Mostrare le tappe principali e i prossimi passi.',plans:'Far scoprire i futuri spazi.',ambassadeurs:'Presentare la rete degli ambasciatori.',equipe:'Identificare le persone che guidano il progetto.'},
      modulesHint:'La navigazione del sito si aggiorna immediatamente.',
      accessTitle:'Chi può contribuire?', accessSub:'Sei amministratore. Puoi anche dare accesso ad altre persone con un livello adatto al loro ruolo.', accessAdmin:'Amministratore', accessAdminDesc:'Gestire tutto: identità, accessi, contenuti e pubblicazione.', accessEditor:'Editor', accessEditorDesc:'Creare, modificare e pubblicare contenuti.', accessContributor:'Contributore', accessContributorDesc:'Creare e modificare contenuti senza pubblicare.', accessPilot:'Pilota', accessPilotDesc:'Consultare il pilotaggio del progetto, senza modificare i contenuti.', inviteTitle:'Dare accesso', inviteEmail:'Indirizzo e-mail', inviteRole:'Livello di accesso', inviteAdd:'Aggiungi', inviteLater:'Più tardi', inviteAdded:'Accesso preparato',
      revealTitle:'La tua identità prende forma.', revealSub:'Storm applica i tuoi codici di marca all’edizione scelta senza chiederti di fare direzione artistica.', revealContinue:'Scopri le sezioni',
      setupProgress:(n,total)=>`Passaggio ${n} di ${total}`,
      sectionProgress:(n,total)=>`Sezione ${n} di ${total}`,
      sectionVisible:'Mostra sul sito', sectionHidden:'Nascosta dal sito', sectionHiddenDesc:'Questa sezione non verrà mostrata. Potrai riattivarla in seguito.',
      createNow:'Crea ora', later:'Più tardi', saveAndContinue:'Aggiungi e continua', added:'Aggiunto', previewLabel:'Anteprima nella tua edizione',
      buildTitle:'Il tuo sito è in fase di creazione.', buildSteps:['Stiamo componendo la tua identità.','Stiamo preparando le tue sezioni.','Il tuo sito prende forma.'], ready:'Pronto.',
      buildOpenStorm:'Apri Storm', buildCreateError:'La creazione del progetto non è riuscita. Le tue informazioni sono state conservate.', buildLogoError:'Il progetto è stato creato, ma non è stato possibile caricare il logo.', buildRetry:'Riprova'
    },
    es: {
      skip:'Omitir', back:'Volver', continue:'Continuar',
      interfaceTitle:'¿En qué idioma quieres usar Storm para este proyecto?', interfaceSub:'Este idioma solo se aplica al trabajo en este proyecto — nunca a tu preferencia personal de Storm.',
      contentTitle:'¿En qué idioma estará tu sitio?', contentSub:'Los colaboradores verán el contenido del proyecto en este idioma.',
      welcomeTitle:'Bienvenido a Storm.', welcomeBreath:'Creemos tu espacio de proyecto.',
      nameTitle:'¿Cómo se llama tu proyecto?', nameSub:'Este nombre aparecerá en Storm y podrás modificarlo más adelante.', namePlaceholder:'Proyecto Quatro',
      logoTitle:'Añade tu logotipo.', logoSub:'Storm lo utilizará como referencia de marca en el sitio público.', logoChoose:'Elegir un logotipo', logoEmpty:'PNG, JPG o SVG · solo demo local',
      colorsTitle:'Tus colores.', colorsSub:'Un color principal es suficiente. El segundo ayuda a Storm a enriquecer la traducción de tu identidad.', primary:'Color principal', secondary:'Color secundario',
      fontsTitle:'Tus tipografías.', fontsSub:'Se necesita una tipografía principal. Una segunda puede utilizarse para momentos editoriales.', fontPrimary:'Tipografía principal', fontSecondary:'Tipografía secundaria', replace:'Sustituir', remove:'Quitar', addSecondFont:'Añadir una segunda tipografía',
      themeTitle:'¿Qué atmósfera quieres dar a tu espacio?', themeSub:'El contenido sigue siendo el mismo. Solo cambia su puesta en escena.',
      themeName:{ivory:'Ivory',rainbow:'Rainbow Glass',midnight:'Midnight Frost'}, themeDesc:{ivory:'Claro & esencial',rainbow:'Luminoso & expresivo',midnight:'Inmersivo & premium'},
      modulesTitle:'¿Qué quieres mostrar?', modulesSub:'Activa solo las secciones útiles para este proyecto. Podrás modificarlas más adelante.',
      moduleName:{faq:'FAQ',actu:'Novedades',jalons:'Etapas del proyecto',plans:'Planos & 3D',ambassadeurs:'Embajadores',equipe:'Equipo de proyecto'},
      moduleDesc:{faq:'Responder a las preguntas de los colaboradores.',actu:'Compartir las últimas noticias del proyecto.',jalons:'Mostrar los principales hitos y próximos pasos.',plans:'Dar a conocer los futuros espacios.',ambassadeurs:'Presentar la red de embajadores.',equipe:'Identificar a las personas que lideran el proyecto.'},
      modulesHint:'La navegación del sitio se actualiza al instante.',
      accessTitle:'¿Quién puede contribuir?', accessSub:'Eres administrador. También podrás dar acceso a otras personas con un nivel adaptado a su función.', accessAdmin:'Administrador', accessAdminDesc:'Gestionarlo todo: identidad, accesos, contenidos y publicación.', accessEditor:'Editor', accessEditorDesc:'Crear, modificar y publicar contenidos.', accessContributor:'Colaborador', accessContributorDesc:'Crear y modificar contenidos sin publicar.', accessPilot:'Piloto', accessPilotDesc:'Consultar el pilotaje del proyecto, sin modificar los contenidos.', inviteTitle:'Dar acceso', inviteEmail:'Correo electrónico', inviteRole:'Nivel de acceso', inviteAdd:'Añadir', inviteLater:'Más tarde', inviteAdded:'Acceso preparado',
      revealTitle:'Tu identidad toma forma.', revealSub:'Storm aplica tus códigos de marca a la edición elegida sin pedirte que hagas dirección artística.', revealContinue:'Descubrir las secciones',
      setupProgress:(n,total)=>`Paso ${n} de ${total}`,
      sectionProgress:(n,total)=>`Sección ${n} de ${total}`,
      sectionVisible:'Mostrar en el sitio', sectionHidden:'Oculta del sitio', sectionHiddenDesc:'Esta sección no se mostrará. Podrás volver a activarla más adelante.',
      createNow:'Crear ahora', later:'Más tarde', saveAndContinue:'Añadir y continuar', added:'Añadido', previewLabel:'Vista previa en tu edición',
      buildTitle:'Tu sitio se está creando.', buildSteps:['Estamos componiendo tu identidad.','Estamos preparando tus secciones.','Tu sitio está tomando forma.'], ready:'Listo.',
      buildOpenStorm:'Abrir Storm', buildCreateError:'No se pudo crear tu proyecto. Tu información se ha conservado.', buildLogoError:'Tu proyecto fue creado, pero no se pudo subir el logo.', buildRetry:'Reintentar'
    },
    nl: {
      skip:'Overslaan', back:'Terug', continue:'Doorgaan',
      interfaceTitle:'In welke taal wil je Storm gebruiken voor dit project?', interfaceSub:'Deze taal geldt alleen voor het werk aan dit project — nooit voor je persoonlijke Storm-voorkeur.',
      contentTitle:'In welke taal wordt je site weergegeven?', contentSub:'Medewerkers zien de projectinhoud in deze taal.',
      welcomeTitle:'Welkom bij Storm.', welcomeBreath:'Laten we je projectruimte maken.',
      nameTitle:'Hoe heet je project?', nameSub:'Deze naam verschijnt in Storm en kan later worden aangepast.', namePlaceholder:'Project Quatro',
      logoTitle:'Voeg je logo toe.', logoSub:'Storm gebruikt het als herkenningspunt van je merk op de publieke site.', logoChoose:'Kies een logo', logoEmpty:'PNG, JPG of SVG · alleen lokale demo',
      colorsTitle:'Je kleuren.', colorsSub:'Eén hoofdkleur is voldoende. Een tweede kleur helpt Storm je identiteit rijker te vertalen.', primary:'Hoofdkleur', secondary:'Secundaire kleur',
      fontsTitle:'Je lettertypes.', fontsSub:'Eén hoofdlettertype is nodig. Een tweede kan worden gebruikt voor redactionele momenten.', fontPrimary:'Hoofdlettertype', fontSecondary:'Secundair lettertype', replace:'Vervangen', remove:'Verwijderen', addSecondFont:'Een tweede lettertype toevoegen',
      themeTitle:'Welke sfeer wil je je projectruimte geven?', themeSub:'De inhoud blijft hetzelfde. Alleen de presentatie verandert.',
      themeName:{ivory:'Ivory',rainbow:'Rainbow Glass',midnight:'Midnight Frost'}, themeDesc:{ivory:'Helder & essentieel',rainbow:'Licht & expressief',midnight:'Meeslepend & premium'},
      modulesTitle:'Wat wil je laten zien?', modulesSub:'Activeer alleen de onderdelen die nuttig zijn voor dit project. Je kunt ze later wijzigen.',
      moduleName:{faq:'FAQ',actu:'Nieuws',jalons:'Projectstappen',plans:'Plattegronden & 3D',ambassadeurs:'Ambassadeurs',equipe:'Projectteam'},
      moduleDesc:{faq:'Vragen van medewerkers beantwoorden.',actu:'De laatste projectinformatie delen.',jalons:'De belangrijkste mijlpalen en volgende stappen tonen.',plans:'De toekomstige ruimtes laten ontdekken.',ambassadeurs:'Het ambassadeursnetwerk voorstellen.',equipe:'De mensen achter het project tonen.'},
      modulesHint:'De navigatie van de site past zich direct aan.',
      accessTitle:'Wie kan bijdragen?', accessSub:'Jij bent beheerder. Je kunt ook anderen toegang geven met een niveau dat bij hun rol past.', accessAdmin:'Beheerder', accessAdminDesc:'Alles beheren: identiteit, toegang, content en publicatie.', accessEditor:'Editor', accessEditorDesc:'Content maken, bewerken en publiceren.', accessContributor:'Bijdrager', accessContributorDesc:'Content maken en bewerken zonder te publiceren.', accessPilot:'Piloot', accessPilotDesc:'Het projectoverzicht raadplegen, zonder content te wijzigen.', inviteTitle:'Toegang geven', inviteEmail:'E-mailadres', inviteRole:'Toegangsniveau', inviteAdd:'Toevoegen', inviteLater:'Later', inviteAdded:'Toegang voorbereid',
      revealTitle:'Je identiteit krijgt vorm.', revealSub:'Storm vertaalt je merkcodes naar de gekozen editie zonder dat je zelf artdirection hoeft te doen.', revealContinue:'Ontdek de onderdelen',
      setupProgress:(n,total)=>`Stap ${n} van ${total}`,
      sectionProgress:(n,total)=>`Onderdeel ${n} van ${total}`,
      sectionVisible:'Tonen op de site', sectionHidden:'Verborgen op de site', sectionHiddenDesc:'Dit onderdeel wordt niet getoond. Je kunt het later opnieuw activeren.',
      createNow:'Nu maken', later:'Later', saveAndContinue:'Toevoegen en doorgaan', added:'Toegevoegd', previewLabel:'Voorbeeld in jouw editie',
      buildTitle:'Je site wordt aangemaakt.', buildSteps:['We brengen je identiteit samen.','We bereiden je onderdelen voor.','Je site krijgt vorm.'], ready:'Klaar.',
      buildOpenStorm:'Storm openen', buildCreateError:'Het aanmaken van je project is mislukt. Je gegevens zijn bewaard.', buildLogoError:'Je project is aangemaakt, maar het logo kon niet worden geüpload.', buildRetry:'Opnieuw proberen'
    },
    de: {
      skip:'Überspringen', back:'Zurück', continue:'Weiter',
      interfaceTitle:'In welcher Sprache möchten Sie Storm für dieses Projekt verwenden?', interfaceSub:'Diese Sprache gilt nur für die Arbeit an diesem Projekt — nie für Ihre persönliche Storm-Präferenz.',
      contentTitle:'In welcher Sprache soll Ihre Website angezeigt werden?', contentSub:'Die Mitarbeitenden sehen die Projektinhalte in dieser Sprache.',
      welcomeTitle:'Willkommen bei Storm.', welcomeBreath:'Erstellen wir Ihren Projektbereich.',
      nameTitle:'Wie heißt Ihr Projekt?', nameSub:'Dieser Name wird in Storm angezeigt und kann später geändert werden.', namePlaceholder:'Projekt Quatro',
      logoTitle:'Fügen Sie Ihr Logo hinzu.', logoSub:'Storm verwendet es als Markenzeichen auf der öffentlichen Website.', logoChoose:'Logo auswählen', logoEmpty:'PNG, JPG oder SVG · nur lokale Demo',
      colorsTitle:'Ihre Farben.', colorsSub:'Eine Primärfarbe genügt. Eine zweite Farbe hilft Storm, Ihre Identität differenzierter zu übersetzen.', primary:'Primärfarbe', secondary:'Sekundärfarbe',
      fontsTitle:'Ihre Schriften.', fontsSub:'Eine Hauptschrift ist erforderlich. Eine zweite kann für redaktionelle Momente verwendet werden.', fontPrimary:'Hauptschrift', fontSecondary:'Sekundärschrift', replace:'Ersetzen', remove:'Entfernen', addSecondFont:'Zweite Schrift hinzufügen',
      themeTitle:'Welche Atmosphäre soll Ihr Bereich vermitteln?', themeSub:'Die Inhalte bleiben identisch. Nur ihre Inszenierung verändert sich.',
      themeName:{ivory:'Ivory',rainbow:'Rainbow Glass',midnight:'Midnight Frost'}, themeDesc:{ivory:'Hell & essenziell',rainbow:'Leuchtend & expressiv',midnight:'Immersiv & premium'},
      modulesTitle:'Was möchten Sie zeigen?', modulesSub:'Aktivieren Sie nur die Bereiche, die für dieses Projekt sinnvoll sind. Sie können sie später ändern.',
      moduleName:{faq:'FAQ',actu:'Neuigkeiten',jalons:'Projektphasen',plans:'Pläne & 3D',ambassadeurs:'Botschafter',equipe:'Projektteam'},
      moduleDesc:{faq:'Fragen der Mitarbeitenden beantworten.',actu:'Aktuelle Projektinformationen teilen.',jalons:'Wichtige Meilensteine und nächste Schritte zeigen.',plans:'Die zukünftigen Räume erlebbar machen.',ambassadeurs:'Das Botschafternetzwerk vorstellen.',equipe:'Die Personen hinter dem Projekt zeigen.'},
      modulesHint:'Die Navigation der Website passt sich sofort an.',
      accessTitle:'Wer kann mitarbeiten?', accessSub:'Sie sind Administrator. Sie können auch anderen Personen Zugriff mit einer passenden Berechtigungsstufe geben.', accessAdmin:'Administrator', accessAdminDesc:'Alles verwalten: Identität, Zugriffe, Inhalte und Veröffentlichung.', accessEditor:'Editor', accessEditorDesc:'Inhalte erstellen, bearbeiten und veröffentlichen.', accessContributor:'Mitwirkender', accessContributorDesc:'Inhalte erstellen und bearbeiten, ohne zu veröffentlichen.', accessPilot:'Pilot', accessPilotDesc:'Projekt-Steuerung einsehen, ohne Inhalte zu bearbeiten.', inviteTitle:'Zugriff geben', inviteEmail:'E-Mail-Adresse', inviteRole:'Zugriffsstufe', inviteAdd:'Hinzufügen', inviteLater:'Später', inviteAdded:'Zugriff vorbereitet',
      revealTitle:'Ihre Identität nimmt Gestalt an.', revealSub:'Storm überträgt Ihre Markencodes auf die gewählte Edition, ohne dass Sie selbst Art Direction betreiben müssen.', revealContinue:'Bereiche entdecken',
      setupProgress:(n,total)=>`Schritt ${n} von ${total}`,
      sectionProgress:(n,total)=>`Bereich ${n} von ${total}`,
      sectionVisible:'Auf der Website zeigen', sectionHidden:'Auf der Website ausgeblendet', sectionHiddenDesc:'Dieser Bereich wird nicht angezeigt. Sie können ihn später wieder aktivieren.',
      createNow:'Jetzt erstellen', later:'Später', saveAndContinue:'Hinzufügen und weiter', added:'Hinzugefügt', previewLabel:'Vorschau in Ihrer Edition',
      buildTitle:'Ihre Website wird erstellt.', buildSteps:['Wir fügen Ihre Identität zusammen.','Wir bereiten Ihre Bereiche vor.','Ihre Website nimmt Gestalt an.'], ready:'Bereit.',
      buildOpenStorm:'Storm öffnen', buildCreateError:'Ihr Projekt konnte nicht erstellt werden. Ihre Angaben wurden gespeichert.', buildLogoError:'Ihr Projekt wurde erstellt, das Logo konnte jedoch nicht hochgeladen werden.', buildRetry:'Erneut versuchen'
    }
  };

  const SITE_COPY = {
    fr:{title:'Votre futur environnement',accent:'de travail.',desc:'Un espace simple pour suivre le projet et retrouver les informations utiles.',search:'Rechercher',nav:['FAQ','Actualités','Plans & 3D']},
    en:{title:'Your future',accent:'work environment.',desc:'A simple space to follow the project and find the information you need.',search:'Search',nav:['FAQ','Updates','Plans & 3D']},
    it:{title:'Il tuo futuro',accent:'ambiente di lavoro.',desc:'Uno spazio semplice per seguire il progetto e ritrovare le informazioni utili.',search:'Cerca',nav:['FAQ','Novità','Planimetrie & 3D']},
    es:{title:'Tu futuro',accent:'entorno de trabajo.',desc:'Un espacio sencillo para seguir el proyecto y encontrar la información útil.',search:'Buscar',nav:['FAQ','Novedades','Planos & 3D']},
    nl:{title:'Je toekomstige',accent:'werkomgeving.',desc:'Een eenvoudige plek om het project te volgen en nuttige informatie terug te vinden.',search:'Zoeken',nav:['FAQ','Nieuws','Plattegronden & 3D']},
    de:{title:'Ihre zukünftige',accent:'Arbeitsumgebung.',desc:'Ein einfacher Bereich, um das Projekt zu verfolgen und wichtige Informationen zu finden.',search:'Suchen',nav:['FAQ','Neuigkeiten','Pläne & 3D']}
  };

  const SECTIONS = {
    fr: {
      faq: { icon: 'faq', title: 'Une réponse, toujours', desc: "La base de connaissance interrogeable par vos collaborateurs, à tout moment.", create: 'Ajouter ma première question', field1: 'Question', field2: 'Réponse' },
      actu: { icon: 'actu', title: 'Le fil du projet', desc: 'Le calendrier et les actualités qui remplacent les emails de suivi.', create: 'Publier ma première actualité', field1: 'Titre', field2: 'Chapeau' },
      jalons: { icon: 'actu', title: 'Donner le rythme', desc: 'Les grandes étapes qui permettent à chacun de comprendre où en est le projet.', create: 'Ajouter ma première étape', field1: 'Étape', field2: 'Date ou détail' },
      plans: { icon: 'plans', title: 'Montrer, pas seulement dire', desc: 'Plans, vues 3D et documents visuels pour aider à se projeter.', create: 'Ajouter mon premier visuel', field1: 'Titre', field2: 'Commentaire' },
      ambassadeurs: { icon: 'people', title: 'Des relais de confiance', desc: 'Les collègues qui font le lien entre les équipes et le projet.', create: 'Ajouter mon premier ambassadeur', field1: 'Nom', field2: 'Rôle' },
      equipe: { icon: 'people', title: 'Qui pilote le projet', desc: "L'organisation, côté client et côté cabinet conseil.", create: 'Ajouter un membre', field1: 'Nom', field2: 'Fonction' }
    },
    en: {
      faq: { icon: 'faq', title: 'An answer, always', desc: 'The knowledge base your team can search anytime.', create: 'Add my first question', field1: 'Question', field2: 'Answer' },
      actu: { icon: 'actu', title: "The project's thread", desc: 'The calendar and news feed that replace status emails.', create: 'Publish my first update', field1: 'Title', field2: 'Summary' },
      jalons: { icon: 'actu', title: 'Set the pace', desc: 'The key milestones that help everyone understand where the project stands.', create: 'Add my first milestone', field1: 'Milestone', field2: 'Date or detail' },
      plans: { icon: 'plans', title: 'Show, not just tell', desc: 'Plans, 3D views and visuals to help people picture it.', create: 'Add my first visual', field1: 'Title', field2: 'Comment' },
      ambassadeurs: { icon: 'people', title: 'Trusted go-betweens', desc: 'Colleagues who connect teams with the project.', create: 'Add my first ambassador', field1: 'Name', field2: 'Role' },
      equipe: { icon: 'people', title: "Who's steering the project", desc: 'The organisation, on the client and consultancy side.', create: 'Add a member', field1: 'Name', field2: 'Title' }
    },
    it: {
      faq: { icon: 'faq', title: 'Una risposta, sempre', desc: 'La base di conoscenza consultabile dal team in ogni momento.', create: 'Aggiungi la mia prima domanda', field1: 'Domanda', field2: 'Risposta' },
      actu: { icon: 'actu', title: 'Il filo del progetto', desc: 'Il calendario e le notizie che sostituiscono le email di aggiornamento.', create: 'Pubblica la mia prima novità', field1: 'Titolo', field2: 'Sommario' },
      jalons: { icon: 'actu', title: 'Dare il ritmo', desc: 'Le tappe principali che aiutano tutti a capire a che punto è il progetto.', create: 'Aggiungi la prima tappa', field1: 'Tappa', field2: 'Data o dettaglio' },
      plans: { icon: 'plans', title: 'Mostrare, non solo dire', desc: 'Planimetrie, viste 3D e visual per aiutare a immaginare.', create: 'Aggiungi il mio primo visual', field1: 'Titolo', field2: 'Commento' },
      ambassadeurs: { icon: 'people', title: 'Punti di riferimento fidati', desc: 'I colleghi che collegano i team al progetto.', create: 'Aggiungi il mio primo ambasciatore', field1: 'Nome', field2: 'Ruolo' },
      equipe: { icon: 'people', title: 'Chi guida il progetto', desc: "L'organizzazione, lato cliente e lato consulenza.", create: 'Aggiungi un membro', field1: 'Nome', field2: 'Funzione' }
    },
    es: {
      faq: { icon: 'faq', title: 'Una respuesta, siempre', desc: 'La base de conocimiento que tu equipo puede consultar en cualquier momento.', create: 'Añadir mi primera pregunta', field1: 'Pregunta', field2: 'Respuesta' },
      actu: { icon: 'actu', title: 'El hilo del proyecto', desc: 'El calendario y las noticias que sustituyen a los correos de seguimiento.', create: 'Publicar mi primera novedad', field1: 'Título', field2: 'Resumen' },
      jalons: { icon: 'actu', title: 'Marcar el ritmo', desc: 'Los grandes hitos que ayudan a todos a entender en qué punto está el proyecto.', create: 'Añadir mi primer hito', field1: 'Hito', field2: 'Fecha o detalle' },
      plans: { icon: 'plans', title: 'Mostrar, no solo contar', desc: 'Planos, vistas 3D y visuales para ayudar a imaginarlo.', create: 'Añadir mi primer visual', field1: 'Título', field2: 'Comentario' },
      ambassadeurs: { icon: 'people', title: 'Enlaces de confianza', desc: 'Los compañeros que conectan a los equipos con el proyecto.', create: 'Añadir mi primer embajador', field1: 'Nombre', field2: 'Rol' },
      equipe: { icon: 'people', title: 'Quién dirige el proyecto', desc: 'La organización, del lado del cliente y de la consultora.', create: 'Añadir un miembro', field1: 'Nombre', field2: 'Cargo' }
    },
    nl: {
      faq: { icon: 'faq', title: 'Altijd een antwoord', desc: 'De kennisbank die je collega\'s op elk moment kunnen raadplegen.', create: 'Mijn eerste vraag toevoegen', field1: 'Vraag', field2: 'Antwoord' },
      actu: { icon: 'actu', title: 'De rode draad van het project', desc: 'De planning en het nieuws die statusmails vervangen.', create: 'Mijn eerste nieuwsbericht plaatsen', field1: 'Titel', field2: 'Samenvatting' },
      jalons: { icon: 'actu', title: 'Het ritme aangeven', desc: 'De belangrijkste mijlpalen die iedereen laten zien waar het project staat.', create: 'Mijn eerste mijlpaal toevoegen', field1: 'Mijlpaal', field2: 'Datum of detail' },
      plans: { icon: 'plans', title: 'Laten zien, niet alleen vertellen', desc: 'Plattegronden, 3D-beelden en visuals om het je voor te stellen.', create: 'Mijn eerste beeld toevoegen', field1: 'Titel', field2: 'Opmerking' },
      ambassadeurs: { icon: 'people', title: 'Vertrouwde schakels', desc: 'Collega\'s die teams verbinden met het project.', create: 'Mijn eerste ambassadeur toevoegen', field1: 'Naam', field2: 'Rol' },
      equipe: { icon: 'people', title: 'Wie het project leidt', desc: 'De organisatie, aan klant- en adviesbureauzijde.', create: 'Een lid toevoegen', field1: 'Naam', field2: 'Functie' }
    },
    de: {
      faq: { icon: 'faq', title: 'Immer eine Antwort', desc: 'Die Wissensdatenbank, die Ihr Team jederzeit durchsuchen kann.', create: 'Meine erste Frage hinzufügen', field1: 'Frage', field2: 'Antwort' },
      actu: { icon: 'actu', title: 'Der rote Faden des Projekts', desc: 'Zeitplan und Neuigkeiten anstelle von Status-E-Mails.', create: 'Meine erste Neuigkeit veröffentlichen', field1: 'Titel', field2: 'Kurzfassung' },
      jalons: { icon: 'actu', title: 'Den Takt vorgeben', desc: 'Die wichtigsten Meilensteine, damit alle den Stand des Projekts verstehen.', create: 'Ersten Meilenstein hinzufügen', field1: 'Meilenstein', field2: 'Datum oder Detail' },
      plans: { icon: 'plans', title: 'Zeigen statt nur erzählen', desc: 'Pläne, 3D-Ansichten und Visuals zur besseren Vorstellung.', create: 'Mein erstes Bild hinzufügen', field1: 'Titel', field2: 'Kommentar' },
      ambassadeurs: { icon: 'people', title: 'Vertrauenswürdige Vermittler', desc: 'Kolleginnen und Kollegen, die Teams mit dem Projekt verbinden.', create: 'Meinen ersten Botschafter hinzufügen', field1: 'Name', field2: 'Rolle' },
      equipe: { icon: 'people', title: 'Wer das Projekt leitet', desc: 'Die Organisation, auf Kunden- und Beratungsseite.', create: 'Mitglied hinzufügen', field1: 'Name', field2: 'Funktion' }
    }
  };
  const SECTION_ORDER = ['faq', 'actu', 'jalons', 'plans', 'ambassadeurs', 'equipe'];

  const PREVIEWS = {
    fr: {
      faq: { q: 'Quand aura lieu le déménagement ?', status: 'Réponse confirmée', a: 'Le déménagement est prévu la semaine du 14 octobre. La date précise par équipe sera confirmée prochainement.' },
      actu: { tag: 'Calendrier', title: 'Le projet entre dans sa phase active', chapeau: 'Les premières actions concrètes démarrent ce mois-ci.' },
      plans: { type: 'Plan', title: 'Macro-zoning — niveau R+1', comment: 'Répartition générale des espaces sur le plateau principal.' },
      ambassadeurs: { name: 'Sophie Lecomte', role: 'Responsable comptabilité clients' },
      equipe: { name: 'Stéphanie Collet', title: 'Directrice RH — Cheffe de projet' }
    },
    en: {
      faq: { q: 'When is the move happening?', status: 'Confirmed answer', a: 'The move is planned for the week of October 14th. The exact date per team will be confirmed shortly.' },
      actu: { tag: 'Timeline', title: 'The project enters its active phase', chapeau: 'The first concrete actions start this month.' },
      plans: { type: 'Plan', title: 'Macro-zoning — level 1', comment: 'Overall layout of the main floor spaces.' },
      ambassadeurs: { name: 'Sophie Lecomte', role: 'Client Accounting Manager' },
      equipe: { name: 'Stéphanie Collet', title: 'HR Director — Project Lead' }
    },
    it: {
      faq: { q: 'Quando avverrà il trasloco?', status: 'Risposta confermata', a: 'Il trasloco è previsto per la settimana del 14 ottobre. La data precisa per team sarà confermata a breve.' },
      actu: { tag: 'Calendario', title: 'Il progetto entra nella fase attiva', chapeau: 'Le prime azioni concrete iniziano questo mese.' },
      plans: { type: 'Planimetria', title: 'Macro-zoning — piano 1', comment: 'Disposizione generale degli spazi al piano principale.' },
      ambassadeurs: { name: 'Sophie Lecomte', role: 'Responsabile contabilità clienti' },
      equipe: { name: 'Stéphanie Collet', title: 'Direttrice HR — Capoprogetto' }
    },
    es: {
      faq: { q: '¿Cuándo será la mudanza?', status: 'Respuesta confirmada', a: 'La mudanza está prevista para la semana del 14 de octubre. La fecha exacta por equipo se confirmará pronto.' },
      actu: { tag: 'Calendario', title: 'El proyecto entra en su fase activa', chapeau: 'Las primeras acciones concretas comienzan este mes.' },
      plans: { type: 'Plano', title: 'Macro-zoning — planta 1', comment: 'Distribución general de los espacios en la planta principal.' },
      ambassadeurs: { name: 'Sophie Lecomte', role: 'Responsable de contabilidad de clientes' },
      equipe: { name: 'Stéphanie Collet', title: 'Directora de RRHH — Jefa de proyecto' }
    },
    nl: {
      faq: { q: 'Wanneer vindt de verhuizing plaats?', status: 'Bevestigd antwoord', a: 'De verhuizing is gepland in de week van 14 oktober. De exacte datum per team volgt binnenkort.' },
      actu: { tag: 'Planning', title: 'Het project gaat de actieve fase in', chapeau: 'De eerste concrete acties starten deze maand.' },
      plans: { type: 'Plattegrond', title: 'Macro-zonering — verdieping 1', comment: 'Algemene indeling van de ruimtes op de hoofdverdieping.' },
      ambassadeurs: { name: 'Sophie Lecomte', role: 'Manager klantenboekhouding' },
      equipe: { name: 'Stéphanie Collet', title: 'HR-directeur — Projectleider' }
    },
    de: {
      faq: { q: 'Wann findet der Umzug statt?', status: 'Bestätigte Antwort', a: 'Der Umzug ist für die Woche vom 14. Oktober geplant. Das genaue Datum pro Team wird in Kürze bestätigt.' },
      actu: { tag: 'Zeitplan', title: 'Das Projekt tritt in die aktive Phase ein', chapeau: 'Die ersten konkreten Schritte beginnen diesen Monat.' },
      plans: { type: 'Plan', title: 'Makro-Zonierung — Ebene 1', comment: 'Allgemeine Aufteilung der Flächen auf der Hauptetage.' },
      ambassadeurs: { name: 'Sophie Lecomte', role: 'Leiterin Debitorenbuchhaltung' },
      equipe: { name: 'Stéphanie Collet', title: 'Personalleiterin — Projektleiterin' }
    }
  };

  const MILESTONE_PREVIEWS = {
    fr:{date:'Octobre',title:'Installation dans les nouveaux espaces',detail:'La prochaine grande étape du projet.'},
    en:{date:'October',title:'Move into the new spaces',detail:'The next major project milestone.'},
    it:{date:'Ottobre',title:'Ingresso nei nuovi spazi',detail:'La prossima grande tappa del progetto.'},
    es:{date:'Octubre',title:'Instalación en los nuevos espacios',detail:'El próximo gran hito del proyecto.'},
    nl:{date:'Oktober',title:'Verhuizen naar de nieuwe ruimtes',detail:'De volgende grote mijlpaal van het project.'},
    de:{date:'Oktober',title:'Einzug in die neuen Räume',detail:'Der nächste große Meilenstein des Projekts.'}
  };


  function t(){return UI[state.uiLang]||UI.fr;}
  function escapeHtml(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function initials(name){const p=String(name||'').trim().split(/\s+/).filter(Boolean);if(!p.length)return'P';return p.length===1?p[0].slice(0,2).toUpperCase():(p[0][0]+p[p.length-1][0]).toUpperCase();}
  function wait(ms,signal){return new Promise((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});}
  function animate(el,keyframes,options={},signal){
    if(!el)return Promise.resolve();
    if(reducedMotion.matches){const last=keyframes[keyframes.length-1]||{};Object.entries(last).forEach(([k,v])=>{if(k!=='offset'&&k!=='easing')el.style[k]=v;});return Promise.resolve();}
    const a=el.animate(keyframes,{fill:'forwards',...options});signal?.addEventListener('abort',()=>a.cancel(),{once:true});
    return a.finished.catch(err=>{if(err?.name!=='AbortError')throw err;});
  }
  function setupProgressMarkup(step,total=5){const pct=Math.max(0,Math.min(100,(step/total)*100));return `<div class="storm-step-progress" data-setup-step="${step}" data-setup-total="${total}"><span class="storm-progress-copy"></span><i><b style="width:${pct}%"></b></i></div>`;}
  function topbarMarkup(backTarget=null){return `<div class="storm-topbar"><div class="storm-lockup"><strong>STORM</strong><span>by Parella</span></div>${backTarget?`<button type="button" class="storm-top-action" data-back="${backTarget}">${escapeHtml(t().back)}</button>`:'<span></span>'}</div>`;}
  function scene(name){return root?.querySelector(`[data-scene="${name}"]`);}
  async function transitionTo(next,direction=1){
    const current=scene(sceneName),target=scene(next);if(!target||current===target)return;
    if(current&&!current.hidden){
      await animate(current,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:`translateY(${direction>0?-5:5}px)`}],{duration:180,easing:'cubic-bezier(.4,0,1,1)'});
      current.hidden=true;
    }
    target.hidden=false;
    await animate(target,[{opacity:0,transform:`translateY(${direction>0?5:-5}px)`},{opacity:1,transform:'translateY(0)'}],{duration:300,easing:'cubic-bezier(.16,1,.3,1)'});
    target.style.opacity='';target.style.transform='';sceneName=next;
  }
  function renderLanguageOptions(container,current,onPick){
    container.innerHTML=LANGS.map(l=>`<button type="button" class="storm-language-option ${l.code===current?'selected':''}" data-code="${l.code}"><span>${escapeHtml(l.label)}</span><span class="storm-language-check">${icon('check')}</span></button>`).join('');
    container.querySelectorAll('[data-code]').forEach(btn=>btn.addEventListener('click',()=>{onPick(btn.dataset.code);container.querySelectorAll('[data-code]').forEach(b=>b.classList.toggle('selected',b===btn));}));
  }
  function logoHtml(){if(state.logoUrl)return `<img src="${escapeHtml(state.logoUrl)}" alt="">`;return escapeHtml(initials(state.projectName||'Projet'));}
  function enabledModuleKeys(){
    return SECTION_ORDER.filter(key=>state.modules?.[key]!==false);
  }

  function siteModuleLabel(key){
    const labels=(UI[state.contentLang]||UI.fr).moduleName || t().moduleName;
    return labels[key] || key;
  }

  function siteModuleTeaser(){
    const key=enabledModuleKeys()[0];
    const lang=state.contentLang;
    const copy={
      fr:{faq:'Quand aura lieu le déménagement ?',actu:'Le projet entre dans sa phase active',jalons:'Prochaine étape · installation',plans:'Découvrir les plans & 3D',ambassadeurs:'Rencontrer les ambassadeurs',equipe:'Découvrir l’équipe projet',empty:'Bienvenue dans votre espace projet'},
      en:{faq:'When is the move happening?',actu:'The project enters its active phase',jalons:'Next milestone · move-in',plans:'Discover plans & 3D',ambassadeurs:'Meet the ambassadors',equipe:'Meet the project team',empty:'Welcome to your project space'},
      it:{faq:'Quando avverrà il trasloco?',actu:'Il progetto entra nella fase attiva',jalons:'Prossima tappa · ingresso',plans:'Scopri planimetrie & 3D',ambassadeurs:'Conosci gli ambasciatori',equipe:'Scopri il team di progetto',empty:'Benvenuto nel tuo spazio progetto'},
      es:{faq:'¿Cuándo será la mudanza?',actu:'El proyecto entra en su fase activa',jalons:'Próximo hito · instalación',plans:'Descubrir planos & 3D',ambassadeurs:'Conocer a los embajadores',equipe:'Conocer al equipo de proyecto',empty:'Bienvenido a tu espacio de proyecto'},
      nl:{faq:'Wanneer vindt de verhuizing plaats?',actu:'Het project gaat de actieve fase in',jalons:'Volgende stap · verhuizing',plans:'Ontdek plattegronden & 3D',ambassadeurs:'Ontmoet de ambassadeurs',equipe:'Ontdek het projectteam',empty:'Welkom in je projectruimte'},
      de:{faq:'Wann findet der Umzug statt?',actu:'Das Projekt geht in die aktive Phase',jalons:'Nächster Meilenstein · Einzug',plans:'Pläne & 3D entdecken',ambassadeurs:'Botschafter kennenlernen',equipe:'Projektteam kennenlernen',empty:'Willkommen in Ihrem Projektbereich'}
    }[lang]||{};
    return copy[key]||copy.empty||'Bienvenue dans votre espace projet';
  }

  function sitePreviewHtml(){
    const name=state.projectName.trim()||(state.uiLang==='fr'?'Votre projet':'Your project');
    const mainFamily=state.fonts[0]?.family||'Roboto',secondFamily=state.fonts[1]?.family||mainFamily;
    const copy=SITE_COPY[state.contentLang]||SITE_COPY.fr;
    const nav=enabledModuleKeys().map(key=>`<span>${escapeHtml(siteModuleLabel(key))}</span>`).join('');
    return `<div class="storm-browser">
      <div class="storm-browser-bar"><i></i><i></i><i></i><span>${escapeHtml(name)}</span></div>
      <div class="storm-site-preview theme-${state.theme}" id="stormCanonicalPreview" style="--client-primary:${escapeHtml(state.primaryColor)};--client-secondary:${escapeHtml(state.secondaryColor)};--font-main:'${escapeHtml(mainFamily)}';--font-secondary:'${escapeHtml(secondFamily)}';font-family:'${escapeHtml(mainFamily)}',sans-serif;">
        <div class="storm-site-nav"><div class="storm-site-brand"><div class="storm-site-logo ${state.logoUrl?'has-image':''}">${logoHtml()}</div><span class="storm-site-project">${escapeHtml(name)}</span></div><div class="storm-site-links">${nav}</div></div>
        <div class="storm-site-hero"><div><div class="storm-site-kicker">${escapeHtml(name)}</div><div class="storm-site-title">${escapeHtml(copy.title)} <em>${escapeHtml(copy.accent)}</em></div></div><div class="storm-site-copy">${escapeHtml(copy.desc)}</div></div>
        <div class="storm-site-card"><span>${escapeHtml(siteModuleTeaser())}</span><button type="button">${escapeHtml(copy.search)}</button></div>
      </div></div>`;
  }
  function activatePreviewMotion(){const p=root?.querySelector('#stormCanonicalPreview');if(!p)return;p.classList.remove('is-activating');if(state.theme==='rainbow'&&!reducedMotion.matches){setTimeout(()=>p.classList.add('is-activating'),20);}}


  function buildRoot(){
    const node=document.createElement('div');node.id=ROOT_ID;node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');node.setAttribute('aria-label','Storm — démonstration de mise en route');
    node.innerHTML=`
      <section class="storm-scene storm-intro-scene" data-scene="intro">
        <button type="button" class="storm-intro-skip" id="stormIntroSkip">${escapeHtml(t().skip)}</button>
        <div class="storm-intro-center"><div class="storm-intro-wordmark" id="stormIntroWord">STORM</div><div class="storm-intro-by" id="stormIntroBy">by Parella</div><div class="storm-intro-greeting" id="stormIntroGreeting"></div></div>
      </section>

      <section class="storm-scene" data-scene="ui-language" hidden>
        ${topbarMarkup()}<div class="storm-language-inner"><h1 class="storm-title small" id="stormUiLangTitle"></h1><p class="storm-subtitle" id="stormUiLangSub"></p><div class="storm-language-list" id="stormUiLangList"></div><div class="storm-actions"><button class="storm-btn-primary" id="stormUiLangContinue"></button></div></div>
      </section>

      <section class="storm-scene" data-scene="content-language" hidden>
        ${topbarMarkup('ui-language')}<div class="storm-language-inner"><h1 class="storm-title small" id="stormContentLangTitle"></h1><p class="storm-subtitle" id="stormContentLangSub"></p><div class="storm-language-list" id="stormContentLangList"></div><div class="storm-actions"><button class="storm-btn-primary" id="stormContentLangContinue"></button></div></div>
      </section>

      <section class="storm-scene" data-scene="welcome" hidden>
        ${topbarMarkup('content-language')}<div class="storm-welcome-inner"><h1 class="storm-welcome-title" id="stormWelcomeTitle"></h1><div class="storm-welcome-breath storm-serif" id="stormWelcomeBreath"></div><div class="storm-actions"><button class="storm-btn-primary" id="stormWelcomeContinue"></button></div></div>
      </section>

      <section class="storm-scene" data-scene="project" hidden>
        ${topbarMarkup('welcome')}${setupProgressMarkup(1,7)}<div class="storm-step-inner"><h1 class="storm-title small" id="stormProjectTitle"></h1><p class="storm-subtitle" id="stormProjectSub"></p><div class="storm-input-block"><input class="storm-field storm-input-large" id="stormProjectInput" autocomplete="off"></div><div class="storm-continue-row"><span></span><button class="storm-btn-primary" id="stormProjectContinue"></button></div></div>
      </section>

      <section class="storm-scene" data-scene="logo" hidden>
        ${topbarMarkup('project')}${setupProgressMarkup(2,7)}<div class="storm-step-inner"><h1 class="storm-title small" id="stormLogoTitle"></h1><p class="storm-subtitle" id="stormLogoSub"></p><div class="storm-upload-zone" id="stormLogoDrop"><div class="storm-upload-preview" id="stormLogoPreview">${icon('upload')}</div><div class="storm-upload-copy"><strong id="stormLogoChooseLabel"></strong><span id="stormLogoHint"></span></div><button class="storm-btn-secondary" type="button" id="stormLogoChoose"></button><input type="file" id="stormLogoInput" accept="image/png,image/jpeg" hidden></div><div class="storm-continue-row"><button class="storm-btn-ghost" id="stormLogoSkip"></button><button class="storm-btn-primary" id="stormLogoContinue"></button></div></div>
      </section>

      <section class="storm-scene" data-scene="colors" hidden>
        ${topbarMarkup('logo')}${setupProgressMarkup(3,7)}<div class="storm-step-inner"><h1 class="storm-title small" id="stormColorsTitle"></h1><p class="storm-subtitle" id="stormColorsSub"></p><div class="storm-color-grid"><div class="storm-color-card"><input type="color" id="stormPrimaryPicker"><div><label id="stormPrimaryLabel"></label><input class="storm-color-hex" id="stormPrimaryHex" maxlength="7"></div></div><div class="storm-color-card"><input type="color" id="stormSecondaryPicker"><div><label id="stormSecondaryLabel"></label><input class="storm-color-hex" id="stormSecondaryHex" maxlength="7"></div></div></div><div class="storm-continue-row"><span></span><button class="storm-btn-primary" id="stormColorsContinue"></button></div></div>
      </section>

      <section class="storm-scene" data-scene="fonts" hidden>
        ${topbarMarkup('colors')}${setupProgressMarkup(4,7)}<div class="storm-step-inner"><h1 class="storm-title small" id="stormFontsTitle"></h1><p class="storm-subtitle" id="stormFontsSub"></p><div class="storm-font-stack" id="stormFontStack"></div><div class="storm-continue-row"><span></span><button class="storm-btn-primary" id="stormFontsContinue"></button></div></div>
      </section>

      <section class="storm-scene storm-theme-scene" data-scene="theme" hidden>
        ${topbarMarkup('fonts')}${setupProgressMarkup(5,7)}
        <div class="storm-theme-layout">
          <div class="storm-step-center storm-theme-heading"><h1 class="storm-title small" id="stormThemeTitle"></h1><p class="storm-subtitle" id="stormThemeSub"></p></div>
          <div class="storm-theme-grid" id="stormThemeGrid"></div>
          <div id="stormThemePreviewHost">${sitePreviewHtml()}</div>
        </div>
        <div class="storm-theme-dock"><button class="storm-btn-primary" id="stormThemeContinue"></button></div>
      </section>

      <section class="storm-scene storm-modules-scene" data-scene="modules" hidden>
        ${topbarMarkup('theme')}${setupProgressMarkup(6,7)}
        <div class="storm-modules-layout">
          <div class="storm-modules-copy">
            <h1 class="storm-title small" id="stormModulesTitle"></h1>
            <p class="storm-subtitle" id="stormModulesSub"></p>
            <div class="storm-module-list" id="stormModuleList"></div>
            <div class="storm-modules-hint" id="stormModulesHint"></div>
          </div>
          <div class="storm-modules-preview"><div id="stormModulesPreviewHost">${sitePreviewHtml()}</div></div>
        </div>
        <div class="storm-theme-dock"><button class="storm-btn-primary" id="stormModulesContinue"></button></div>
      </section>

      <section class="storm-scene storm-access-scene" data-scene="access" hidden>
        ${topbarMarkup('modules')}${setupProgressMarkup(7,7)}
        <div class="storm-access-layout">
          <div>
            <h1 class="storm-title small" id="stormAccessTitle"></h1>
            <p class="storm-subtitle" id="stormAccessSub"></p>
            <div class="storm-access-levels" id="stormAccessLevels"></div>
          </div>
          <div class="storm-invite-panel">
            <div class="storm-invite-heading" id="stormInviteTitle"></div>
            <div class="storm-invite-form">
              <input type="email" class="storm-field" id="stormInviteEmail">
              <select id="stormInviteRole" class="storm-access-select">
                <option value="editor"></option>
                <option value="contributor"></option>
                <option value="pilot"></option>
                <option value="project_admin"></option>
              </select>
              <select id="stormInviteLocale" class="storm-access-select" aria-label="Langue de l'invitation"></select>
              <button type="button" class="storm-btn-secondary" id="stormInviteAdd"></button>
            </div>
            <div class="storm-invite-list" id="stormInviteList"></div>
            <div class="storm-access-actions">
              <button class="storm-btn-ghost" id="stormAccessLater"></button>
              <button class="storm-btn-primary" id="stormAccessContinue"></button>
            </div>
          </div>
        </div>
      </section>

      <section class="storm-scene" data-scene="reveal" hidden>
        ${topbarMarkup('access')}<div class="storm-reveal-layout"><h1 class="storm-reveal-title" id="stormRevealTitle"></h1><p class="storm-subtitle" id="stormRevealSub" style="margin-left:auto;margin-right:auto;"></p><div id="stormRevealPreviewHost">${sitePreviewHtml()}</div><div class="storm-actions"><button class="storm-btn-primary" id="stormRevealContinue"></button></div></div>
      </section>

      <section class="storm-scene storm-sections-scene" data-scene="tour" hidden>
        <div class="storm-tour-head">
          <div class="storm-lockup"><strong>STORM</strong><span>by Parella</span></div>
          <div class="storm-tour-head-actions">
            <button type="button" class="storm-tour-back-action" id="stormTourBackTop"></button>
            <button class="storm-tour-close" id="stormCloseBtn" aria-label="Fermer">${icon('close')}</button>
          </div>
        </div>
        <div class="storm-section-progress-wrap"><span id="stormTourStepLabel"></span><div class="storm-section-progress-track"><b id="stormTourProgressFill"></b></div></div>
        <div class="storm-tour-stage" id="stormTourStage">
          <div class="storm-section-layout storm-section-layout-persistent">
            <div id="stormTourCopyHost"></div>
            <div class="storm-section-preview-column"><div id="stormTourPreviewHost"></div></div>
          </div>
        </div>
      </section>

      <section class="storm-scene storm-build-scene" data-scene="build" hidden>
        <div class="storm-build-wrap">
          <h1 class="storm-build-title" id="stormBuildTitle"></h1>
          <div class="storm-build-morph" id="stormBuildMorph">
            <div class="storm-build-word" id="stormBuildWord" aria-label="STORM">
              <span>S</span><span>T</span><span>O</span><span>R</span><span>M</span>
            </div>
          </div>
          <div class="storm-build-message" id="stormBuildMessage"></div>
          <div class="storm-build-progress"><b id="stormBuildProgress"></b></div>
          <div class="storm-build-error" id="stormBuildError" hidden role="alert"></div>
          <div class="storm-build-final" id="stormBuildFinal" hidden>
            <button type="button" class="storm-btn-primary" id="stormBuildOpenBtn"></button>
          </div>
          <button type="button" class="storm-btn-secondary" id="stormBuildRetryBtn" hidden></button>
        </div>
      </section>`;

    bindGlobalNavigation(node);bindSetupInteractions(node);return node;
  }


  function applyTexts(){
    const s=t();
    [['stormUiLangTitle','interfaceTitle'],['stormUiLangSub','interfaceSub'],['stormUiLangContinue','continue'],
     ['stormContentLangTitle','contentTitle'],['stormContentLangSub','contentSub'],['stormContentLangContinue','continue'],
     ['stormWelcomeTitle','welcomeTitle'],['stormWelcomeBreath','welcomeBreath'],['stormWelcomeContinue','continue'],
     ['stormProjectTitle','nameTitle'],['stormProjectSub','nameSub'],['stormProjectContinue','continue'],
     ['stormLogoTitle','logoTitle'],['stormLogoSub','logoSub'],['stormLogoChooseLabel','logoChoose'],['stormLogoHint','logoEmpty'],['stormLogoChoose','logoChoose'],['stormLogoSkip','skip'],['stormLogoContinue','continue'],
     ['stormColorsTitle','colorsTitle'],['stormColorsSub','colorsSub'],['stormPrimaryLabel','primary'],['stormSecondaryLabel','secondary'],['stormColorsContinue','continue'],
     ['stormFontsTitle','fontsTitle'],['stormFontsSub','fontsSub'],['stormFontsContinue','continue'],
     ['stormThemeTitle','themeTitle'],['stormThemeSub','themeSub'],['stormThemeContinue','continue'],
     ['stormModulesTitle','modulesTitle'],['stormModulesSub','modulesSub'],['stormModulesHint','modulesHint'],['stormModulesContinue','continue'],
     ['stormAccessTitle','accessTitle'],['stormAccessSub','accessSub'],['stormInviteTitle','inviteTitle'],['stormInviteEmail','inviteEmail'],['stormInviteAdd','inviteAdd'],['stormAccessLater','inviteLater'],['stormAccessContinue','continue'],
     ['stormRevealTitle','revealTitle'],['stormRevealSub','revealSub'],['stormRevealContinue','revealContinue'],
     ['stormBuildTitle','buildTitle']
    ].forEach(([id,key])=>{const el=root.querySelector('#'+id);if(el)el.textContent=s[key];});
    root.querySelector('#stormProjectInput').placeholder=s.namePlaceholder;
    const inviteEmail=root.querySelector('#stormInviteEmail');if(inviteEmail)inviteEmail.placeholder=s.inviteEmail;
    const inviteRole=root.querySelector('#stormInviteRole');
    if(inviteRole){
      inviteRole.options[0].text=s.accessEditor;
      inviteRole.options[1].text=s.accessContributor;
      inviteRole.options[2].text=s.accessPilot;
      inviteRole.options[3].text=s.accessAdmin;
    }
    root.querySelectorAll('[data-back]').forEach(btn=>btn.textContent=s.back);
    const tourBack=root.querySelector('#stormTourBackTop');if(tourBack)tourBack.textContent=s.back;
    root.querySelectorAll('[data-setup-step]').forEach(el=>{
      const n=Number(el.dataset.setupStep),total=Number(el.dataset.setupTotal);el.querySelector('.storm-progress-copy').textContent=s.setupProgress(n,total);
    });
  }

  async function playIntro(signal){
    const word=root.querySelector('#stormIntroWord'),by=root.querySelector('#stormIntroBy'),greeting=root.querySelector('#stormIntroGreeting'),skip=root.querySelector('#stormIntroSkip');
    skip.textContent=t().skip;word.style.opacity='0';by.style.opacity='0';greeting.style.opacity='0';
    animate(skip,[{opacity:0},{opacity:1}],{duration:260,delay:450,easing:'ease-out'},signal);
    await animate(word,[{opacity:0,transform:'translateY(8px) scaleX(.955)',clipPath:'inset(48% 0 48% 0)'},{opacity:1,transform:'translateY(0) scaleX(1)',clipPath:'inset(0% 0 0% 0)'}],{duration:820,easing:'cubic-bezier(.16,1,.3,1)'},signal);
    await animate(by,[{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,easing:'ease-out'},signal);
    await wait(460,signal);
    for(const label of ['Bonjour.','Hello.','Hallo.','Ciao.','Hola.','Goedendag.']){
      greeting.textContent=label;
      await animate(greeting,[{opacity:0,transform:'translate(-50%,4px)'},{opacity:1,transform:'translate(-50%,0)'}],{duration:180,easing:'ease-out'},signal);
      await wait(190,signal);
      await animate(greeting,[{opacity:1},{opacity:0}],{duration:120,easing:'ease-in'},signal);
    }
    await Promise.all([
      animate(word,[{transform:'translateY(0) scale(1)',opacity:1},{transform:'translateY(-18px) scale(.84)',opacity:0}],{duration:420,easing:'cubic-bezier(.4,0,1,1)'},signal),
      animate(by,[{opacity:1},{opacity:0}],{duration:260,easing:'ease-out'},signal),
      animate(skip,[{opacity:1},{opacity:0}],{duration:200,easing:'ease-out'},signal)
    ]);
    await showUiLanguage();
  }
  function skipIntro(){abortController?.abort();showUiLanguage();}

  async function showUiLanguage(){applyTexts();renderLanguageOptions(root.querySelector('#stormUiLangList'),state.uiLang,code=>{state.uiLang=code;applyTexts();});await transitionTo('ui-language');}
  async function showContentLanguage(){applyTexts();renderLanguageOptions(root.querySelector('#stormContentLangList'),state.contentLang,code=>{state.contentLang=code;});await transitionTo('content-language');}
  async function showWelcome(){applyTexts();await transitionTo('welcome');}
  async function showProject(){applyTexts();root.querySelector('#stormProjectInput').value=state.projectName;await transitionTo('project');root.querySelector('#stormProjectInput').focus();}
  async function showLogo(){applyTexts();refreshLogoPreview();await transitionTo('logo');}
  async function showColors(){applyTexts();syncColorFields();await transitionTo('colors');}
  async function showFonts(){applyTexts();renderFontCards();await transitionTo('fonts');}
  async function showTheme(){applyTexts();renderThemeCards();root.querySelector('#stormThemePreviewHost').innerHTML=sitePreviewHtml();await transitionTo('theme');activatePreviewMotion();}


  function renderModuleSelector(){
    const wrap=root.querySelector('#stormModuleList');
    if(!wrap)return;
    const s=t();
    wrap.innerHTML=SECTION_ORDER.map(key=>{
      const active=state.modules?.[key]!==false;
      return `<button type="button" class="storm-module-row ${active?'is-active':''}" data-module-toggle="${key}" aria-pressed="${active?'true':'false'}">
        <span class="storm-module-copy"><strong>${escapeHtml(s.moduleName[key])}</strong><small>${escapeHtml(s.moduleDesc[key])}</small></span>
        <span class="storm-module-check">${icon('check')}</span>
      </button>`;
    }).join('');

    wrap.querySelectorAll('[data-module-toggle]').forEach(btn=>btn.addEventListener('click',()=>{
      const key=btn.dataset.moduleToggle;
      state.modules[key]=!(state.modules[key]!==false);
      const active=state.modules[key]!==false;
      btn.classList.toggle('is-active',active);
      btn.setAttribute('aria-pressed',active?'true':'false');
      refreshModulesPreview();
    }));
  }

  async function refreshModulesPreview(){
    const host=root.querySelector('#stormModulesPreviewHost');
    if(!host)return;
    const old=host.firstElementChild;
    if(old) await animate(old,[{opacity:1,transform:'scale(1)'},{opacity:.18,transform:'scale(.992)'}],{duration:115,easing:'ease-in'});
    host.innerHTML=sitePreviewHtml();
    const fresh=host.firstElementChild;
    await animate(fresh,[{opacity:.12,transform:'scale(.992)'},{opacity:1,transform:'scale(1)'}],{duration:240,easing:'cubic-bezier(.16,1,.3,1)'});
    activatePreviewMotion();
  }

  async function showModules(){
    applyTexts();
    renderModuleSelector();
    root.querySelector('#stormModulesPreviewHost').innerHTML=sitePreviewHtml();
    await transitionTo('modules');
    activatePreviewMotion();
  }

  function activeSectionOrder(){
    return SECTION_ORDER.filter(key=>state.modules?.[key]!==false);
  }

  function accessLevelCardsHtml(){
    const s=t();
    return [
      ['project_admin',s.accessAdmin,s.accessAdminDesc],
      ['editor',s.accessEditor,s.accessEditorDesc],
      ['contributor',s.accessContributor,s.accessContributorDesc],
      ['pilot',s.accessPilot,s.accessPilotDesc]
    ].map(([key,title,desc],i)=>`<div class="storm-access-level ${i===0?'is-current':''}"><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(desc)}</span></div>${i===0?'<em>Vous</em>':''}</div>`).join('');
  }

  function renderInviteList(){
    const wrap=root.querySelector('#stormInviteList');if(!wrap)return;
    const s=t();
    if(!state.invites.length){wrap.innerHTML='';return;}
    const roleLabel={project_admin:s.accessAdmin,editor:s.accessEditor,contributor:s.accessContributor,pilot:s.accessPilot};
    wrap.innerHTML=state.invites.map((invite,index)=>`<div class="storm-invite-chip"><span>${escapeHtml(invite.email)}</span><small>${escapeHtml(roleLabel[invite.permissionBundle]||invite.permissionBundle)} · ${escapeHtml(invite.locale.toUpperCase())}</small><button type="button" data-remove-invite="${index}" aria-label="Retirer">×</button></div>`).join('');
    wrap.querySelectorAll('[data-remove-invite]').forEach(btn=>btn.addEventListener('click',()=>{state.invites.splice(Number(btn.dataset.removeInvite),1);renderInviteList();}));
  }

  async function showAccess(){
    applyTexts();
    root.querySelector('#stormAccessLevels').innerHTML=accessLevelCardsHtml();
    renderInviteList();
    // Locale de l'invitation : donnée indépendante, jamais héritée
    // automatiquement de workspaceLocale/contentLocale — seulement
    // préremplie avec une valeur raisonnable (la langue de travail du
    // projet), explicitement modifiable personne par personne.
    const inviteLocale=root.querySelector('#stormInviteLocale');
    if(inviteLocale && !inviteLocale.dataset.filled){
      inviteLocale.innerHTML=LANGS.map(l=>`<option value="${l.code}">${escapeHtml(l.label)}</option>`).join('');
      inviteLocale.value=state.uiLang;
      inviteLocale.dataset.filled='true';
    }
    await transitionTo('access');
  }

  async function showReveal(){
    applyTexts();root.querySelector('#stormRevealPreviewHost').innerHTML=sitePreviewHtml();await transitionTo('reveal');
    const preview=root.querySelector('#stormRevealPreviewHost .storm-browser');
    if(preview)await animate(preview,[{opacity:.15,transform:'scale(.975) translateY(7px)'},{opacity:1,transform:'scale(1) translateY(0)'}],{duration:620,easing:'cubic-bezier(.16,1,.3,1)'});
    activatePreviewMotion();
  }

  function refreshLogoPreview(){const box=root.querySelector('#stormLogoPreview');if(box)box.innerHTML=state.logoUrl?`<img src="${escapeHtml(state.logoUrl)}" alt="">`:icon('upload');}
  function syncColorFields(){
    const p=root.querySelector('#stormPrimaryPicker'),s=root.querySelector('#stormSecondaryPicker'),ph=root.querySelector('#stormPrimaryHex'),sh=root.querySelector('#stormSecondaryHex');
    p.value=state.primaryColor;s.value=state.secondaryColor;ph.value=state.primaryColor.toUpperCase();sh.value=state.secondaryColor.toUpperCase();
  }
  function validHex(v){return /^#[0-9A-Fa-f]{6}$/.test(String(v||'').trim());}
  function renderFontCards(){
    const s=t(),wrap=root.querySelector('#stormFontStack');
    wrap.innerHTML=state.fonts.map((font,index)=>`<div class="storm-font-card"><div><span class="storm-font-role">${escapeHtml(index===0?s.fontPrimary:s.fontSecondary)}</span><span class="storm-font-name">${escapeHtml(font.name)}</span><span class="storm-font-sample" style="font-family:'${escapeHtml(font.family)}',sans-serif;">Projet Quatro · Aa Bb Cc</span></div><div class="storm-font-actions"><button class="storm-btn-secondary" type="button" data-font-upload="${index}">${escapeHtml(s.replace)}</button>${index===1?`<button class="storm-btn-ghost" type="button" data-font-remove="1">${escapeHtml(s.remove)}</button>`:''}<input type="file" data-font-input="${index}" accept=".woff2,.woff,.ttf,.otf" hidden></div></div>`).join('');
    if(state.fonts.length<2)wrap.insertAdjacentHTML('beforeend',`<button class="storm-btn-ghost" type="button" id="stormAddFont">+ ${escapeHtml(s.fontSecondary)}</button>`);
    wrap.querySelectorAll('[data-font-upload]').forEach(btn=>btn.addEventListener('click',()=>wrap.querySelector(`[data-font-input="${btn.dataset.fontUpload}"]`)?.click()));
    wrap.querySelectorAll('[data-font-input]').forEach(input=>input.addEventListener('change',async()=>{
      const i=Number(input.dataset.fontInput),file=input.files?.[0];input.value='';if(!file)return;
      try{const family=`StormDemoFont_${i}_${Date.now()}`;const face=new FontFace(family,await file.arrayBuffer());await face.load();document.fonts.add(face);state.fonts[i]={name:file.name.replace(/\.(woff2?|ttf|otf)$/i,'').replace(/[-_]+/g,' '),family};renderFontCards();}catch(e){console.warn('Storm demo font:',e);}
    }));
    wrap.querySelector('[data-font-remove="1"]')?.addEventListener('click',()=>{state.fonts=state.fonts.slice(0,1);renderFontCards();});
    wrap.querySelector('#stormAddFont')?.addEventListener('click',()=>{state.fonts.push({name:'Italiana',family:'Italiana'});renderFontCards();});
  }
  function renderThemeCards(){
    const s=t(),wrap=root.querySelector('#stormThemeGrid');
    const brandVars=`--client-primary:${escapeHtml(state.primaryColor)};--client-secondary:${escapeHtml(state.secondaryColor)};`;
    wrap.innerHTML=THEME_KEYS.map(key=>`<button type="button" class="storm-theme-card ${state.theme===key?'selected':''}" data-theme="${key}"><div class="storm-theme-mini ${key}" style="${brandVars}"></div><div class="storm-theme-body"><div class="storm-theme-name"><span>${escapeHtml(s.themeName[key])}</span><span class="storm-theme-check">${icon('check')}</span></div><div class="storm-theme-desc">${escapeHtml(s.themeDesc[key])}</div></div></button>`).join('');
    wrap.querySelectorAll('[data-theme]').forEach(btn=>btn.addEventListener('click',()=>{state.theme=btn.dataset.theme;wrap.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('selected',b===btn));root.querySelector('#stormThemePreviewHost').innerHTML=sitePreviewHtml();activatePreviewMotion();}));
  }
  function bindSetupInteractions(node){
    node.querySelector('#stormProjectInput').addEventListener('input',e=>{state.projectName=e.target.value;});
    const logoInput=node.querySelector('#stormLogoInput'),drop=node.querySelector('#stormLogoDrop');
    node.querySelector('#stormLogoChoose').addEventListener('click',()=>logoInput.click());
    function useLogo(file){if(!file||!file.type.startsWith('image/'))return;if(logoObjectUrl)URL.revokeObjectURL(logoObjectUrl);logoObjectUrl=URL.createObjectURL(file);state.logoUrl=logoObjectUrl;state.logoFile=file;refreshLogoPreview();}
    logoInput.addEventListener('change',()=>{useLogo(logoInput.files?.[0]);logoInput.value='';});
    ['dragenter','dragover'].forEach(evt=>drop.addEventListener(evt,e=>{e.preventDefault();drop.classList.add('drag-over');}));
    ['dragleave','drop'].forEach(evt=>drop.addEventListener(evt,e=>{e.preventDefault();drop.classList.remove('drag-over');}));
    drop.addEventListener('drop',e=>useLogo(e.dataTransfer?.files?.[0]));
    [['Primary','primaryColor'],['Secondary','secondaryColor']].forEach(([prefix,key])=>{
      const picker=node.querySelector(`#storm${prefix}Picker`),hex=node.querySelector(`#storm${prefix}Hex`);
      picker.addEventListener('input',()=>{state[key]=picker.value.toUpperCase();hex.value=state[key];});
      hex.addEventListener('input',()=>{const v=hex.value.trim();if(validHex(v)){state[key]=v.toUpperCase();picker.value=state[key];}});
      hex.addEventListener('blur',()=>{if(!validHex(hex.value))hex.value=state[key];});
    });

    node.querySelector('#stormInviteAdd').addEventListener('click',()=>{
      const email=node.querySelector('#stormInviteEmail').value.trim();
      const permissionBundle=node.querySelector('#stormInviteRole').value;
      const locale=node.querySelector('#stormInviteLocale').value;
      if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return;
      state.invites.push({email,permissionBundle,locale});
      node.querySelector('#stormInviteEmail').value='';
      renderInviteList();
    });
  }


  function sectionPreviewHtml(key){
    const p=PREVIEWS[state.contentLang]||PREVIEWS.fr;
    const copy=SITE_COPY[state.contentLang]||SITE_COPY.fr;
    const name=state.projectName.trim()||(state.uiLang==='fr'?'Votre projet':'Your project');
    const mainFamily=state.fonts[0]?.family||'Roboto',secondFamily=state.fonts[1]?.family||mainFamily;
    let body='';
    if(key==='faq') body=`<div class="storm-module-faq"><div class="storm-module-search">${escapeHtml(p.faq.q)}<span>${escapeHtml(copy.search)}</span></div><div class="storm-module-answer"><small>${escapeHtml(p.faq.status)}</small><p>${escapeHtml(p.faq.a)}</p></div></div>`;
    if(key==='actu') body=`<div class="storm-module-article"><small>${escapeHtml(p.actu.tag)}</small><h4>${escapeHtml(p.actu.title)}</h4><p>${escapeHtml(p.actu.chapeau)}</p><div class="storm-module-line"></div></div>`;
    if(key==='jalons'){
      const m=MILESTONE_PREVIEWS[state.contentLang]||MILESTONE_PREVIEWS.fr;
      body=`<div class="storm-module-milestone"><small>${escapeHtml(m.date)}</small><h4>${escapeHtml(m.title)}</h4><p>${escapeHtml(m.detail)}</p><div class="storm-module-line"></div></div>`;
    }
    if(key==='plans') body=`<div class="storm-module-plan"><div class="storm-module-plan-visual"><span>3D</span></div><small>${escapeHtml(p.plans.type)}</small><h4>${escapeHtml(p.plans.title)}</h4><p>${escapeHtml(p.plans.comment)}</p></div>`;
    if(key==='ambassadeurs'||key==='equipe'){
      const person=key==='ambassadeurs'?p.ambassadeurs:p.equipe;const role=key==='ambassadeurs'?person.role:person.title;
      body=`<div class="storm-module-person"><div class="storm-module-avatar">${escapeHtml(initials(person.name))}</div><div><h4>${escapeHtml(person.name)}</h4><p>${escapeHtml(role)}</p></div></div>`;
    }
    const visible=state.modules?.[key]!==false;
    return `<div class="storm-section-device theme-${state.theme} ${visible?'':'is-section-hidden'}" data-section-preview="${key}" style="--client-primary:${escapeHtml(state.primaryColor)};--client-secondary:${escapeHtml(state.secondaryColor)};--font-main:'${escapeHtml(mainFamily)}';--font-secondary:'${escapeHtml(secondFamily)}';">
      <div class="storm-section-device-nav"><div class="storm-section-device-logo">${state.logoUrl?`<img src="${escapeHtml(state.logoUrl)}" alt="">`:escapeHtml(initials(name))}</div><span>${escapeHtml(name)}</span><i></i><i></i><i></i></div>
      <div class="storm-section-device-body"><div class="storm-section-device-label">${escapeHtml(t().previewLabel)}</div>${body}</div>
      <div class="storm-section-hidden-overlay"><span>${escapeHtml(t().sectionHidden)}</span></div>
    </div>`;
  }

  function buildTourStep(){
    const key=tourOrder[tourIndex],sec=(SECTIONS[state.uiLang]||SECTIONS.fr)[key],created=state.created.has(key),s=t();
    const visible=state.modules?.[key]!==false;
    const wrap=document.createElement('div');wrap.className='storm-section-layout';
    wrap.innerHTML=`<div class="storm-section-copy">
        <div class="storm-section-meta-row">
          <div class="storm-section-icon">${icon(sec.icon)}</div>
          <div class="storm-section-visibility">
            <span>${escapeHtml(s.sectionVisible)}</span>
            <button type="button" class="storm-apple-switch ${visible?'is-on':''}" id="stormSectionVisibility" role="switch" aria-checked="${visible?'true':'false'}" aria-label="${escapeHtml(s.sectionVisible)}"><i></i></button>
          </div>
        </div>
        <div class="storm-section-title-slot">
          <h2 class="storm-section-title">${escapeHtml(sec.title)}</h2>
        </div>
        <div class="storm-section-desc-slot">
          <p class="storm-section-desc">${escapeHtml(sec.desc)}</p>
        </div>
        <div class="storm-section-control-deck">
          <div class="storm-section-actions storm-section-control-state ${visible?'is-current':''}" id="stormSectionActions" aria-hidden="${visible?'false':'true'}">
            ${created?`<span class="storm-section-added" aria-label="${escapeHtml(s.added)}">${icon('check')}</span><button class="storm-btn-primary" id="stormSectionContinue">${escapeHtml(s.continue)}</button>`:`<button class="storm-btn-primary" id="stormCreateSection">${escapeHtml(s.createNow)}</button><button class="storm-btn-secondary" id="stormSectionLater">${escapeHtml(s.later)}</button>`}
          </div>
          <div class="storm-section-hidden-state storm-section-control-state ${visible?'':'is-current'}" id="stormSectionHiddenState" aria-hidden="${visible?'true':'false'}">
            <span>${escapeHtml(s.sectionHidden)}</span>
            <p>${escapeHtml(s.sectionHiddenDesc)}</p>
            <button class="storm-btn-primary" id="stormHiddenContinue">${escapeHtml(s.continue)}</button>
          </div>
          <div class="storm-section-editor storm-section-control-state" id="stormSectionEditor" aria-hidden="true">
            <input class="storm-field" id="stormQuick1" placeholder="${escapeHtml(sec.field1)}">
            <textarea class="storm-field" id="stormQuick2" placeholder="${escapeHtml(sec.field2)}"></textarea>
            <div class="storm-section-editor-actions"><button class="storm-btn-primary" id="stormQuickSave">${escapeHtml(s.saveAndContinue)}</button><button class="storm-btn-ghost" id="stormQuickCancel">${escapeHtml(s.later)}</button></div>
          </div>
        </div>
      </div><div class="storm-section-preview-column">${sectionPreviewHtml(key)}</div>`;

    const visibility=wrap.querySelector('#stormSectionVisibility');
    const actions=wrap.querySelector('#stormSectionActions');
    const hiddenState=wrap.querySelector('#stormSectionHiddenState');
    const editor=wrap.querySelector('#stormSectionEditor');
    const preview=wrap.querySelector('[data-section-preview]');

    function setControlState(target){
      [actions,hiddenState,editor].forEach(panel=>{
        const current=panel===target;
        panel.classList.toggle('is-current',current);
        panel.setAttribute('aria-hidden',current?'false':'true');
      });
    }

    function syncVisibility(nextVisible,animateIt=true){
      state.modules[key]=nextVisible;
      visibility.classList.toggle('is-on',nextVisible);
      visibility.setAttribute('aria-checked',nextVisible?'true':'false');
      setControlState(nextVisible?actions:hiddenState);
      preview.classList.toggle('is-section-hidden',!nextVisible);
      if(animateIt){
        animate(visibility,[{opacity:.72},{opacity:1}],{duration:170,easing:'ease-out'});
      }
    }

    visibility.addEventListener('click',()=>syncVisibility(!(state.modules?.[key]!==false)));

    wrap.querySelector('#stormHiddenContinue')?.addEventListener('click',goTourNext);

    if(created){
      wrap.querySelector('#stormSectionContinue')?.addEventListener('click',goTourNext);
    } else {
      wrap.querySelector('#stormCreateSection')?.addEventListener('click',()=>{
        setControlState(editor);
        animate(editor,[{opacity:0},{opacity:1}],{duration:220,easing:'ease-out'});
        wrap.querySelector('#stormQuick1').focus();
      });
      wrap.querySelector('#stormSectionLater')?.addEventListener('click',goTourNext);
      wrap.querySelector('#stormQuickCancel')?.addEventListener('click',goTourNext);
      wrap.querySelector('#stormQuickSave')?.addEventListener('click',async()=>{
        state.created.add(key);
        const btn=wrap.querySelector('#stormQuickSave');
        btn.disabled=true;
        btn.classList.add('is-confirmed');
        btn.setAttribute('aria-label',s.added);
        btn.innerHTML=`<span class="storm-save-check">${icon('check')}</span>`;
        await animate(
          btn.querySelector('.storm-save-check'),
          [{opacity:0,transform:'scale(.65)'},{opacity:1,transform:'scale(1)'}],
          {duration:260,easing:'cubic-bezier(.16,1,.3,1)'}
        );
        await wait(180);
        goTourNext();
      });
    }
    return wrap;
  }

  function renderTourProgress(){
    const s=t(),pct=((tourIndex+1)/tourOrder.length)*100;
    const label=root.querySelector('#stormTourStepLabel');
    if(label){
      label.textContent=`${tourIndex+1} / ${tourOrder.length}`;
      label.setAttribute('aria-label',s.sectionProgress(tourIndex+1,tourOrder.length));
    }
    root.querySelector('#stormTourProgressFill').style.width=`${pct}%`;
    const back=root.querySelector('#stormTourBackTop');
    if(back) back.textContent=s.back;
  }

  async function renderTourStep(direction=1){
    const copyHost=root.querySelector('#stormTourCopyHost');
    const previewHost=root.querySelector('#stormTourPreviewHost');
    const oldCopy=copyHost.firstElementChild;
    const oldPreview=previewHost.firstElementChild;

    const fresh=buildTourStep();
    const newCopy=fresh.querySelector('.storm-section-copy');
    const newPreview=fresh.querySelector('.storm-section-device');

    await Promise.all([
      oldCopy ? animate(oldCopy,[{opacity:1},{opacity:0}],{duration:120,easing:'ease-in'}) : Promise.resolve(),
      oldPreview ? animate(oldPreview,[{opacity:1},{opacity:0}],{duration:120,easing:'ease-in'}) : Promise.resolve()
    ]);

    copyHost.replaceChildren(newCopy);
    previewHost.replaceChildren(newPreview);

    await Promise.all([
      animate(newCopy,[{opacity:0},{opacity:1}],{duration:240,easing:'ease-out'}),
      animate(newPreview,[{opacity:0},{opacity:1}],{duration:240,easing:'ease-out'})
    ]);

    renderTourProgress();
  }
  async function showTour(){
    tourIndex=0;
    tourOrder=[...activeSectionOrder()];
    applyTexts();
    if(!tourOrder.length){showBuild();return;}
    await transitionTo('tour');renderTourStep();
  }
  function goTourNext(){
    if(tourIndex>=tourOrder.length-1){showBuild();return;}
    tourIndex++;renderTourStep(1);
  }
  function goTourBack(){
    if(tourIndex>0){tourIndex--;renderTourStep(-1);return;}
    showReveal();
  }

  async function swapBuildMessage(text){
    const el=root.querySelector('#stormBuildMessage');
    await animate(el,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-4px)'}],{duration:130,easing:'ease-in'});
    el.textContent=text;
    await animate(el,[{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:230,easing:'ease-out'});
  }

  async function playBuildMorph(){
    const s=t();
    const word=root.querySelector('#stormBuildWord');
    const letters=[...word.querySelectorAll('span')];
    const progress=root.querySelector('#stormBuildProgress');
    const message=root.querySelector('#stormBuildMessage');

    message.textContent=s.buildSteps[0];

    const progressAnim=progress.animate(
      [{width:'0%'},{width:'100%'}],
      {duration:3600,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}
    );

    await wait(420);

    // The word stays the only graphic object.
    // Each letter "drops" into a slightly different place — controlled,
    // gravitational, no bounce — then Storm reconstructs itself.
    const falls=[
      {x:-118,y:112,r:-7},
      {x:-54, y:166,r: 5},
      {x:  10,y:132,r:-4},
      {x:  72,y:174,r: 6},
      {x: 132,y:116,r:-5}
    ];

    await Promise.all(letters.map((letter,i)=>animate(
      letter,
      [
        {offset:0,opacity:1,transform:'translate3d(0,0,0) rotate(0deg) scale(1)'},
        {offset:.18,opacity:1,transform:`translate3d(${falls[i].x*.10}px,${falls[i].y*.08}px,0) rotate(${falls[i].r*.12}deg) scale(.995)`},
        {offset:1,opacity:.84,transform:`translate3d(${falls[i].x}px,${falls[i].y}px,0) rotate(${falls[i].r}deg) scale(.96)`}
      ],
      {
        duration:560+i*36,
        delay:i*34,
        easing:'cubic-bezier(.32,0,.67,0)'
      }
    )));

    await swapBuildMessage(s.buildSteps[1]);
    await wait(620);
    await swapBuildMessage(s.buildSteps[2]);
    await wait(380);

    // Reconstruction: the scattered letters return to the exact wordmark.
    // Reverse stagger gives the impression that Storm is assembling itself,
    // without a spring/bounce effect.
    await Promise.all(letters.map((letter,i)=>{
      const delay=(letters.length-1-i)*42;
      return animate(
        letter,
        [
          {opacity:.84,transform:`translate3d(${falls[i].x}px,${falls[i].y}px,0) rotate(${falls[i].r}deg) scale(.96)`},
          {opacity:1,transform:'translate3d(0,0,0) rotate(0deg) scale(1)'}
        ],
        {
          duration:620,
          delay,
          easing:'cubic-bezier(.16,1,.3,1)'
        }
      );
    }));

    letters.forEach(letter=>{
      letter.style.opacity='';
      letter.style.transform='';
      letter.getAnimations().forEach(a=>a.cancel());
    });

    await progressAnim.finished.catch(()=>{});
    await swapBuildMessage(s.ready);
    await wait(480);
  }

  // Même mécanisme que Storm Home (?devUser=<uuid> -> X-Storm-Dev-User)
  // — cohérent avec devAuth côté serveur, développement uniquement.
  function devHeaders(){
    const devUser=new URLSearchParams(location.search).get('devUser');
    return devUser?{'X-Storm-Dev-User':devUser}:{};
  }

  function goToHome(){
    const devUser=new URLSearchParams(location.search).get('devUser');
    location.assign(devUser?`/?devUser=${encodeURIComponent(devUser)}`:'/');
  }

  // Création réelle — jamais rejouée si le projet existe déjà.
  // createdProjectId / logoUploaded distinguent explicitement les deux
  // opérations : un échec d'upload de logo ne doit jamais faire
  // recréer le projet.
  async function attemptCreateProject(){
    if(!state.createdProjectId){
      const payload={
        name:(state.projectName.trim()||'Projet'),
        workspaceLocale:state.uiLang,
        contentLocale:state.contentLang,
        identity:{
          primaryColor:state.primaryColor,
          secondaryColor:state.secondaryColor,
          fontPrimary:state.fonts[0]?.name,
          fontSecondary:state.fonts[1]?.name,
          theme:state.theme
        },
        modules:state.modules,
        invites:state.invites.map(i=>({email:i.email,permissionBundle:i.permissionBundle,locale:i.locale}))
      };
      let res;
      try{
        res=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json',...devHeaders()},body:JSON.stringify(payload)});
      }catch(e){return 'create-failed';}
      if(!res.ok)return 'create-failed';
      const json=await res.json();
      state.createdProjectId=json.id;
    }

    if(state.logoFile && !state.logoUploaded){
      const form=new FormData();form.append('logo',state.logoFile);
      let res2;
      try{
        res2=await fetch(`/api/projects/${state.createdProjectId}/logo`,{method:'POST',headers:devHeaders(),body:form});
      }catch(e){return 'logo-failed';}
      if(!res2.ok)return 'logo-failed';
      state.logoUploaded=true;
    }

    return 'success';
  }

  // Rendu de l'issue — jamais de succès affiché avant que le vrai
  // POST /api/projects ait réellement abouti. L'animation visuelle
  // (playBuildMorph) ne préjuge en rien du résultat métier.
  function renderBuildOutcome(result){
    const errorEl=root.querySelector('#stormBuildError');
    const retryBtn=root.querySelector('#stormBuildRetryBtn');
    const finalEl=root.querySelector('#stormBuildFinal');
    const openBtn=root.querySelector('#stormBuildOpenBtn');
    const s=t();

    errorEl.hidden=true;retryBtn.hidden=true;finalEl.hidden=true;

    if(result==='success'){
      finalEl.hidden=false;
      openBtn.textContent=s.buildOpenStorm;
      openBtn.onclick=()=>{goToHome();};
      return;
    }

    errorEl.hidden=false;
    retryBtn.hidden=false;
    retryBtn.textContent=s.buildRetry;
    if(result==='logo-failed'){
      errorEl.textContent=s.buildLogoError;
      retryBtn.onclick=async()=>{retryBtn.disabled=true;renderBuildOutcome(await attemptCreateProject());retryBtn.disabled=false;};
    }else{
      errorEl.textContent=s.buildCreateError;
      retryBtn.onclick=async()=>{retryBtn.disabled=true;renderBuildOutcome(await attemptCreateProject());retryBtn.disabled=false;};
    }
  }

  async function showBuild(){
    applyTexts();await transitionTo('build');
    await playBuildMorph();
    renderBuildOutcome(await attemptCreateProject());
  }

  function bindGlobalNavigation(node){
    node.querySelector('#stormIntroSkip').addEventListener('click',skipIntro);
    node.querySelector('#stormUiLangContinue').addEventListener('click',showContentLanguage);
    node.querySelector('#stormContentLangContinue').addEventListener('click',showWelcome);
    node.querySelector('#stormWelcomeContinue').addEventListener('click',showProject);
    node.querySelector('#stormProjectContinue').addEventListener('click',showLogo);
    node.querySelector('#stormLogoSkip').addEventListener('click',showColors);
    node.querySelector('#stormLogoContinue').addEventListener('click',showColors);
    node.querySelector('#stormColorsContinue').addEventListener('click',showFonts);
    node.querySelector('#stormFontsContinue').addEventListener('click',showTheme);
    node.querySelector('#stormThemeContinue').addEventListener('click',showModules);
    node.querySelector('#stormModulesContinue').addEventListener('click',showAccess);
    node.querySelector('#stormAccessLater').addEventListener('click',showReveal);
    node.querySelector('#stormAccessContinue').addEventListener('click',showReveal);
    node.querySelector('#stormRevealContinue').addEventListener('click',showTour);
    node.querySelector('#stormCloseBtn').addEventListener('click',close);
    node.querySelector('#stormTourBackTop').addEventListener('click',goTourBack);
    node.querySelectorAll('[data-back]').forEach(btn=>btn.addEventListener('click',()=>{
      const routes={'ui-language':showUiLanguage,'content-language':showContentLanguage,'welcome':showWelcome,'project':showProject,'logo':showLogo,'colors':showColors,'fonts':showFonts,'theme':showTheme,'modules':showModules,'access':showAccess};
      routes[btn.dataset.back]?.();
    }));
  }
  function restart(){
    root.getAnimations?.({subtree:true}).forEach(a=>a.cancel());
    if(logoObjectUrl){URL.revokeObjectURL(logoObjectUrl);logoObjectUrl=null;}
    state=freshState();tourIndex=0;tourOrder=[];sceneName='intro';
    root.querySelector('#stormTourCopyHost')?.replaceChildren();
    root.querySelector('#stormTourPreviewHost')?.replaceChildren();
    root.querySelectorAll('.storm-scene').forEach(s=>{s.hidden=s.dataset.scene!=='intro';s.style.opacity='';s.style.transform='';});
    root.querySelectorAll('#stormBuildWord span').forEach(l=>{l.style.opacity='';l.style.transform='';});
    const bp=root.querySelector('#stormBuildProgress');if(bp)bp.style.width='0%';
    startSequence();
  }
  function startSequence(){
    if(reducedMotion.matches){showUiLanguage();return;}
    abortController=new AbortController();playIntro(abortController.signal).catch(err=>{if(err?.name!=='AbortError'){console.error('Storm demo:',err);showUiLanguage();}});
  }
  function open(){
    if(document.getElementById(ROOT_ID))return;
    state=freshState();sceneName='intro';focusBeforeOpen=document.activeElement;document.body.classList.add('storm-demo-open');root=buildRoot();document.body.appendChild(root);applyTexts();document.addEventListener('keydown',handleKeydown);startSequence();
  }
  function cleanup(restoreFocus=true){
    abortController?.abort();if(logoObjectUrl){URL.revokeObjectURL(logoObjectUrl);logoObjectUrl=null;}root?.remove();root=null;document.body.classList.remove('storm-demo-open');if(restoreFocus)focusBeforeOpen?.focus?.({preventScroll:true});document.removeEventListener('keydown',handleKeydown);
  }
  function close(){cleanup(false);goToHome();}
  function handleKeydown(e){if(e.key==='Escape'){e.preventDefault();close();}}
  function init(){
    open();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
