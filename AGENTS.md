# Guia per a agents

- El projecte és una PWA estàtica: conserva HTML, CSS i JavaScript sense compilació, frameworks ni GitHub Actions.
- Mantén compatibles les dues entrades `index.html` (taula) i `tournament.html` (torneig), així com les rutes relatives per a GitHub Pages sota un subdirectori.
- Mantén les quatre traduccions de la interfície (`ca`, `es`, `eu`, `gl`) sincronitzades a `i18n.js`, inclosos els missatges dinàmics.
- Qualsevol canvi al QR ha de conservar compatibilitat amb `LCC1` o incrementar la versió i actualitzar `docs/qr-protocol.md`.
- El QR visible de final de partida usa `LCC1:<base64url>`; l’enllaç compartit usa `#import=`. El controlador ha d’acceptar tots dos formats sense dependre que un navegador preservi el fragment.
- En pantalles de fins a 520 px, mantén el QR al principi del diàleg final; no pot quedar ocult sota la classificació sense una indicació visible.
- No incorporis recursos gràfics, logotips o art del joc sense una llicència explícita. Mantén l’atribució visible del peu de pàgina i la secció de drets del README.
- Les dades de participants han de continuar sent locals; documenta qualsevol canvi que introdueixi xarxa o persistència remota abans d’implementar-lo.
- No eliminis resultats quan s’apliquin descartes: marca’ls com a no computables i conserva sempre el registre original. Mantén la configuració de rondes i places de taula dins la còpia JSON.
- Admet noms idèntics en una mateixa partida sense alterar-los al QR. Diferencia'ls visualment a la taula i, al torneig, crea sufixos per a identitats noves i exigeix una tria explícita davant múltiples coincidències.
- En canviar els fitxers estàtics, incrementa la versió de memòria cau a `sw.js` per evitar que una instal·lació conservi recursos antics.
- Valida com a mínim la sintaxi JavaScript, el manifest, el registre d’una ronda, `tests/qr-smoke.cjs`, `tests/parser-smoke.cjs` i la importació d’un resultat al torneig.
