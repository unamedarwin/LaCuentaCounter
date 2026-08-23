# Model de torneig

## Creació

Abans d’escanejar resultats, el controlador defineix:

- nom del torneig;
- nombre total de rondes;
- nombre de places de taula per ronda;
- nombre de pitjors resultats que es descartaran per participant.

La primera ronda es crea amb totes les places de taula pendents. La ronda següent només es pot crear quan totes les places de la ronda actual tenen un QR assignat. Es pot tornar a una ronda anterior per completar-ne una plaça pendent.

## Importació

Cada QR correspon a una partida completa. Durant la revisió, el controlador selecciona la ronda i una de les places de taula encara lliures. El nom de taula introduït a la partida es conserva com a dada d’origen, però la plaça oficial és la que assigna el controlador.

Una identitat no pot tenir dos resultats dins de la mateixa ronda, encara que provingui de taules diferents. Si arriba un altre nom idèntic quan aquella persona ja té resultat a la ronda, el controlador proposa una identitat nova amb sufix (`Pep 2`, `Pep 3`…). Si en una ronda posterior el mateix nom pot correspondre a diverses identitats, la importació queda bloquejada fins que el controlador en tria una explícitament. També s'admeten dos noms idèntics dins del mateix QR i es mantenen com a persones separades.

Un identificador únic impedeix importar dues vegades la mateixa partida.

## Classificació i descartes

Per cada participant s’ordenen els seus resultats finals de més a menys. Si el format té `R` rondes i `D` descartes, compten com a màxim els `R − D` millors resultats. Abans d’arribar a aquest nombre, compten tots els resultats disponibles.

Els resultats descartats continuen visibles al registre i només deixen de sumar. Mai s’eliminen. La classificació s’ordena pels diners computables acumulats; els totals idèntics comparteixen posició.

## Persistència

Tot l’estat es desa després de cada canvi al `localStorage` de l’origen instal·lat. El tancament, la reobertura i les actualitzacions del service worker no eliminen partides. Quan l’API és disponible, es demana emmagatzematge persistent. L’esborrat només es produeix mitjançant l’acció explícita de neteja o si l’usuari/el sistema elimina les dades del lloc; per això hi ha exportació i importació JSON.
