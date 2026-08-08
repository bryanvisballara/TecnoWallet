# HOST — Frontend Hostinger

Esta carpeta es **siempre** el paquete del front para Hostinger (`public_html`).

## Archivo a subir

- `tecnowallet-public-html.zip` → descomprime su contenido en `public_html` (no subas la carpeta HOST entera).

## Regenerar

Desde la raíz del monorepo:

```bash
EXPO_PUBLIC_API_URL=https://TU-API.onrender.com/api/v1 yarn export:host
```

El export usa el build estático de Expo web (`apps/mobile`) y añade `.htaccess` para rutas SPA.
