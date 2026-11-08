# Lista de espera · Interstellar Live Madrid (espejo)

Copia estática de la portada de [livecinemaes.com](https://livecinemaes.com/) para apuntarse a la lista de espera cuando la web
principal no carga en España por los bloqueos de IP de LaLiga. Sin nada de la venta de entradas.

- El alta va primero a la API de livecinemaes.com y, si no responde en 4 segundos, a la hoja de Google de la lista.
- Sin cookies, sin analítica, sin secretos. Se genera con `scripts/generar-espejo.mjs` del repositorio de la venta.

## Página de estado: /estado

https://livecinemaspain-byte.github.io/lista-espera/estado/ (y lista.livecinemaes.com/estado/ cuando esté el dominio).
Fuera de Cloudflare: se ve aunque livecinemaes.com esté bloqueada. Para cambiarla, edita `estado/estado.json`
(`estado`: ok, demanda o problema; con problema, `hasta`, p. ej. «14:00 del jueves 12») y haz commit. En un minuto se ve:
la página vuelve a mirar el archivo cada minuto. Desde el navegador:
https://github.com/livecinemaspain-byte/lista-espera/edit/main/estado/estado.json
