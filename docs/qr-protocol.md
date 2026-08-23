# Protocol QR LCC1

El QR d’una taula conté un URL absolut cap a `tournament.html` amb un fragment `#import=`. El fragment és JSON codificat en UTF-8 i Base64 URL-safe. Els fragments no s’envien al servidor HTTP.

## Esquema de càrrega útil

```json
{
  "p": "LCC1",
  "v": 1,
  "g": "game_uuid",
  "t": "Taula 1",
  "e": "2026-08-23T12:00:00.000Z",
  "r": 7,
  "a": [
    { "n": "Anna", "s": 1000, "d": 340, "b": 660, "k": 1, "c": 25 }
  ]
}
```

| Camp | Significat |
|---|---|
| `p` | Identificador fix del protocol: `LCC1`. |
| `v` | Versió numèrica de l’esquema. |
| `g` | Identificador únic de partida, usat per evitar imports duplicats. |
| `t` | Nom o número visible de la taula. |
| `e` | Data ISO de finalització. |
| `r` | Nombre de rondes registrades. |
| `a` | Resultats dels participants. |
| `n` | Nom introduït a la taula. |
| `s` | Estalvis inicials. |
| `d` | Total pagat. |
| `b` | Balanç final; pot ser negatiu si el darrer compte supera els estalvis. |
| `k` | Posició final; admet empats. |
| `c` | Opcional. Diners que la persona porta a sobre, utilitzats pel desempat oficial d’una partida. |

`n` no és un identificador únic: un mateix QR pot contenir dues persones amb exactament el mateix nom. L’ordre i la resta de dades de cada element les mantenen separades; el controlador del torneig és qui resol la identitat i, si cal, crea noms visibles com `Pep 2`.

El controlador valida el protocol, el nombre de participants i els camps numèrics abans d’obrir la revisió d’identitats. Un mateix `g` no es pot importar dues vegades.

La classificació general del torneig suma `b` i ordena de més a menys. Els totals idèntics comparteixen posició perquè no s’ha definit un desempat específic de torneig.
