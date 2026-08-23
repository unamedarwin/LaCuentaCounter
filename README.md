# La Cuenta Counter

PWA estàtica i sense servidor per portar els comptes d’una partida de **La Cuenta** i consolidar resultats de múltiples taules en un torneig.

## Funcionalitats

- Partides de 3 a 8 participants amb els estalvis inicials oficials: de 900 € a 1.400 €.
- Registre per rondes amb pagament individual, **A mitges**, **A patxes**, repartiment manual i **Propina**.
- Només es registra el cobrament final de cada ronda; no es registren cartes ni jugades individuals.
- Saldo —també negatiu—, límit, augment de mà fins a 10 cartes, historial i opció de desfer l’última ronda.
- Final automàtic quan algú arriba o supera el topall, classificació final, desempat oficial pels diners que es porten a sobre i QR interoperable.
- Controlador de torneig amb format configurable: rondes, nombre de taules per ronda i pitjors resultats descartats.
- Cada ronda crea `N` places de taula. El controlador assigna cada QR a una plaça concreta i només obre la ronda següent quan totes les taules tenen resultat.
- Detecció de noms repetits, inclosos dos noms iguals a la mateixa taula; el controlador crea sufixos com `Pep 2` i exigeix confirmació quan hi ha més d’una coincidència possible.
- Revisió d’identitats, classificació acumulada, fusió segura de duplicats i còpies JSON.
- Interfície completa en català, castellà, euskera i gallec.
- Persistència exclusivament local, funcionament sense connexió després de la primera càrrega i instal·lació com a aplicació a Android/iOS.

## Execució local

No hi ha cap procés de compilació ni dependències per instal·lar. Serveix la carpeta amb qualsevol servidor HTTP estàtic. Per exemple:

```powershell
python -m http.server 4173
```

Obre `http://localhost:4173/index.html`. La càmera només està disponible en un origen segur (`https://`) o a `localhost`.

## Publicació a GitHub Pages

Publica directament els fitxers de la branca escollida des de **Settings → Pages → Deploy from a branch**. No cal GitHub Actions. Les rutes són relatives i funcionen també si el projecte es publica sota `/nom-del-repositori/`.

## Privadesa

Els noms, la partida en curs i el torneig complet —configuració, rondes, places de taula, resultats i identitats— es desen a `localStorage` del dispositiu. Tancar o actualitzar la PWA no esborra aquestes dades. Quan el navegador ho permet, l’aplicació sol·licita emmagatzematge persistent. L’exportació JSON permet conservar una còpia externa davant una neteja manual del navegador o del sistema operatiu.

No hi ha analítica, servidor ni transmissió automàtica. En finalitzar una partida, el QR incorpora el nom de la taula, els noms dels participants, els resultats i, si s’ha informat per desfer un empat, els diners que porten a sobre; mostrar o compartir aquest QR és una decisió explícita de l’usuari.

La classificació del torneig s’ordena pels diners finals acumulats. Si dues persones tenen exactament el mateix total, comparteixen posició; no s’aplica cap desempat de torneig inventat mentre no hi hagi una regla acordada.

## Marques, autoria i recursos

Aquesta és una eina gratuïta, no oficial i sense afiliació amb l’editorial.

- **La Cuenta** © 2Tomatoes Games.
- Joc dissenyat per **Litus Carreras**.
- Art original del joc per **Ariadna Altimira**.

La web no copia logotips, cartes, il·lustracions, tipografies ni altres recursos gràfics del joc. La paleta pròpia s’inspira genèricament en tapes, tomàquet, vi i vegetals. Les mencions al títol i a les cartes serveixen per identificar el joc i explicar la funcionalitat compatible.

Les biblioteques QR de tercers i les seves llicències consten a [`vendor/NOTICE.md`](vendor/NOTICE.md). El protocol QR està documentat a [`docs/qr-protocol.md`](docs/qr-protocol.md).
El funcionament de rondes, taules i descartes està documentat a [`docs/tournament.md`](docs/tournament.md).
